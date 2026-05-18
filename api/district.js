// api/district.js — Vercel Serverless Function
// "Find My District" — returns structured district + rep data for a Georgia address
// Uses Google Civic representativeInfoByAddress (no AI, no search quota used)

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

  const key = process.env.GOOGLE_CIVIC_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Google Civic API key not configured.', debug: { hasKey: false } });
  }

  const fullAddress = address.includes('Georgia') || address.includes(', GA')
    ? address
    : `${address}, Georgia`;

  try {
    // Google Civic representativeInfoByAddress — GET request
    // Docs: https://developers.google.com/civic-information/docs/v2/representatives/representativeInfoByAddress
    const params = new URLSearchParams({ key, address: fullAddress });

    const civicRes = await fetch(
      `https://www.googleapis.com/civicinfo/v2/representatives?${params}`
    );
    const civicData = await civicRes.json();

    if (!civicRes.ok) {
      const msg = civicData.error?.message || 'Google Civic API error';
      // 404 "Method not found" = Civic Information API not enabled in Google Cloud Console
      // Fix: console.cloud.google.com → APIs & Services → Enable "Google Civic Information API"
      if (civicRes.status === 404) {
        return res.status(502).json({
          error: 'Representative lookup is unavailable. The Google Civic Information API may not be enabled for this key.',
          civicStatus: civicRes.status,
          civicError: civicData.error,
          fix: 'Enable the Civic Information API at console.cloud.google.com → APIs & Services → Library',
        });
      }
      return res.status(502).json({ error: msg, civicStatus: civicRes.status, civicError: civicData.error });
    }

    if (civicData.error) {
      return res.status(502).json({ error: civicData.error.message });
    }

    const offices = civicData.offices || [];
    const officials = civicData.officials || [];
    const divisions = civicData.divisions || {};

    // Build structured district cards grouped by level
    const LEVEL_ORDER = ['country', 'administrativeArea1', 'administrativeArea2', 'locality'];
    const LEVEL_LABELS = {
      country: 'Federal',
      administrativeArea1: 'State',
      administrativeArea2: 'County',
      locality: 'Local',
    };

    const grouped = {};
    for (const office of offices) {
      const level = office.levels?.[0] || 'other';
      if (!grouped[level]) grouped[level] = [];

      for (const idx of (office.officialIndices || [])) {
        const o = officials[idx];
        if (!o) continue;
        grouped[level].push({
          office: office.name,
          name: o.name,
          party: o.party || 'Not listed',
          phone: o.phones?.[0] || null,
          website: o.urls?.[0] || null,
          email: o.emails?.[0] || null,
          photoUrl: o.photoUrl || null,
          channels: (o.channels || []).map(c => ({ type: c.type, id: c.id })),
        });
      }
    }

    // Extract district numbers from division keys
    // e.g. ocd-division/country:us/state:ga/cd:6  → Congressional District 6
    const districtInfo = {};
    for (const [divId] of Object.entries(divisions)) {
      const cdMatch = divId.match(/\/cd:(\d+)/);
      const slduMatch = divId.match(/\/sldu:(\d+)/);
      const sldlMatch = divId.match(/\/sldl:(\d+)/);
      if (cdMatch) districtInfo.congressional = `District ${cdMatch[1]}`;
      if (slduMatch) districtInfo.stateSenate = `District ${slduMatch[1]}`;
      if (sldlMatch) districtInfo.stateHouse = `District ${sldlMatch[1]}`;
    }

    // Normalized address Google returned
    const normalizedAddress = civicData.normalizedInput
      ? [
          civicData.normalizedInput.line1,
          civicData.normalizedInput.city,
          civicData.normalizedInput.state,
          civicData.normalizedInput.zip,
        ].filter(Boolean).join(', ')
      : fullAddress;

    return res.status(200).json({
      normalizedAddress,
      districtInfo,
      representatives: grouped,
      levelOrder: LEVEL_ORDER,
      levelLabels: LEVEL_LABELS,
    });

  } catch (err) {
    console.error('District lookup error:', err.message);
    return res.status(500).json({ error: `District lookup failed: ${err.message}`, stack: err.stack?.split('\n')[0] });
  }
}
