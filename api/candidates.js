// api/candidates.js — Vercel Serverless Function
// Queries qualified_candidates table in Supabase
// All filters (search, party, county) always work together

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'candidates endpoint alive' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const { search, county, party, limit = 100, offset = 0 } = req.body || {};

  try {
    // Always query the table directly so search + filters always work together
    const params = new URLSearchParams({
      select: 'id,contest_name,county,municipality,candidate_name,candidate_status,political_party,qualified_date,incumbent,occupation,email_address,website',
      order: 'county.asc,contest_name.asc,candidate_name.asc',
      limit: String(Math.min(limit, 200)),
      offset: String(offset),
    });

    // Always filter to qualified candidates only
    params.append('candidate_status', 'ilike.*Qualified*');

    // Party filter
    if (party && party !== 'All') {
      params.append('political_party', `ilike.*${party}*`);
    }

    // County filter
    if (county && county !== 'All') {
      params.append('county', `ilike.*${county}*`);
    }

    // Text search across name, contest, county, municipality using Supabase `or`
    if (search && search.trim().length >= 2) {
      const q = search.trim().replace(/[%_]/g, '\\$&'); // escape wildcards
      params.append('or', `(candidate_name.ilike.*${q}*,contest_name.ilike.*${q}*,county.ilike.*${q}*,municipality.ilike.*${q}*)`);
    }

    const headers = {
      'apikey': supabaseKey,
      'Authorization': `Bearer ${supabaseKey}`,
      'Content-Type': 'application/json',
    };

    // Run data fetch and count fetch in parallel
    const [dataRes, countRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/qualified_candidates?${params}`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/qualified_candidates?${params}&select=id`, {
        headers: { ...headers, 'Prefer': 'count=exact' },
      }),
    ]);

    const data = await dataRes.json();

    if (!dataRes.ok) {
      return res.status(502).json({ error: data.message || 'Supabase query failed', detail: data });
    }

    const countRange = countRes.headers.get('content-range');
    const total = countRange ? parseInt(countRange.split('/')[1]) || null : null;

    return res.status(200).json({
      candidates: Array.isArray(data) ? data : [],
      total,
    });

  } catch (err) {
    console.error('Candidates API error:', err.message);
    return res.status(500).json({ error: `Candidates lookup failed: ${err.message}` });
  }
}
