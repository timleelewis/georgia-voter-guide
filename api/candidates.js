// api/candidates.js — Vercel Serverless Function
// Queries qualified_candidates table in Supabase
// Supports: search by name/contest/county, filter by party/county, browse all

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

  const { search, county, party, contest, limit = 100, offset = 0 } = req.body || {};

  try {
    let url, body;

    if (search && search.trim().length >= 2) {
      // Use the full-text search function for name/contest/county searches
      url = `${supabaseUrl}/rest/v1/rpc/search_candidates`;
      body = { search_term: search.trim() };
    } else {
      // Browse/filter mode — query the table directly with filters
      const params = new URLSearchParams({
        select: 'id,contest_name,county,municipality,candidate_name,candidate_status,political_party,qualified_date,incumbent,occupation,email_address,website',
        candidate_status: 'eq.Qualified',
        order: 'county.asc,contest_name.asc,candidate_name.asc',
        limit: String(Math.min(limit, 200)),
        offset: String(offset),
      });

      if (county && county !== 'All') params.set('county', `ilike.*${county}*`);
      if (party && party !== 'All') params.set('political_party', `ilike.*${party}*`);
      if (contest && contest !== 'All') params.set('contest_name', `ilike.*${contest}*`);

      url = `${supabaseUrl}/rest/v1/qualified_candidates?${params}`;
      body = null;
    }

    const fetchOpts = {
      method: body ? 'POST' : 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
    };
    if (body) fetchOpts.body = JSON.stringify(body);

    const sbRes = await fetch(url, fetchOpts);
    const data = await sbRes.json();

    if (!sbRes.ok) {
      return res.status(502).json({ error: data.message || 'Supabase query failed', detail: data });
    }

    // Get total count for pagination (browse mode only)
    let total = null;
    if (!search) {
      const countParams = new URLSearchParams({
        select: 'id',
        candidate_status: 'eq.Qualified',
      });
      if (county && county !== 'All') countParams.set('county', `ilike.*${county}*`);
      if (party && party !== 'All') countParams.set('political_party', `ilike.*${party}*`);

      const countRes = await fetch(
        `${supabaseUrl}/rest/v1/qualified_candidates?${countParams}`,
        {
          headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`,
            'Prefer': 'count=exact',
          },
        }
      );
      const countRange = countRes.headers.get('content-range');
      if (countRange) total = parseInt(countRange.split('/')[1]) || null;
    }

    return res.status(200).json({ candidates: Array.isArray(data) ? data : [], total });

  } catch (err) {
    console.error('Candidates API error:', err.message);
    return res.status(500).json({ error: `Candidates lookup failed: ${err.message}` });
  }
}
