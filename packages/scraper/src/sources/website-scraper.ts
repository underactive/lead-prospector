import * as cheerio from "cheerio";
import { websiteLimiter } from "../pipeline/rate-limiter.js";
import type { ExtractedContact } from "../types.js";

/** Patterns for links likely leading to team/staff pages */
const STAFF_LINK_PATTERNS = [
  /\bteam\b/i,
  /\babout\b/i,
  /\bstaff\b/i,
  /\bpeople\b/i,
  /\battorneys?\b/i,
  /\bour-team\b/i,
  /\bprofessionals?\b/i,
  /\bmembers?\b/i,
];

/** Titles we want to extract — non-attorney support staff */
const TARGET_TITLE_PATTERNS = [
  /paralegal/i,
  /senior\s+paralegal/i,
  /office\s+manager/i,
  /legal\s+assistant/i,
  /immigration\s+specialist/i,
  /legal\s+secretary/i,
  /case\s+manager/i,
  /intake\s+coordinator/i,
  /administrative\s+assistant/i,
];

/** Titles we explicitly exclude — these are attorneys */
const EXCLUDE_TITLE_PATTERNS = [
  /\battorney\b/i,
  /\bpartner\b/i,
  /\bassociate\b/i,
  /\bj\.?d\.?\b/i,
  /\besq\.?\b/i,
  /\bcounsel\b/i,
  /\blawyer\b/i,
  /\bof\s+counsel\b/i,
];

/** Email regex pattern */
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Phone regex pattern */
const PHONE_REGEX = /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

/**
 * Score the seniority of a contact based on their title.
 */
function scoreSeniority(title: string): number {
  const lower = title.toLowerCase();
  if (/senior\s+paralegal/i.test(lower)) return 3;
  if (/office\s+manager/i.test(lower)) return 3;
  if (/immigration\s+specialist/i.test(lower)) return 2;
  if (/case\s+manager/i.test(lower)) return 2;
  if (/paralegal/i.test(lower)) return 2;
  if (/legal\s+assistant/i.test(lower)) return 1;
  if (/intake\s+coordinator/i.test(lower)) return 1;
  if (/legal\s+secretary/i.test(lower)) return 1;
  if (/administrative/i.test(lower)) return 1;
  return 0;
}

/**
 * Check if a title matches a target non-attorney role.
 */
function isTargetTitle(title: string): boolean {
  return TARGET_TITLE_PATTERNS.some((p) => p.test(title));
}

/**
 * Check if a title should be excluded (attorney roles).
 */
function isExcludedTitle(title: string): boolean {
  return EXCLUDE_TITLE_PATTERNS.some((p) => p.test(title));
}

/**
 * Fetch a URL with rate limiting and return the HTML body.
 */
async function fetchPage(url: string): Promise<string | null> {
  try {
    await websiteLimiter.acquire();

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.warn(`[website-scraper] HTTP ${response.status} for ${url}`);
      return null;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return null;
    }

    return await response.text();
  } catch (error) {
    console.warn(
      `[website-scraper] Failed to fetch ${url}:`,
      error instanceof Error ? error.message : error
    );
    return null;
  }
}

/**
 * Resolve a potentially relative URL against a base URL.
 */
function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return null;
  }
}

/**
 * Extract emails from page HTML.
 */
function extractEmails($: cheerio.CheerioAPI): string[] {
  const emails = new Set<string>();

  // From mailto: links
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const email = href.replace("mailto:", "").split("?")[0].trim();
    if (email) emails.add(email.toLowerCase());
  });

  // From page text content
  const bodyText = $("body").text();
  const matches = bodyText.match(EMAIL_REGEX);
  if (matches) {
    for (const email of matches) {
      // Filter out common false positives
      if (
        !email.includes("example.com") &&
        !email.includes("sentry.io") &&
        !email.includes("wixpress.com")
      ) {
        emails.add(email.toLowerCase());
      }
    }
  }

  return Array.from(emails);
}

/**
 * Extract contacts from a parsed HTML page.
 */
