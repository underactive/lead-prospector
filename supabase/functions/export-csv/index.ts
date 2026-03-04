import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase-client.ts';
import type { Business, Contact } from '../_shared/types.ts';

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ---------- auth ----------
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createUserClient(authHeader);

    // Verify the user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ---------- query params ----------
    const url = new URL(req.url);
    const campaign = url.searchParams.get('campaign');
    const status = url.searchParams.get('status');
    const jobId = url.searchParams.get('job_id');

    // ---------- fetch businesses (RLS-scoped to user) ----------
    let businessesQuery = supabase
      .from('businesses')
      .select('*')
      .order('distance_miles', { ascending: true });

    if (jobId) {
      businessesQuery = businessesQuery.eq('job_id', jobId);
    }
    if (campaign) {
      businessesQuery = businessesQuery.eq('campaign', campaign);
    }
    if (status) {
      businessesQuery = businessesQuery.eq('scrape_status', status);
    }

    const { data: businesses, error: businessesError } = await businessesQuery;

    if (businessesError) {
      throw businessesError;
    }

    // ---------- for each business, get best contact ----------
    const rows: string[] = [];

    // CSV header
    rows.push(
      [
        'Business',
        'Address',
        'City',
        'State',
        'ZIP',
        'Phone',
        'Website',
        'LinkedIn',
        'Contact Name',
        'Title',
        'Email',
        'Distance',
        'Campaign',
        'Rating',
      ].join(','),
    );

    for (const business of (businesses as Business[]) ?? []) {
      // Best contact = highest seniority_score
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('business_id', business.id)
        .order('seniority_score', { ascending: false })
        .limit(1);

      const contact: Contact | null = contacts?.[0] ?? null;

      const csvRow = [
        escapeCsv(business.name),
        escapeCsv(business.address ?? ''),
        escapeCsv(business.city ?? ''),
        escapeCsv(business.state ?? ''),
        escapeCsv(business.zip ?? ''),
        escapeCsv(business.phone ?? ''),
        escapeCsv(business.website ?? ''),
        escapeCsv(business.linkedin_url ?? ''),
        escapeCsv(contact?.name ?? ''),
        escapeCsv(contact?.title ?? ''),
        escapeCsv(contact?.email ?? ''),
        business.distance_miles != null ? business.distance_miles.toFixed(1) : '',
        escapeCsv(business.campaign),
        business.rating != null ? String(business.rating) : '',
      ].join(',');

      rows.push(csvRow);
    }

    const csv = rows.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="leads-export.csv"',
      },
    });
  } catch (err) {
    console.error('export-csv error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/** Escape a value for CSV — wrap in double-quotes if it contains commas, quotes, or newlines. */
function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
