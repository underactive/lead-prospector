import { corsHeaders } from '../_shared/cors.ts';
import { createUserClient } from '../_shared/supabase-client.ts';
import type { Firm, Contact } from '../_shared/types.ts';

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

    // ---------- fetch firms (RLS-scoped to user) ----------
    let firmsQuery = supabase
      .from('firms')
      .select('*')
      .order('distance_miles', { ascending: true });

    if (campaign) {
      firmsQuery = firmsQuery.eq('campaign', campaign);
    }
    if (status) {
      firmsQuery = firmsQuery.eq('scrape_status', status);
    }

    const { data: firms, error: firmsError } = await firmsQuery;

    if (firmsError) {
      throw firmsError;
    }

    // ---------- for each firm, get best contact ----------
    const rows: string[] = [];

    // CSV header
    rows.push(
      [
        'Firm',
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

    for (const firm of (firms as Firm[]) ?? []) {
      // Best contact = highest seniority_score
      const { data: contacts } = await supabase
        .from('contacts')
        .select('*')
        .eq('firm_id', firm.id)
        .order('seniority_score', { ascending: false })
        .limit(1);

      const contact: Contact | null = contacts?.[0] ?? null;

      const csvRow = [
        escapeCsv(firm.name),
        escapeCsv(firm.address ?? ''),
        escapeCsv(firm.city ?? ''),
        escapeCsv(firm.state ?? ''),
        escapeCsv(firm.zip ?? ''),
        escapeCsv(firm.phone ?? ''),
        escapeCsv(firm.website ?? ''),
        escapeCsv(firm.linkedin_url ?? ''),
        escapeCsv(contact?.name ?? ''),
        escapeCsv(contact?.title ?? ''),
        escapeCsv(contact?.email ?? ''),
        firm.distance_miles != null ? firm.distance_miles.toFixed(1) : '',
        escapeCsv(firm.campaign),
        firm.rating != null ? String(firm.rating) : '',
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
