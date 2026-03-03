import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { haversineDistance, categorizeCampaign } from "../geo/haversine.js";
import { discoverViaPlacesAPI } from "../sources/google-places.js";
import { discoverViaMapsScraping } from "../sources/google-maps-scraper.js";
import { scrapeWebsite } from "../sources/website-scraper.js";
import { searchYelp } from "../sources/yelp.js";
import { jobQueue } from "./job-queue.js";
import type { DiscoveredBusiness, ExtractedContact, JobStartPayload } from "../types.js";

type LogFn = (msg: string) => void;

/**
 * Update a scrape job record in Supabase.
 */
async function updateJob(
  jobId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("scrape_jobs")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", jobId);

  if (error) {
    console.error(`[orchestrator] Failed to update job ${jobId}:`, error.message);
  }
}

/**
 * Update a business record in Supabase.
 */
async function updateBusiness(
  businessId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("businesses")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", businessId);

  if (error) {
    console.error(`[orchestrator] Failed to update business ${businessId}:`, error.message);
  }
}

// ─── Phase 1: Discovery ────────────────────────────────────────────────

async function discoverBusinesses(
  payload: JobStartPayload,
  centerLat: number,
  centerLng: number,
  log: LogFn
): Promise<DiscoveredBusiness[]> {
  log(`Phase 1 — Discovery (mode: ${payload.mode}, location: ${payload.searchLocation})`);

  let businesses: DiscoveredBusiness[];

  const searchQueries = payload.searchQueries;
  log(`Search queries: [${searchQueries.join(", ")}]`);

  if (payload.mode === "api" && config.GOOGLE_PLACES_API_KEY) {
    const radiusMeters = payload.campaign === "local" ? 16000 : 50000;
    log(`Querying Google Places API (radius: ${radiusMeters}m)`);
    businesses = await discoverViaPlacesAPI(centerLat, centerLng, radiusMeters, searchQueries);
  } else {
    const allScrapedBusinesses: DiscoveredBusiness[] = [];
    const seenNames = new Set<string>();

    for (const query of searchQueries) {
      const fullQuery = `${query} near ${payload.searchLocation}`;
      log(`Scraping Google Maps: "${fullQuery}"`);
      const results = await discoverViaMapsScraping(fullQuery, centerLat, centerLng);
      for (const business of results) {
        const key = business.name.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          allScrapedBusinesses.push(business);
        }
      }
    }

    businesses = allScrapedBusinesses;

    if (businesses.length === 0 && config.GOOGLE_PLACES_API_KEY) {
      log(`Scraping returned 0 results — falling back to Google Places API`);
      const radiusMeters = payload.campaign === "local" ? 16000 : 50000;
      businesses = await discoverViaPlacesAPI(centerLat, centerLng, radiusMeters, searchQueries);
    }
  }

  // Calculate distances and filter by campaign
  const businessesWithDistance = businesses.map((business) => {
    const distance =
      business.lat != null && business.lng != null
        ? haversineDistance(centerLat, centerLng, business.lat, business.lng)
        : null;
    const campaign = distance != null ? categorizeCampaign(distance) : null;
    return { ...business, distance, campaign };
  });

  const filtered = businessesWithDistance.filter((b) => {
    if (b.distance == null) return true;
    if (payload.campaign === "local") return b.distance < 10;
    if (payload.campaign === "remote") return b.distance > 25;
    return true;
  });

  log(`Discovered ${businesses.length} businesses, ${filtered.length} match campaign "${payload.campaign}"`);

  return filtered;
}

/**
 * Upsert discovered businesses into Supabase and return the inserted/updated IDs.
 */