function extractContactsFromPage(
  $: cheerio.CheerioAPI,
  sourceUrl: string
): ExtractedContact[] {
  const contacts: ExtractedContact[] = [];
  const emails = extractEmails($);

  // Strategy: look for elements that contain a person's name and title together.
  // Common patterns:
  //   <div class="team-member"><h3>Name</h3><p>Title</p></div>
  //   <li><strong>Name</strong> - Title</li>

  // Collect text blocks that might describe staff
  const textBlocks: { text: string; context: string }[] = [];

  // Look in common team listing containers
  const selectors = [
    ".team-member",
    ".staff-member",
    ".attorney-card",
    ".person",
    ".bio",
    '[class*="team"]',
    '[class*="staff"]',
    '[class*="member"]',
    "article",
    ".card",
    "li",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = $(el).text().replace(/\s+/g, " ").trim();
      if (text.length > 10 && text.length < 500) {
        textBlocks.push({ text, context: selector });
      }
    });
  }

  // Also scan heading + paragraph pairs
  $("h2, h3, h4").each((_, el) => {
    const name = $(el).text().trim();
    const nextText = $(el).next("p, span, div").text().trim();
    if (name && nextText) {
      textBlocks.push({
        text: `${name} | ${nextText}`,
        context: "heading-pair",
      });
    }
  });

  // Parse text blocks for name-title pairs
  for (const block of textBlocks) {
    // Split on common delimiters
    const parts = block.text.split(/[|\-\u2013\u2014,\n]/);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();

      if (isTargetTitle(part) && !isExcludedTitle(part)) {
        // The title is this part — the name is likely the preceding part
        const possibleName = i > 0 ? parts[i - 1].trim() : null;

        if (possibleName && possibleName.length > 2 && possibleName.length < 60) {
          // Find a likely email for this person
          const nameParts = possibleName.toLowerCase().split(/\s+/);
          const matchedEmail = emails.find(
            (e) =>
              nameParts.some((np) => e.includes(np)) ||
              e.includes(nameParts[0]?.[0] + nameParts[nameParts.length - 1])
          );

          // Extract any phone near this text
          const phoneMatches = block.text.match(PHONE_REGEX);

          contacts.push({
            name: possibleName,
            title: part,
            email: matchedEmail ?? null,
            phone: phoneMatches?.[0] ?? null,
            linkedin_url: null,
            source: sourceUrl,
            confidence: matchedEmail ? 0.8 : 0.5,
            seniority_score: scoreSeniority(part),
          });
        }
      }
    }
  }

  return contacts;
}

/**
 * Scrape a firm's website for staff/team pages and extract non-attorney contacts.
 *
 * @param url  The firm's homepage URL
 * @returns Staff page URL (if found) and extracted contacts
 */
/**
 * Extract a LinkedIn company page URL from a parsed HTML page.
 * Looks for links pointing to linkedin.com/company/ in the page.
 */
function extractLinkedInUrl($: cheerio.CheerioAPI): string | null {
  let linkedinUrl: string | null = null;

  $('a[href*="linkedin.com"]').each((_, el) => {
    if (linkedinUrl) return; // already found
    const href = $(el).attr("href");
    if (href && /linkedin\.com\/company\//i.test(href)) {
      // Clean up tracking params
      try {
        const parsed = new URL(href);
        linkedinUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "");
      } catch {
        linkedinUrl = href;
      }
    }
  });

  return linkedinUrl;
}

export async function scrapeWebsite(
  url: string
): Promise<{ staffPageUrl?: string; linkedinUrl?: string; contacts: ExtractedContact[] }> {
  const allContacts: ExtractedContact[] = [];
  let staffPageUrl: string | undefined;
  let linkedinUrl: string | undefined;

  console.log(`[website-scraper] Scraping ${url}`);

  // Phase 1: Fetch the homepage
  const homepageHtml = await fetchPage(url);
  if (!homepageHtml) {
    return { contacts: [] };
  }

  const $home = cheerio.load(homepageHtml);

  // Extract LinkedIn company URL from homepage
  const foundLinkedIn = extractLinkedInUrl($home);
  if (foundLinkedIn) {
    linkedinUrl = foundLinkedIn;
  }

  // Extract contacts from the homepage itself
  const homepageContacts = extractContactsFromPage($home, url);
  allContacts.push(...homepageContacts);

  // Phase 2: Find and scrape staff/team pages
  const staffLinks: string[] = [];

  $home("a[href]").each((_, el) => {
    const href = $home(el).attr("href");
    const linkText = $home(el).text().toLowerCase();
    if (!href) return;

    const resolved = resolveUrl(href, url);
    if (!resolved) return;

    // Check if the link text or URL matches staff page patterns
    const isStaffLink =
      STAFF_LINK_PATTERNS.some((p) => p.test(linkText)) ||
      STAFF_LINK_PATTERNS.some((p) => p.test(href));

    if (isStaffLink && !staffLinks.includes(resolved)) {
      staffLinks.push(resolved);
    }
  });

  // Fetch up to 3 staff-related pages
  const pagesToScrape = staffLinks.slice(0, 3);

  for (const staffUrl of pagesToScrape) {
    console.log(`[website-scraper] Following staff link: ${staffUrl}`);

    const html = await fetchPage(staffUrl);
    if (!html) continue;

    if (!staffPageUrl) {
      staffPageUrl = staffUrl;
    }

    const $ = cheerio.load(html);
    const pageContacts = extractContactsFromPage($, staffUrl);
    allContacts.push(...pageContacts);
  }

  // Deduplicate contacts by name
  const seen = new Set<string>();
  const uniqueContacts = allContacts.filter((c) => {
    const key = c.name.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(
    `[website-scraper] Found ${uniqueContacts.length} contacts from ${url}${linkedinUrl ? ` (LinkedIn: ${linkedinUrl})` : ""}`
  );
  return { staffPageUrl, linkedinUrl, contacts: uniqueContacts };
}
