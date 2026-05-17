// // api/debug.js — Vercel Serverless Function
// // Visit /api/debug in your browser to check all API connections
// // REMOVE THIS FILE before going fully public — for testing only

// export default async function handler(req, res) {
//   res.setHeader('Access-Control-Allow-Origin', '*');

//   const results = {
//     timestamp: new Date().toISOString(),
//     environment: {
//       hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
//       hasGoogleCivicKey: !!process.env.GOOGLE_CIVIC_API_KEY,
//       hasOpenStatesKey: !!process.env.OPENSTATES_API_KEY,
//       hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
//       hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
//     },
//     apiTests: {}
//   };

//   // Test 1 — OpenStates API
//   try {
//     const url = `https://v3.openstates.org/people?jurisdiction=georgia&per_page=2`;
//     const osRes = await fetch(url, {
//       headers: {
//         'X-API-KEY': process.env.OPENSTATES_API_KEY || '',
//         'Accept': 'application/json'
//       }
//     });
//     const osData = await osRes.json();
//     results.apiTests.openStates = {
//       status: osRes.status,
//       ok: osRes.ok,
//       resultCount: osData.results?.length || 0,
//       sample: osData.results?.[0]
//         ? { name: osData.results[0].name, party: osData.results[0].party }
//         : null,
//       error: osData.detail || null,
//     };
//   } catch (err) {
//     results.apiTests.openStates = { error: err.message };
//   }

//   // Test 2 — Google Civic Elections List
//   try {
//     const url = `https://www.googleapis.com/civicinfo/v2/elections?key=${process.env.GOOGLE_CIVIC_API_KEY || ''}`;
//     const gcRes = await fetch(url);
//     const gcData = await gcRes.json();
//     const gaElections = (gcData.elections || []).filter(e =>
//       e.ocdDivisionId?.includes('state:ga') || e.name?.toLowerCase().includes('georgia')
//     );
//     results.apiTests.googleCivicElections = {
//       status: gcRes.status,
//       ok: gcRes.ok,
//       totalElections: gcData.elections?.length || 0,
//       georgiaElections: gaElections.length,
//       georgiaSample: gaElections[0] || null,
//       error: gcData.error?.message || null,
//     };
//   } catch (err) {
//     results.apiTests.googleCivicElections = { error: err.message };
//   }

//   // Test 3 — Google Civic Voter Info (test address)
//   try {
//     const testAddress = encodeURIComponent('100 Peachtree St NW, Atlanta, Georgia');
//     const url = `https://www.googleapis.com/civicinfo/v2/voterinfo?key=${process.env.GOOGLE_CIVIC_API_KEY || ''}&address=${testAddress}&returnAllAvailableData=true`;
//     const viRes = await fetch(url);
//     const viData = await viRes.json();
//     results.apiTests.googleCivicVoterInfo = {
//       status: viRes.status,
//       ok: viRes.ok,
//       electionFound: !!viData.election,
//       electionName: viData.election?.name || null,
//       pollingLocations: viData.pollingLocations?.length || 0,
//       earlyVoteSites: viData.earlyVoteSites?.length || 0,
//       contests: viData.contests?.length || 0,
//       apiStatus: viData.status || null,
//       error: viData.error?.message || null,
//     };
//   } catch (err) {
//     results.apiTests.googleCivicVoterInfo = { error: err.message };
//   }

//   // Test 4 — Anthropic API (minimal test)
//   try {
//     const antRes = await fetch('https://api.anthropic.com/v1/messages', {
//       method: 'POST',
//       headers: {
//         'Content-Type': 'application/json',
//         'x-api-key': process.env.ANTHROPIC_API_KEY || '',
//         'anthropic-version': '2023-06-01',
//       },
//       body: JSON.stringify({
//         model: 'claude-sonnet-4-6',
//         max_tokens: 10,
//         messages: [{ role: 'user', content: 'Say OK' }],
//       }),
//     });
//     const antData = await antRes.json();
//     results.apiTests.anthropic = {
//       status: antRes.status,
//       ok: antRes.ok,
//       responded: !!antData.content,
//       error: antData.error?.message || null,
//     };
//   } catch (err) {
//     results.apiTests.anthropic = { error: err.message };
//   }

