// api/district.js — Vercel Serverless Function
// "Find My District" — returns structured district + rep data for a Georgia address
// Uses Google Civic divisionsByAddress (new endpoint, reps API was shut down April 2025)
// Then enriches with OpenStates for rep names, party, contact info

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'GET') return res.status(200).json({ status: 'district endpoint alive', method: 'POST required' });
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { address } = req.body || {};
  if (!address || typeof address !== 'string') {
    return res.status(400).json({ error: 'Address is required.' });
  }

  const civicKey = process.env.GOOGLE_CIVIC_API_KEY;
  const openStatesKey = process.env.OPENSTATES_API_KEY;

  const fullAddress = address.includes('Georgia') || address.includes(', GA')
    ? address
    : `${address}, Georgia`;

  // ── STEP 1: Get OCD division IDs from Google Civic divisionsByAddress
  let districtInfo = {};
  let ocdIds = [];

  if (civicKey) {
    try {
      const params = new URLSearchParams({ key: civicKey, address: fullAddress });
      const divRes = await fetch(`https://www.googleapis.com/civicinfo/v2/divisionsByAddress?${params}`);
      const divData = await divRes.json();

      if (divRes.ok && divData.divisions) {
        for (const ocdId of Object.keys(divData.divisions)) {
          ocdIds.push(ocdId);
          const cdMatch  = ocdId.match(/\/cd:(\d+)/);
          const slduMatch = ocdId.match(/\/sldu:(\d+)/);
          const sldlMatch = ocdId.match(/\/sldl:(\d+)/);
          if (cdMatch)   districtInfo.congressional = `District ${cdMatch[1]}`;
          if (slduMatch) districtInfo.stateSenate    = `District ${slduMatch[1]}`;
          if (sldlMatch) districtInfo.stateHouse     = `District ${sldlMatch[1]}`;
        }
      }
    } catch (err) {
      console.error('divisionsByAddress error:', err.message);
    }
  }

  // ── STEP 2: Get reps from OpenStates using district numbers
  const grouped = {
    country: [],
    administrativeArea1: [],
    administrativeArea2: [],
  };

  if (openStatesKey) {
    try {
      // Build district-specific queries from what we found
      const queries = [];

      if (districtInfo.congressional) {
        const num = districtInfo.congressional.replace('District ', '');
        queries.push(
          fetch(`https://v3.openstates.org/people?jurisdiction=ocd-jurisdiction/country:us/state:ga/government&district=${num}&org_classification=legislature&per_page=5`, {
            headers: { 'X-API-KEY': openStatesKey, 'Accept': 'application/json' }
          })
        );
      }

      // Get all GA state legislators (senate + house) — filter by district client-side
      queries.push(
        fetch(`https://v3.openstates.org/people?jurisdiction=ocd-jurisdiction/country:us/state:ga/government&per_page=20`, {
          headers: { 'X-API-KEY': openStatesKey, 'Accept': 'application/json' }
        })
      );

      const results = await Promise.all(queries);

      for (const r of results) {
        if (!r.ok) continue;
        const d = await r.json();
        for (const p of (d.results || [])) {
          const role = p.current_role;
          if (!role) continue;

          const rep = {
            office: `${role.title} — ${role.org_classification === 'upper' ? 'State Senate' : 'State House'} District ${role.district}`,
            name: p.name,
            party: p.party || 'Not listed',
            phone: null,
            website: p.links?.[0]?.url || null,
            email: p.email || null,
          };

          // Match to user's districts
          const isSenate = role.org_classification === 'upper';
          const isHouse  = role.org_classification === 'lower';
          const distNum  = String(role.district);

          const userSenateNum = districtInfo.stateSenate?.replace('District ', '');
          const userHouseNum  = districtInfo.stateHouse?.replace('District ', '');

          if (isSenate && distNum === userSenateNum) grouped.administrativeArea1.push(rep);
          if (isHouse  && distNum === userHouseNum)  grouped.administrativeArea1.push(rep);
        }
      }
    } catch (err) {
      console.error('OpenStates error:', err.message);
    }
  }

  // ── STEP 3: Add US Congress members from OpenStates (federal level)
  if (openStatesKey && districtInfo.congressional) {
    try {
      const cdNum = districtInfo.congressional.replace('District ', '');
      const fedRes = await fetch(
        `https://v3.openstates.org/people?jurisdiction=ocd-jurisdiction/country:us/government&district=${cdNum}&per_page=5`,
        { headers: { 'X-API-KEY': openStatesKey, 'Accept': 'application/json' } }
      );
      if (fedRes.ok) {
        const fedData = await fedRes.json();
        for (const p of (fedData.results || [])) {
          grouped.country.push({
            office: `U.S. ${p.current_role?.title || 'Representative'} — ${districtInfo.congressional}`,
            name: p.name,
            party: p.party || 'Not listed',
            phone: null,
            website: p.links?.[0]?.url || null,
            email: p.email || null,
          });
        }
      }
    } catch (err) {
      console.error('OpenStates federal error:', err.message);
    }
  }

  const LEVEL_ORDER  = ['country', 'administrativeArea1', 'administrativeArea2'];
  const LEVEL_LABELS = {
    country: 'Federal',
    administrativeArea1: 'State',
    administrativeArea2: 'County / Local',
  };

  return res.status(200).json({
    normalizedAddress: fullAddress,
    districtInfo,
    ocdIds,
    representatives: grouped,
    levelOrder: LEVEL_ORDER,
    levelLabels: LEVEL_LABELS,
  });
}
