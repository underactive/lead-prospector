import { config } from "../config.js";
import { supabase } from "../supabase.js";
import { haversineDistance, categorizeCampaign } from "../geo/haversine.js";
import { discoverViaPlacesAPI } from "../sources/google-places.js";
import { discoverViaMapsScraping } from "../sources/google-maps-scraper.js";
import { scrapeWebsite } from "../sources/website-scraper.js";
import { searchYelp } from "../sources/yelp.js";
import { jobQueue } from "./job-queue.js";
import type { DiscoveredFirm, ExtractedContact, JobStartPayload } from "../types.js";

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
 * Update a firm record in Supabase.
 */
async function updateFirm(
  firmId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("firms")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", firmId);

  if (error) {
    console.error(`[orchestrator] Failed to update firm ${firmId}:`, error.message);
  }
}

// ─── Phase 1: Discovery ────────────────────────────────────────────────

async function discoverFirms(
  payload: JobStartPayload,
  centerLat: number,
  centerLng: number,
  log: LogFn
): Promise<DiscoveredFirm[]> {
  log(`Phase 1 — Discovery (mode: ${payload.mode}, location: ${payload.searchLocation})`);

  let firms: DiscoveredFirm[];

  if (payload.mode === "api" && config.GOOGLE_PLACES_API_KEY) {
    const radiusMeters = payload.campaign === "local" ? 16000 : 50000;
    log(`Querying Google Places API (radius: ${radiusMeters}m)`);
    firms = await discoverViaPlacesAPI(centerLat, centerLng, radiusMeters);
  } else {
    const query = `immigration lawyer near ${payload.searchLocation}`;
    log(`Scraping Google Maps: "${query}"`);
    firms = await discoverViaMapsScraping(query, centerLat, centerLng);

    if (firms.length === 0 && config.GOOGLE_PLACES_API_KEY) {
      log(`Scraping returned 0 results — falling back to Google Places API`);
      const radiusMeters = payload.campaign === "local" ? 16000 : 50000;
      firms = await discoverViaPlacesAPI(centerLat, centerLng, radiusMeters);
    }
  }

  // Calculate distances and filter by campaign
  const firmsWithDistance = firms.map((firm) => {
    const distance =
      firm.lat != null && firm.lng != null
        ? haversineDistance(centerLat, centerLng, firm.lat, firm.lng)
        : null;
    const campaign = distance != null ? categorizeCampaign(distance) : null;
    return { ...firm, distance, campaign };
  });

  const filtered = firmsWithDistance.filter((f) => {
    if (f.distance == null) return true;
    if (payload.campaign === "local") return f.distance < 10;
    if (payload.campaign === "remote") return f.distance > 25;
    return true;
  });

  log(`Discovered ${firms.length} firms, ${filtered.length} match campaign "${payload.campaign}"`);

  return filtered;
}

/**
 * Upsert discovered firms into Supabase and return the inserted/updated IDs.
 */
async function upsertFirms(
  userId: string,
  jobId: string,
  firms: (DiscoveredFirm & { distance: number | null; campaign: string | null })[],
  log: LogFn
): Promise<{ id: string; firm: DiscoveredFirm & { distance: number | null } }[]> {
  const results: { id: string; firm: DiscoveredFirm & { distance: number | null } }[] = [];

  for (const firm of firms) {
    const row = {
      user_id: userId,
      google_place_id: firm.place_id,
      name: firm.name,
      address: firm.address,
      phone: firm.phone,
      website: firm.website,
      google_maps_url: firm.google_maps_url,
      latitude: firm.lat,
      longitude: firm.lng,
      distance_miles: firm.distance != null ? Math.round(firm.distance * 100) / 100 : null,
      rating: firm.rating,
      review_count: firm.review_count,
      campaign: firm.campaign,
      scrape_status: "discovered",
      job_id: jobId,
    };

    let result;
    if (firm.place_id) {
      result = await supabase
        .from("firms")
        .upsert(row, { onConflict: "user_id,google_place_id" })
        .select("id")
        .single();
    } else {
      result = await supabase
        .from("firms")
        .insert(row)
        .select("id")
        .single();
    }

    if (result.error) {
      log(`✗ Failed to upsert "${firm.name}": ${result.error.message}`);
      continue;
    }

    if (result.data) {
      results.push({ id: result.data.id, firm });
    }
  }

  log(`Stored ${results.length} firms in database`);
  return results;
}

