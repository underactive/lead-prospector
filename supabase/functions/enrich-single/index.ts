import { corsHeaders } from '../_shared/cors.ts';
import { createServiceClient, createUserClient } from '../_shared/supabase-client.ts';
import type { Firm } from '../_shared/types.ts';

/** Titles we want to capture as contacts. */
const TARGET_TITLES_RE =
  /\b(senior\s+paralegal|paralegal|office\s+manager|legal\s+assistant)\b/i;

/** Titles we explicitly exclude — attorneys and lawyers. */
const EXCLUDE_TITLES_RE =
  /\b(attorney|partner|associate|j\.?d\.?|esq\.?|lawyer|counsel|of\s+counsel)\b/i;

/** Seniority scoring map. */
function seniorityScore(title: string): number {
  const t = title.toLowerCase();
  if (/senior\s+paralegal/.test(t)) return 3;
  if (/office\s+manager/.test(t)) return 3;
  if (/\bparalegal\b/.test(t)) return 2;
  if (/legal\s+assistant/.test(t)) return 1;
  return 0;
}

/** Extract email addresses from a block of text / HTML. */
function extractEmails(html: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  // mailto: links
  const mailtoRe = /mailto:([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})/gi;
  let m: RegExpExecArray | null;
  while ((m = mailtoRe.exec(html)) !== null) {
    const email = m[1].toLowerCase();
    if (!seen.has(email)) {
      seen.add(email);
      results.push(email);
    }
  }

  // Bare email patterns (not already captured via mailto)
  const bareRe = /\b([a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,})\b/g;
  while ((m = bareRe.exec(html)) !== null) {
    const email = m[1].toLowerCase();
    // Skip common false-positives
    if (email.endsWith('.png') || email.endsWith('.jpg') || email.endsWith('.svg')) continue;
    if (!seen.has(email)) {
      seen.add(email);
      results.push(email);
    }
  }

  return results;
}

/** Find links to team/staff/about pages. */
function findTeamLinks(html: string, baseUrl: string): string[] {
  const linkRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const teamKeywords = /\b(team|staff|people|about|personnel|our-team|attorneys|professionals)\b/i;
  const links: string[] = [];
  const seen = new Set<string>();

  let m: RegExpExecArray | null;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, ''); // strip inner HTML
    if (teamKeywords.test(href) || teamKeywords.test(text)) {
      try {
        const resolved = new URL(href, baseUrl).toString();
        if (!seen.has(resolved)) {
          seen.add(resolved);
          links.push(resolved);
        }
      } catch {
        // skip malformed URLs
      }
    }
  }

  return links;
}

interface ExtractedContact {
  name: string;
  title: string;
  email: string | null;
}

/**
 * Extract contacts from HTML text. Looks for patterns like:
 *   Name - Title
 *   Name, Title
 *   <h2>Name</h2><p>Title</p>
 * Then matches nearby emails.
 */