//   // Summary
//   results.summary = {
//     allSystemsGo:
//       results.apiTests.anthropic?.ok &&
//       results.apiTests.openStates?.ok &&
//       results.apiTests.googleCivicElections?.ok,
//     issues: Object.entries(results.apiTests)
//       .filter(([, v]) => !v.ok || v.error)
//       .map(([k, v]) => `${k}: ${v.error || 'HTTP ' + v.status}`),
//   };

//   return res.status(200).json(results, null, 2);
// }



//V2

// api/debug.js — Vercel Serverless Function
// Visit /api/debug in your browser to check all API connections
// REMOVE THIS FILE before going fully public — for testing only

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasGoogleCivicKey: !!process.env.GOOGLE_CIVIC_API_KEY,
      hasOpenStatesKey: !!process.env.OPENSTATES_API_KEY,
      hasSupabaseUrl: !!process.env.VITE_SUPABASE_URL,
      hasSupabaseKey: !!process.env.VITE_SUPABASE_ANON_KEY,
    },
    apiTests: {}
  };

  // Test 1 — OpenStates API
  try {
    const url = `https://v3.openstates.org/people?jurisdiction=ocd-jurisdiction%2Fcountry%3Aus%2Fstate%3Aga%2Fgovernment&org_classification=legislature&per_page=2`;
    const osRes = await fetch(url, {
      headers: {
        'X-API-KEY': process.env.OPENSTATES_API_KEY || '',
        'Accept': 'application/json'
      }
    });
    const osData = await osRes.json();
    results.apiTests.openStates = {
      status: osRes.status,
      ok: osRes.ok,
      resultCount: osData.results?.length || 0,
      sample: osData.results?.[0]
        ? { name: osData.results[0].name, party: osData.results[0].party }
        : null,
      error: osData.detail || null,
    };
  } catch (err) {
    results.apiTests.openStates = { error: err.message };
  }

  // Test 2 — Google Civic Elections List
  try {
    const url = `https://www.googleapis.com/civicinfo/v2/elections?key=${process.env.GOOGLE_CIVIC_API_KEY || ''}`;
    const gcRes = await fetch(url);
    const gcData = await gcRes.json();
    const gaElections = (gcData.elections || []).filter(e =>
      e.ocdDivisionId?.includes('state:ga') || e.name?.toLowerCase().includes('georgia')
    );
    results.apiTests.googleCivicElections = {
      status: gcRes.status,
      ok: gcRes.ok,
      totalElections: gcData.elections?.length || 0,
      georgiaElections: gaElections.length,
      georgiaSample: gaElections[0] || null,
      error: gcData.error?.message || null,
    };
  } catch (err) {
    results.apiTests.googleCivicElections = { error: err.message };
  }

  // Test 3 — Google Civic Voter Info (test address)
  try {
    const testAddress = encodeURIComponent('100 Peachtree St NW, Atlanta, Georgia');
    const url = `https://www.googleapis.com/civicinfo/v2/voterinfo?key=${process.env.GOOGLE_CIVIC_API_KEY || ''}&address=${testAddress}&returnAllAvailableData=true`;
    const viRes = await fetch(url);
    const viData = await viRes.json();
    results.apiTests.googleCivicVoterInfo = {
      status: viRes.status,
      ok: viRes.ok,
      electionFound: !!viData.election,
      electionName: viData.election?.name || null,
      pollingLocations: viData.pollingLocations?.length || 0,
      earlyVoteSites: viData.earlyVoteSites?.length || 0,
      contests: viData.contests?.length || 0,
      apiStatus: viData.status || null,
      error: viData.error?.message || null,
    };
  } catch (err) {
    results.apiTests.googleCivicVoterInfo = { error: err.message };
  }

  // Test 4 — Anthropic API (minimal test)
  try {
    const antRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Say OK' }],
      }),
    });
    const antData = await antRes.json();
    results.apiTests.anthropic = {
      status: antRes.status,
      ok: antRes.ok,
      responded: !!antData.content,
      error: antData.error?.message || null,
    };
  } catch (err) {
    results.apiTests.anthropic = { error: err.message };
  }

  // Summary
  results.summary = {
    allSystemsGo:
      results.apiTests.anthropic?.ok &&
      results.apiTests.openStates?.ok &&
      results.apiTests.googleCivicElections?.ok,
    issues: Object.entries(results.apiTests)
      .filter(([, v]) => !v.ok || v.error)
      .map(([k, v]) => `${k}: ${v.error || 'HTTP ' + v.status}`),
  };

  return res.status(200).json(results, null, 2);
}