async function upsertBusinesses(
  userId: string,
  jobId: string,
  businesses: (DiscoveredBusiness & { distance: number | null; campaign: string | null })[],
  log: LogFn
): Promise<{ id: string; business: DiscoveredBusiness & { distance: number | null } }[]> {
  const results: { id: string; business: DiscoveredBusiness & { distance: number | null } }[] = [];

  for (const business of businesses) {
    const row = {
      user_id: userId,
      google_place_id: business.place_id,
      name: business.name,
      address: business.address,
      phone: business.phone,
      website: business.website,
      google_maps_url: business.google_maps_url,
      latitude: business.lat,
      longitude: business.lng,
      distance_miles: business.distance != null ? Math.round(business.distance * 100) / 100 : null,
      rating: business.rating,
      review_count: business.review_count,
      campaign: business.campaign,
      scrape_status: "discovered",
      job_id: jobId,
    };

    let result;
    if (business.place_id) {
      result = await supabase
        .from("businesses")
        .upsert(row, { onConflict: "user_id,google_place_id" })
        .select("id")
        .single();
    } else {
      result = await supabase
        .from("businesses")
        .insert(row)
        .select("id")
        .single();
    }

    if (result.error) {
      log(`✗ Failed to upsert "${business.name}": ${result.error.message}`);
      continue;
    }

    if (result.data) {
      results.push({ id: result.data.id, business });
    }
  }

  log(`Stored ${results.length} businesses in database`);
  return results;
}

// ─── Phase 2: Enrichment ───────────────────────────────────────────────