function extractContacts(html: string): ExtractedContact[] {
  const contacts: ExtractedContact[] = [];
  const allEmails = extractEmails(html);

  // Strip HTML tags for text-based extraction
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  // Pattern: "Name - Title" or "Name, Title" where Title matches our targets
  const nameAndTitleRe =
    /([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[-,|]\s*((?:Senior\s+)?Paralegal|Office\s+Manager|Legal\s+Assistant)/gi;

  let m: RegExpExecArray | null;
  while ((m = nameAndTitleRe.exec(text)) !== null) {
    const name = m[1].trim();
    const title = m[2].trim();

    // Skip if the surrounding context reveals this is really an attorney
    const contextStart = Math.max(0, m.index - 100);
    const contextEnd = Math.min(text.length, m.index + m[0].length + 100);
    const context = text.slice(contextStart, contextEnd);
    if (EXCLUDE_TITLES_RE.test(context.replace(TARGET_TITLES_RE, ''))) {
      continue;
    }

    // Try to find an email near this person's name
    let bestEmail: string | null = null;
    const nameParts = name.toLowerCase().split(/\s+/);
    for (const email of allEmails) {
      const emailLower = email.toLowerCase();
      // Check if the email contains any part of the person's name
      if (nameParts.some((part) => part.length > 2 && emailLower.includes(part))) {
        bestEmail = email;
        break;
      }
    }

    contacts.push({ name, title, email: bestEmail });
  }

  // Additional pattern: structured HTML like <h3>Name</h3> ... <span>Title</span>
  const structuredRe =
    /<(?:h[2-4]|strong|b)[^>]*>\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*<\/(?:h[2-4]|strong|b)>[\s\S]{0,200}?((?:Senior\s+)?Paralegal|Office\s+Manager|Legal\s+Assistant)/gi;

  while ((m = structuredRe.exec(html)) !== null) {
    const name = m[1].trim();
    const title = m[2].trim();

    // Avoid duplicates
    if (contacts.some((c) => c.name === name)) continue;

    let bestEmail: string | null = null;
    const nameParts = name.toLowerCase().split(/\s+/);
    for (const email of allEmails) {
      const emailLower = email.toLowerCase();
      if (nameParts.some((part) => part.length > 2 && emailLower.includes(part))) {
        bestEmail = email;
        break;
      }
    }

    contacts.push({ name, title, email: bestEmail });
  }

  return contacts;
}

/** Fetch a page with timeout and return its HTML, or null on failure. */
async function fetchPage(url: string, signal: AbortSignal): Promise<string | null> {
  try {
    const resp = await fetch(url, {
      signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; LeadProspector/1.0; +https://example.com/bot)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!resp.ok) return null;
    const contentType = resp.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html') && !contentType.includes('text/plain')) return null;
    return await resp.text();
  } catch {
    return null;
  }
}

// ─── Edge function entry ─────────────────────────────────────────
Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  // 25-second timeout guard
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  try {
    // ---------- auth ----------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userClient = createUserClient(authHeader);
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- body ----------
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { firmId } = (await req.json()) as { firmId: string };
    if (!firmId) {
      return new Response(JSON.stringify({ error: 'firmId is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- verify firm ownership (via RLS) ----------
    const { data: firm, error: firmError } = await userClient
      .from('firms')
      .select('*')
      .eq('id', firmId)
      .single();

    if (firmError || !firm) {
      return new Response(JSON.stringify({ error: 'Firm not found or access denied' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const typedFirm = firm as Firm;

    if (!typedFirm.website) {
      return new Response(
        JSON.stringify({ error: 'Firm has no website to enrich from' }),
        {
          status: 422,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // ---------- mark as enriching ----------
    const serviceClient = createServiceClient();

    await serviceClient
      .from('firms')
      .update({ scrape_status: 'enriching' })
      .eq('id', firmId);

    // ---------- fetch homepage ----------
    let baseUrl = typedFirm.website;
    if (!/^https?:\/\//i.test(baseUrl)) {
      baseUrl = `https://${baseUrl}`;
    }

    const homepageHtml = await fetchPage(baseUrl, controller.signal);
    if (!homepageHtml) {
      await serviceClient
        .from('firms')
        .update({ scrape_status: 'failed', scrape_error: 'Failed to fetch homepage' })
        .eq('id', firmId);

      return new Response(
        JSON.stringify({ error: 'Failed to fetch firm website' }),
        {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      );
    }

    // Collect all HTML to search through
    const pagesToParse: string[] = [homepageHtml];

    // ---------- find and fetch team/staff/about pages ----------
    const teamLinks = findTeamLinks(homepageHtml, baseUrl);

    // Fetch up to 3 team-related pages
    for (const link of teamLinks.slice(0, 3)) {
      if (controller.signal.aborted) break;
      const pageHtml = await fetchPage(link, controller.signal);
      if (pageHtml) {
        pagesToParse.push(pageHtml);
      }
    }

    // ---------- extract contacts from all pages ----------
    const allContacts: ExtractedContact[] = [];
    const seenNames = new Set<string>();

    for (const pageHtml of pagesToParse) {
      const extracted = extractContacts(pageHtml);
      for (const contact of extracted) {
        if (!seenNames.has(contact.name.toLowerCase())) {
          seenNames.add(contact.name.toLowerCase());
          allContacts.push(contact);
        }
      }
    }

    // ---------- upsert contacts ----------
    const upsertedContacts: Array<{ name: string; title: string; email: string | null }> = [];

    for (const contact of allContacts) {
      const score = seniorityScore(contact.title);

      const { error: upsertError } = await serviceClient.from('contacts').upsert(
        {
          user_id: user.id,
          firm_id: firmId,
          name: contact.name,
          title: contact.title,
          email: contact.email,
          source: 'website' as const,
          confidence: contact.email ? ('high' as const) : ('medium' as const),
          seniority_score: score,
        },
        { onConflict: 'firm_id,name', ignoreDuplicates: false },
      );

      if (!upsertError) {
        upsertedContacts.push({
          name: contact.name,
          title: contact.title,
          email: contact.email,
        });
      }
    }

    // ---------- update firm status ----------
    await serviceClient
      .from('firms')
      .update({
        scrape_status: 'enriched',
        enriched_at: new Date().toISOString(),
        scrape_error: null,
      })
      .eq('id', firmId);

    clearTimeout(timeout);

    return new Response(
      JSON.stringify({
        success: true,
        firmId,
        pagesScraped: pagesToParse.length,
        contactsFound: allContacts.length,
        contactsUpserted: upsertedContacts.length,
        contacts: upsertedContacts,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (err) {
    clearTimeout(timeout);

    const isAbort = err instanceof DOMException && err.name === 'AbortError';
    const message = isAbort ? 'Enrichment timed out (25s)' : 'Internal server error';
    const statusCode = isAbort ? 504 : 500;

    console.error('enrich-single error:', err);

    // Best-effort: mark firm as failed
    try {
      const { firmId } = (await req.clone().json().catch(() => ({}))) as { firmId?: string };
      if (firmId) {
        const serviceClient = createServiceClient();
        await serviceClient
          .from('firms')
          .update({ scrape_status: 'failed', scrape_error: message })
          .eq('id', firmId);
      }
    } catch {
      // ignore cleanup errors
    }

    return new Response(JSON.stringify({ error: message }), {
      status: statusCode,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