// ─── Phase 2: Enrichment ───────────────────────────────────────────────

async function enrichFirm(
  firmId: string,
  firm: DiscoveredFirm,
  jobId: string,
  searchLocation: string,
  log: LogFn
): Promise<ExtractedContact[]> {
  await updateFirm(firmId, { scrape_status: "enriching" });

  const enrichmentData: Record<string, unknown> = {};
  let websiteContacts: ExtractedContact[] = [];

  try {
    // Scrape website for staff/contacts + LinkedIn URL
    if (firm.website) {
      log(`  → Scraping website: ${firm.website}`);
      try {
        const result = await scrapeWebsite(firm.website);
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
        const yelpData = await searchYelp(firm.name, searchLocation);
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

    await updateFirm(firmId, {
      ...enrichmentData,
      scrape_status: "enriched",
      enriched_at: new Date().toISOString(),
    });

    return websiteContacts;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateFirm(firmId, {
      scrape_status: "failed",
      scrape_error: message,
    });
    return [];
  }
}

// ─── Phase 3: Contact Extraction ───────────────────────────────────────

async function insertContacts(
  firmId: string,
  userId: string,
  contacts: ExtractedContact[]
): Promise<number> {
  if (contacts.length === 0) return 0;

  let insertedCount = 0;

  for (const contact of contacts) {
    const { error } = await supabase.from("contacts").insert({
      firm_id: firmId,
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
 * Phase 1: Discovery — find immigration law firms
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

  try {
    await flushJob({
      status: "running",
      started_at: new Date().toISOString(),
    });

    // ── Phase 1: Discovery ──────────────────────────────────────────

    const discovered = await discoverFirms(payload, centerLat, centerLng, log);

    if (jobQueue.isCancelled(jobId)) {
      log("Job cancelled");
      await flushJob({ status: "cancelled" });
      return;
    }

    const upsertedFirms = await upsertFirms(
      userId,
      jobId,
      discovered as (DiscoveredFirm & { distance: number | null; campaign: string | null })[],
      log
    );

    await flushJob({ firms_discovered: upsertedFirms.length });

    log(`Phase 1 complete — ${upsertedFirms.length} firms stored`);

    // ── Phase 2: Enrichment ─────────────────────────────────────────

    let firmsEnriched = 0;
    let firmsFailed = 0;
    let totalContacts = 0;
    const firmContacts = new Map<string, ExtractedContact[]>();

    const totalToEnrich = upsertedFirms.length;

    for (const { id: firmId, firm } of upsertedFirms) {
      if (jobQueue.isCancelled(jobId)) {
        log("Job cancelled");
        await flushJob({ status: "cancelled" });
        return;
      }

      const enrichIdx = firmsEnriched + firmsFailed + 1;
      log(`Enriching firm ${enrichIdx}/${totalToEnrich}: ${firm.name}`);

      try {
        const contacts = await enrichFirm(firmId, firm, jobId, payload.searchLocation, log);
        firmContacts.set(firmId, contacts);
        firmsEnriched++;
        await flushJob({ firms_enriched: firmsEnriched });
      } catch (error) {
        firmsFailed++;
        log(`✗ Enrichment failed for "${firm.name}": ${error instanceof Error ? error.message : error}`);
        await flushJob({ firms_failed: firmsFailed });
      }
    }

    log(`Phase 2 complete — ${firmsEnriched} enriched, ${firmsFailed} failed`);

    // ── Phase 3: Contact Extraction ─────────────────────────────────

    log(`Phase 3 — Inserting contacts`);

    for (const [firmId, contacts] of firmContacts) {
      if (jobQueue.isCancelled(jobId)) {
        log("Job cancelled");
        await flushJob({ status: "cancelled" });
        return;
      }

      try {
        const inserted = await insertContacts(firmId, userId, contacts);
        totalContacts += inserted;
        await flushJob({ total_contacts: totalContacts });
      } catch (error) {
        log(`✗ Contact insertion failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    log(`Phase 3 complete — ${totalContacts} contacts inserted`);

    // ── Complete ────────────────────────────────────────────────────

    const elapsed = ((Date.now() - pipelineStart) / 1000).toFixed(1);
    log(`Pipeline complete in ${elapsed}s — ${upsertedFirms.length} firms, ${firmsEnriched} enriched, ${totalContacts} contacts`);

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