async function enrichBusiness(
  businessId: string,
  business: DiscoveredBusiness,
  jobId: string,
  searchLocation: string,
  log: LogFn
): Promise<ExtractedContact[]> {
  await updateBusiness(businessId, { scrape_status: "enriching" });

  const enrichmentData: Record<string, unknown> = {};
  let websiteContacts: ExtractedContact[] = [];

  try {
    // Scrape website for staff/contacts + LinkedIn URL
    if (business.website) {
      log(`  → Scraping website: ${business.website}`);
      try {
        const result = await scrapeWebsite(business.website);
        websiteContacts = result.contacts;
        if (result.staffPageUrl) {
          log(`  ← Staff page: ${result.staffPageUrl}`);
        }
        if (result.linkedinUrl) {
          enrichmentData.linkedin_url = result.linkedinUrl;
          log(`  ← LinkedIn: ${result.linkedinUrl}`);
        }
        log(`  ← ${websiteContacts.length} contacts found`);
      } catch (error) {
        log(`  ✗ Website scrape failed: ${error instanceof Error ? error.message : error}`);
      }
    } else {
      log(`  → No website — skipping`);
    }

    // Search Yelp
    if (config.YELP_API_KEY) {
      log(`  → Searching Yelp`);
      try {
        const yelpData = await searchYelp(business.name, searchLocation);
        if (yelpData.yelpUrl) {
          enrichmentData.yelp_url = yelpData.yelpUrl;
          log(`  ← Yelp: ${yelpData.yelpUrl}`);
        } else {
          log(`  ← Yelp: not found`);
        }
        if (yelpData.rating != null) {
          enrichmentData.rating = yelpData.rating;
        }
        if (yelpData.reviewCount != null) {
          enrichmentData.review_count = yelpData.reviewCount;
        }
      } catch (error) {
        log(`  ✗ Yelp search failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    await updateBusiness(businessId, {
      ...enrichmentData,
      scrape_status: "enriched",
      enriched_at: new Date().toISOString(),
    });

    return websiteContacts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateBusiness(businessId, {
      scrape_status: "failed",
      scrape_error: message,
    });
    return [];
  }
}

// ─── Phase 3: Contact Extraction ───────────────────────────────────────

async function insertContacts(
  businessId: string,
  userId: string,
  contacts: ExtractedContact[]
): Promise<number> {
  if (contacts.length === 0) return 0;

  let insertedCount = 0;

  for (const contact of contacts) {
    const { error } = await supabase.from("contacts").insert({
      business_id: businessId,
      user_id: userId,
      name: contact.name,
      title: contact.title,
      email: contact.email,
      phone: contact.phone,
      linkedin_url: contact.linkedin_url,
      source: contact.source,
      confidence: contact.confidence,
      seniority_score: contact.seniority_score,
    });

    if (error) {
      console.warn(
        `[orchestrator] Failed to insert contact "${contact.name}":`,
        error.message
      );
    } else {
      insertedCount++;
    }
  }

  return insertedCount;
}

// ─── Main Pipeline ─────────────────────────────────────────────────────

/**
 * Run the full 3-phase scraping pipeline for a job.
 *
 * Phase 1: Discovery — find businesses via search queries
 * Phase 2: Enrichment — scrape websites, LinkedIn, Yelp
 * Phase 3: Contact extraction — insert discovered contacts
 */
export async function runPipeline(payload: JobStartPayload): Promise<void> {
  const { jobId, userId, campaign, mode } = payload;
  const centerLat = payload.searchLat;
  const centerLng = payload.searchLng;

  // ── Log accumulator ────────────────────────────────────────────────
  const logLines: string[] = [];

  function log(msg: string) {
    const ts = new Date().toISOString().slice(11, 19);
    logLines.push(`[${ts}] ${msg}`);
    console.log(`[orchestrator] ${msg}`);
  }

  /** Update job in Supabase, always including the latest log. */
  async function flushJob(updates: Record<string, unknown>) {
    await updateJob(jobId, { ...updates, log: logLines.join("\n") });
  }

  const pipelineStart = Date.now();
  log(`Starting pipeline`);
  log(`Job: ${jobId}`);
  log(`Campaign: ${campaign} | Mode: ${mode}`);
  log(`Location: ${payload.searchLocation} (${centerLat}, ${centerLng})`);
  log(`Queries: [${payload.searchQueries.join(", ")}]`);

  try {
    await flushJob({
      status: "running",
      started_at: new Date().toISOString(),
    });

    // ── Phase 1: Discovery ──────────────────────────────────────────

    const discovered = await discoverBusinesses(payload, centerLat, centerLng, log);

    if (jobQueue.isCancelled(jobId)) {
      log("Job cancelled");
      await flushJob({ status: "cancelled" });
      return;
    }

    const upsertedBusinesses = await upsertBusinesses(
      userId,
      jobId,
      discovered as (DiscoveredBusiness & { distance: number | null; campaign: string | null })[],
      log
    );

    await flushJob({ businesses_discovered: upsertedBusinesses.length });

    log(`Phase 1 complete — ${upsertedBusinesses.length} businesses stored`);

    // ── Phase 2: Enrichment ─────────────────────────────────────────

    let businessesEnriched = 0;
    let businessesFailed = 0;
    let totalContacts = 0;
    const businessContacts = new Map<string, ExtractedContact[]>();

    const totalToEnrich = upsertedBusinesses.length;

    for (const { id: businessId, business } of upsertedBusinesses) {
      if (jobQueue.isCancelled(jobId)) {
        log("Job cancelled");
        await flushJob({ status: "cancelled" });
        return;
      }

      const enrichIdx = businessesEnriched + businessesFailed + 1;
      log(`Enriching business ${enrichIdx}/${totalToEnrich}: ${business.name}`);

      try {
        const contacts = await enrichBusiness(businessId, business, jobId, payload.searchLocation, log);
        businessContacts.set(businessId, contacts);
        businessesEnriched++;
        await flushJob({ businesses_enriched: businessesEnriched });
      } catch (error) {
        businessesFailed++;
        log(`✗ Enrichment failed for "${business.name}": ${error instanceof Error ? error.message : error}`);
        await flushJob({ businesses_failed: businessesFailed });
      }
    }

    log(`Phase 2 complete — ${businessesEnriched} enriched, ${businessesFailed} failed`);

    // ── Phase 3: Contact Extraction ─────────────────────────────────

    log(`Phase 3 — Inserting contacts`);

    for (const [businessId, contacts] of businessContacts) {
      if (jobQueue.isCancelled(jobId)) {
        log("Job cancelled");
        await flushJob({ status: "cancelled" });
        return;
      }

      try {
        const inserted = await insertContacts(businessId, userId, contacts);
        totalContacts += inserted;
        await flushJob({ total_contacts: totalContacts });
      } catch (error) {
        log(`✗ Contact insertion failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    log(`Phase 3 complete — ${totalContacts} contacts inserted`);

    // ── Complete ────────────────────────────────────────────────────

    const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1);
    log(`Pipeline complete in ${elapsed}s — ${upsertedBusinesses.length} businesses, ${businessesEnriched} enriched, ${totalContacts} contacts`);

    await flushJob({
      status: "completed",
      total_contacts: totalContacts,
      completed_at: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log(`Pipeline failed: ${message}`);

    await flushJob({
      status: "failed",
      error: message,
    });
  }
}
