import { useState, useEffect, useCallback } from "react";
import { supabase } from "./supabaseClient";
import DistrictCheck from "./DistrictCheck";
import CandidateSearch from "./CandidateSearch";

// ─── CONTENT GUARDS (client-side pre-filter) ──────────────────────────────
const BLOCKED = [
  /how (to|do i) (stop|suppress|intimidate) (voters|voting)/i,
  /how (to|do i) (fake|forge|cheat|steal|rig|hack) (votes?|ballot|election)/i,
  /(vote twice|double vote)/i,
  /(home address|phone number|ssn) of/i,
  /write (a |an )?(attack|smear) (ad|message|script)/i,
  /(bomb|weapon|kill|murder|suicide)/i,
];
const WARN = [
  /which (party|candidate) should i vote for/i,
  /best (party|candidate)/i,
  /why (is|are) (democrats?|republicans?) (bad|evil|corrupt)/i,
];
const BLOCK_MSG = "This query cannot be processed. This tool is for nonpartisan voter information only.";
const WARN_MSGS = {
  default: "This tool is nonpartisan and cannot make endorsements. Showing factual information only.",
};

const sanitize = (raw) =>
  raw.replace(/<[^>]*>/g, "").replace(/system:|user:|assistant:/gi, "")
     .replace(/ignore previous|jailbreak/gi, "").trim().slice(0, 300);

const categories = ["All", "U.S. House", "State Senate", "State House", "Governor", "Other"];
const quickSearches = [
  "Who represents Atlanta in Congress?",
  "Stacey Abrams party affiliation",
  "Brian Kemp policy positions",
  "Georgia 5th congressional district",
  "Marjorie Taylor Greene district",
  "Georgia Senate district 6",
];

// ─── STRIPE DONATE LINK ───────────────────────────────────────────────────
// Create at: dashboard.stripe.com → Payment Links → Create link
// Set a one-time or recurring price, copy the link here
const STRIPE_DONATE_URL = "https://buy.stripe.com/3cI7sN86F7OF42UfZjfjG00";

// ─── UPCOMING GEORGIA ELECTIONS ───────────────────────────────────────────
// Update this manually as elections are announced
// Sources: sos.ga.gov · ballotpedia.org/Georgia_elections,_2026
const UPCOMING_ELECTIONS = [
  {
    name: "Georgia Primary Election",
    date: "May 19, 2026",
    daysLabel: "Today",
    races: ["Governor", "U.S. Senate", "State Legislature", "Local Offices"],
    urgent: true,
  },
  {
    name: "Georgia General Election",
    date: "November 3, 2026",
    daysLabel: "Nov 3",
    races: ["Governor", "U.S. Senate", "All 14 Congressional Seats", "State Legislature"],
    urgent: false,
  },
];

// ─── SHARE HELPERS ────────────────────────────────────────────────────────
const SHARE_URL = "https://gaelectionguide.org";
const SHARE_TEXT = "Know who's on your Georgia ballot — party labels may be removed, but your right to know isn't. Free nonpartisan voter guide:";

function shareToTwitter() {
  window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}&url=${encodeURIComponent(SHARE_URL)}`, '_blank', 'width=550,height=420');
}
function shareToFacebook() {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(SHARE_URL)}`, '_blank', 'width=580,height=400');
}
function shareNative() {
  if (navigator.share) {
    navigator.share({ title: "Georgia Voter Guide", text: SHARE_TEXT, url: SHARE_URL });
  }
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("auth"); // auth | guide
  const [authMode, setAuthMode] = useState("login"); // login | signup
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Live ballot preview on auth screen
  const [previewRaces, setPreviewRaces] = useState([]);
  useEffect(() => {
    // Fetch a sample of statewide races to show on the login screen
    fetch("/api/candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ search: "Governor", limit: 10 }),
    })
      .then(r => r.json())
      .then(d => {
        if (d.candidates?.length) {
          // Group by contest_name for display
          const grouped = {};
          for (const c of d.candidates) {
            if (!grouped[c.contest_name]) grouped[c.contest_name] = [];
            grouped[c.contest_name].push(c);
          }
          setPreviewRaces(Object.entries(grouped).slice(0, 4));
        }
      })
      .catch(() => {}); // silent fail — preview is non-critical
  }, []);

  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [access, setAccess] = useState(null); // {allowed, reason, searches_remaining, ...}

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [blocked, setBlocked] = useState(null);
  const [history, setHistory] = useState([]);
  const [dataSources, setDataSources] = useState([]);
  const [hasLiveData, setHasLiveData] = useState(false);
  const [searchMode, setSearchMode] = useState("candidate"); // candidate | address | election
  const [showDistrictCheck, setShowDistrictCheck] = useState(false);

  // ── Auth state listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) { setUser(session.user); setView("guide"); }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session?.user) { setUser(session.user); setView("guide"); }
      else { setUser(null); setProfile(null); setAccess(null); setView("auth"); }
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Load profile + access when user is set
  useEffect(() => {
    if (!user) return;
    loadAccess();
  }, [user]);

  const loadAccess = async () => {
    const { data, error } = await supabase.rpc("check_user_access", { p_user_id: user.id });
    if (!error && data) setAccess(data);
  };

  // ── Sign up
  const handleSignup = async () => {
    setAuthError(""); setAuthLoading(true);
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) setAuthError(error.message);
    else setAuthError("✅ Check your email to confirm your account, then log in.");
    setAuthLoading(false);
  };

  // ── Log in
  const handleLogin = async () => {
    setAuthError(""); setAuthLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setAuthError(error.message);
    setAuthLoading(false);
  };

  // ── Log out
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // ── Search
  const search = useCallback(async (q) => {
    const raw = q || query;
    if (!raw.trim()) return;
    setError(null); setWarning(null); setBlocked(null); setResult(null);

    const clean = sanitize(raw);
    if (!clean) { setError("Please enter a valid search query."); return; }

    if (BLOCKED.some(p => p.test(clean))) { setBlocked(BLOCK_MSG); return; }
    if (WARN.some(p => p.test(clean))) setWarning(WARN_MSGS.default);

    if (!access?.allowed) {
      setError(access?.reason || "Access not available. Please log in.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: clean, userId: user?.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setResult(data.result);
      setDataSources(data.dataSources || []);
      setHasLiveData(data.hasLiveData || false);
      setHistory(prev => [{ query: clean, result: data.result, hasLiveData: data.hasLiveData, time: new Date().toLocaleTimeString() }, ...prev.slice(0, 4)]);

      // Record search in Supabase
      if (user) {
        await supabase.rpc("record_search", {
          p_user_id: user.id,
          p_query: clean,
          p_response_length: data.result?.length || 0,
        });
        loadAccess(); // refresh counter
      }
    } catch (err) {
      setError(err.message || "Search failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [query, user, access]);

  const formatResult = (text) =>
    text.split("\n").map((line, i) => {
      if (line.startsWith("## ")) return <h2 key={i} style={s.rh2}>{line.slice(3)}</h2>;
      if (line.startsWith("**") && line.endsWith("**")) return <p key={i} style={s.rbold}>{line.slice(2,-2)}</p>;
      if (line.startsWith("- ")) return <li key={i} style={s.rli}>{line.slice(2)}</li>;
      if (line.trim() === "") return <div key={i} style={{height:6}} />;
      if (line.includes("**")) {
        const parts = line.split(/\*\*(.*?)\*\*/g);
        return <p key={i} style={s.rp}>{parts.map((p,j) => j%2===1 ? <strong key={j}>{p}</strong> : p)}</p>;
      }
      if (line.startsWith("*") && line.endsWith("*")) return <p key={i} style={s.ritalic}>{line.slice(1,-1)}</p>;
      return <p key={i} style={s.rp}>{line}</p>;
    });

  // ══════════════════════════════════════════════════════════════
  // AUTH SCREEN
  // ══════════════════════════════════════════════════════════════
  if (view === "auth") return (
    <div style={s.root}>
      <div style={s.glow1}/><div style={s.glow2}/>
      <div style={s.authWrap}>
        <div style={s.authCard}>
          <div style={s.stripe}/>
          <div style={s.authLogo}>⚖️</div>
          <h1 style={s.authTitle}>Georgia Voter Guide</h1>
          <p style={s.authSub}>Nonpartisan · Free · Secure</p>
          <p style={s.authDesc}>Know who's on your ballot. Party labels may be removed — your right to know isn't.</p>

          {/* Election notification banner */}
          <div style={s.electionBanner}>
            <div style={s.electionBannerIcon}>🗳️</div>
            <div style={{flex:1}}>
              {UPCOMING_ELECTIONS.map((el, i) => (
                <div key={i} style={{marginBottom: i < UPCOMING_ELECTIONS.length - 1 ? 8 : 0}}>
                  <div style={s.electionBannerRow}>
                    <span style={{...s.electionBannerDate, ...(el.urgent ? s.electionBannerDateUrgent : {})}}>
                      {el.urgent ? "🔴 " : "📅 "}{el.date}
                    </span>
                    <span style={s.electionBannerName}>{el.name}</span>
                  </div>
                  <p style={s.electionBannerRaces}>{el.races.join(" · ")}</p>
                </div>
              ))}
            </div>
          </div>
          <p style={s.electionBannerCta}>Log in to look up candidates, find your polling place, and see who's on your ballot.</p>

          {/* 2026 ballot preview — live from Supabase */}
          <div style={s.ballotPreview}>
            <p style={s.ballotPreviewLabel}>2026 Major Georgia Races</p>
            {previewRaces.length === 0 ? (
              <p style={{fontSize:11, color:"#3d5470", textAlign:"center", padding:"8px 0"}}>Loading candidates…</p>
            ) : (
              previewRaces.map(([office, candidates], i) => {
                return (
                  <div key={i} style={s.ballotRace}>
                    <p style={s.ballotRaceOffice}>{office}</p>
                    <div style={s.ballotCandidates}>
                      {candidates.map((c, j) => {
                        const isRep = c.political_party === "Republican";
                        const isDem = c.political_party === "Democrat" || c.political_party === "Democratic";
                        return (
                          <span key={j} style={{
                            ...s.ballotCandidate,
                            background: isRep ? "rgba(178,34,52,0.12)" : isDem ? "rgba(30,80,200,0.12)" : "rgba(255,255,255,0.05)",
                            borderColor: isRep ? "rgba(178,34,52,0.3)" : isDem ? "rgba(30,80,200,0.3)" : "rgba(255,255,255,0.1)",
                            color: isRep ? "#fca5a5" : isDem ? "#93b8f0" : "#8faabf",
                          }}>
                            {c.candidate_name} · {c.political_party}{c.incumbent ? " ★" : ""}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
            <p style={s.ballotPreviewNote}>★ Incumbent · Log in to see your full district ballot</p>
          </div>

          <div style={s.authTabs}>
            {["login","signup"].map(m => (
              <button key={m} style={{...s.authTab, ...(authMode===m?s.authTabActive:{})}}
                onClick={() => { setAuthMode(m); setAuthError(""); }}>
                {m === "login" ? "Log In" : "Sign Up"}
              </button>
            ))}
          </div>

          <input style={s.authInput} type="email" placeholder="Email address"
            value={email} onChange={e => setEmail(e.target.value)} />
          <input style={s.authInput} type="password" placeholder="Password (min 6 chars)"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key==="Enter" && (authMode==="login" ? handleLogin() : handleSignup())} />

          {authError && <p style={{...s.authMsg, ...(authError.startsWith("✅")?s.authSuccess:{})}}>{authError}</p>}

          <button style={{...s.authBtn, ...(authLoading?s.authBtnDisabled:{})}}
            onClick={authMode==="login" ? handleLogin : handleSignup}
            disabled={authLoading}>
            {authLoading ? "…" : authMode === "login" ? "Log In" : "Create Free Account"}
          </button>

          <div style={s.authFeatures}>
            {["30-day free trial","50 searches/day","Election window access","100% nonpartisan"].map((f,i) => (
              <div key={i} style={s.authFeature}><span style={s.check}>✓</span>{f}</div>
            ))}
          </div>

          <div style={s.authDonate}>
            <p style={s.authDonateText}>This tool is free and open source.</p>
            <a href={STRIPE_DONATE_URL} target="_blank" rel="noopener noreferrer" style={s.donateBtn}>
              ☕ Support the Project
            </a>
          </div>
        </div>
      </div>
      <style>{css}</style>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // VOTER GUIDE SCREEN
  // ══════════════════════════════════════════════════════════════
  return (
    <div style={s.root}>
      <div style={s.glow1}/><div style={s.glow2}/>
      <div style={s.container}>

        {/* Header */}
        <header style={s.header}>
          <div style={s.stripe}/>
          <div style={s.titleRow} className="title-row">
            <span style={s.seal}>⚖️</span>
            <div style={{flex:1}}>
              <h1 style={s.title}>Georgia Voter Guide</h1>
              <p style={s.sub}>Nonpartisan · Secure · Transparent</p>
            </div>
            <a href={STRIPE_DONATE_URL} target="_blank" rel="noopener noreferrer" style={s.keepFreeBtn}>
              Keep this free →
            </a>
            <button style={s.logoutBtn} onClick={handleLogout}>Log Out</button>
          </div>
          <p style={s.mission}>Party labels may be hidden from your ballot — this tool isn't.</p>
          <button style={s.districtBtn} className="district-btn" onClick={() => setShowDistrictCheck(true)}>
            🗺️ Did My District Change?
          </button>
        </header>

        {/* Usage Dashboard */}
        {access && (
          <div style={s.dashboard} className="dashboard">
            <div style={s.dashItem}>
              <span style={s.dashLabel}>Status</span>
              <span style={{...s.dashValue, color: access.allowed?"#6ee7a0":"#f87171"}}>
                {access.allowed ? "✓ Active" : "✗ Restricted"}
              </span>
            </div>
            <div style={s.dashItem}>
              <span style={s.dashLabel}>Searches Today</span>
              <span style={s.dashValue}>{access.searches_today ?? 0} / {access.search_limit ?? 50}</span>
            </div>
            <div style={s.dashItem}>
              <span style={s.dashLabel}>Remaining</span>
              <span style={s.dashValue}>{access.searches_remaining ?? 50}</span>
            </div>
            <div style={s.dashItem}>
              <span style={s.dashLabel}>Access</span>
              <span style={s.dashValue}>
                {access.in_election_window ? "🗳️ Election Window" :
                  access.access_end ? `Until ${new Date(access.access_end).toLocaleDateString()}` : "Trial"}
              </span>
            </div>
            {/* Progress bar */}
            <div style={s.progressWrap} className="dashboard-progress">
              <div style={{
                ...s.progressBar,
                width: `${Math.min(100, ((access.searches_today||0) / (access.search_limit||50)) * 100)}%`,
                background: (access.searches_today||0) > (access.search_limit||50)*0.8 ? "#f87171" : "#6ee7a0"
              }}/>
            </div>
          </div>
        )}

        {/* Access blocked banner */}
        {access && !access.allowed && (
          <div style={s.accessBlocked}>
            <span>🔒</span>
            <div>
              <strong style={{display:"block",marginBottom:4}}>Access Restricted</strong>
              {access.reason}
              {access.in_election_window === false && <p style={{marginTop:6,fontSize:12,color:"#7a4040"}}>
                Free access resumes during election windows (e.g., 60 days before Georgia elections).
              </p>}
            </div>
          </div>
        )}

        {/* Search Mode Tabs */}
        <div style={s.modeTabs} className="mode-tabs">
          {[
            { id: "candidate", label: "🔍 Candidate Lookup" },
            { id: "address",   label: "📍 My Representatives" },
            { id: "election",  label: "🗓️ Election Dates" },
            { id: "ballot",    label: "📋 2026 Ballot" },
          ].map(m => (
            <button key={m.id}
              style={{...s.modeTab, ...(searchMode===m.id ? s.modeTabActive : {})}}
              className="mode-tab"
              onClick={() => { setSearchMode(m.id); setQuery(""); setResult(null); setError(null); }}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Ballot tab — full candidate search, replaces search UI */}
        {searchMode === "ballot" && <CandidateSearch />}

        {/* Search — hidden when ballot tab is active */}
        {searchMode !== "ballot" && <>
        <div style={s.searchRow} className="search-row">
          <span>{ searchMode==="address" ? "📍" : searchMode==="election" ? "🗓️" : "🔍" }</span>
          <input style={s.input}
            placeholder={
              searchMode === "address"  ? "Enter your Georgia address (e.g. 123 Main St, Atlanta)…" :
              searchMode === "election" ? "Ask about deadlines, early voting, voter ID, polling hours…" :
              "Search a candidate name or district…"
            }
            value={query} maxLength={300}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key==="Enter" && search()} />
          <span style={s.charCount} className="char-count">{query.length}/300</span>
          <button style={{...s.searchBtn,...(loading||!access?.allowed?s.btnDisabled:{})}}
            className="search-btn"
            onClick={() => search()} disabled={loading || !access?.allowed}>
            {loading ? "…" : "Search"}
          </button>
        </div>

        {/* Live data indicator */}
        <div style={s.liveIndicator} className="live-indicator">
          <span style={s.liveLabel}>Live data sources:</span>
          <span style={{...s.sourceChip, background:"rgba(60,180,100,0.15)", color:"#6ee7a0", border:"1px solid rgba(60,180,100,0.3)"}}>🟢 Google Civic API</span>
          <span style={{...s.sourceChip, background:"rgba(99,140,220,0.15)", color:"#93b8f0", border:"1px solid rgba(99,140,220,0.3)"}}>🔵 OpenStates API</span>
          <span style={s.liveNote} className="live-note">Results are verified against official government sources in real time.</span>
        </div>

        {/* Quick searches */}
        <div style={s.quickWrap}>
          <p style={s.quickLabel}>
            { searchMode === "address"  ? "Try an address:" :
              searchMode === "election" ? "Common election questions:" :
              "Common candidate questions:" }
          </p>
          <div style={s.quickGrid}>
            {(searchMode === "address" ? [
              "123 Peachtree St NE, Atlanta, GA",
              "456 Ponce de Leon Ave, Atlanta, GA",
              "789 MLK Jr Dr, Savannah, GA",
              "100 Main St, Augusta, GA",
            ] : searchMode === "election" ? [
              "When is the registration deadline in Georgia?",
              "When is early voting in Georgia?",
              "What ID do I need to vote in Georgia?",
              "How do I request an absentee ballot in Georgia?",
            ] : [
              "Who represents Atlanta in Congress?",
              "Stacey Abrams party affiliation",
              "Brian Kemp policy positions",
              "Marjorie Taylor Greene district",
              "Georgia 5th congressional district",
              "Georgia Senate district 6",
            ]).map((q,i) => (
              <button key={i} style={s.quickBtn} onClick={() => { setQuery(q); search(q); }}>{q}</button>
            ))}
          </div>
        </div>

        {/* States */}
        {blocked && <div style={s.blockedBox}><strong>🚫 Blocked</strong><p style={{marginTop:6}}>{blocked}</p></div>}
        {warning && !blocked && <div style={s.warnBox}><span>⚠️</span><span>{warning}</span></div>}
        {error && <div style={s.errorBox}><span>⚠️</span> {error}</div>}
        {loading && <div style={s.loadBox}><div style={s.spinner}/><p style={s.loadText}>Researching candidate information…</p></div>}

        {/* Result */}
        {result && !loading && (
          <div style={s.resultCard}>
            <div style={s.resultHead} className="result-head">
              <span>📋</span>
              <span style={{flex:1,fontWeight:600}}>
                { searchMode==="address" ? "Your Representatives" :
                  searchMode==="election" ? "Election Information" :
                  "Candidate Information" }
              </span>
              {hasLiveData
                ? <span style={s.liveDataBadge}>🟢 Live Data</span>
                : <span style={s.trainingBadge}>🟡 AI Training Data</span>
              }
              <span style={s.npBadge}>Nonpartisan</span>
            </div>
            {dataSources.length > 0 && (
              <div style={s.sourceBar}>
                <span style={s.sourceBarLabel}>Sources used:</span>
                {dataSources.map((src,i) => (
                  <span key={i} style={s.sourceChipSmall}>{src}</span>
                ))}
              </div>
            )}
            <div style={s.resultBody}>
              <ul style={{listStyle:"none",padding:0}}>{formatResult(result)}</ul>
            </div>
            <div style={s.disclaimer}>
              ⚠️ Always verify at <strong>sos.ga.gov</strong> · <strong>ballotpedia.org</strong> · <strong>vote411.org</strong>
              {hasLiveData && <span style={{color:"#6ee7a0", marginLeft:8}}>· Live data verified {new Date().toLocaleDateString()}</span>}
            </div>
            <div style={s.donateCard}>
              <div style={s.donateCardLeft}>
                <p style={s.donateCardTitle}>Found this useful?</p>
                <p style={s.donateCardSub}>This tool is free, nonpartisan, and open source. A small contribution keeps it running.</p>
              </div>
              <a href={STRIPE_DONATE_URL} target="_blank" rel="noopener noreferrer" style={s.donateCardBtn}>
                ☕ Support
              </a>
            </div>
            <div style={s.shareBar}>
              <span style={s.shareBarLabel}>Share this tool:</span>
              <button style={s.shareBtn} onClick={shareToTwitter} aria-label="Share on X/Twitter">𝕏 Twitter</button>
              <button style={s.shareBtn} onClick={shareToFacebook} aria-label="Share on Facebook">f Facebook</button>
              {"share" in navigator && (
                <button style={{...s.shareBtn, ...s.shareBtnNative}} onClick={shareNative} aria-label="Share">↑ Share</button>
              )}
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div style={s.histSec}>
            <p style={s.histLabel}>Recent Searches</p>
            {history.map((h,i) => (
              <button key={i} style={s.histItem}
                onClick={() => { setQuery(h.query); setResult(h.result); }}>
                <span style={s.histTime}>{h.time}</span>
                <span style={s.histQ}>{h.query}</span>
              </button>
            ))}
          </div>
        )}
        </> /* end searchMode !== ballot */}

        <footer style={s.footer}>
          <p>Nonpartisan · AI-assisted · Does not endorse any candidate or party</p>
          <p style={{marginTop:4,color:"#2d4060"}}>Protecting your right to an informed vote · <a href="https://github.com/YOUR-USERNAME/georgia-voter-guide" target="_blank" rel="noopener noreferrer" style={{color:"#3d5470",textDecoration:"none"}}>Open Source</a></p>
        </footer>
      </div>

      {showDistrictCheck && <DistrictCheck onClose={() => setShowDistrictCheck(false)} />}

      <style>{css}</style>
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Source+Sans+3:wght@400;500;600&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity:0;transform:translateY(10px); } to { opacity:1;transform:translateY(0); } }
  input::placeholder { color: #3d5470; }
  input { color: #e0e8f4 !important; }

  @media (max-width: 600px) {
    /* Header */
    .title-row { flex-wrap: wrap; gap: 8px !important; }
    .app-title { font-size: 24px !important; }

    /* Dashboard — stack into 2-column grid */
    .dashboard {
      display: grid !important;
      grid-template-columns: 1fr 1fr;
      gap: 12px !important;
    }
    .dashboard-progress {
      grid-column: 1 / -1;
    }

    /* Mode tabs — 2x2 grid on mobile for 4 tabs */
    .mode-tabs {
      display: grid !important;
      grid-template-columns: 1fr 1fr;
      gap: 6px !important;
    }
    .mode-tab {
      padding: 8px 6px !important;
      font-size: 11px !important;
      text-align: center;
    }

    /* Search row — stack input above button */
    .search-row {
      flex-wrap: wrap;
      gap: 8px !important;
      padding: 8px !important;
    }
    .search-row input { min-width: 0; width: 100%; }
    .search-row .search-btn {
      width: 100%;
      text-align: center;
      border-radius: 8px !important;
      padding: 10px !important;
    }
    .char-count { display: none; }

    /* Live indicator — wrap chips onto new lines */
    .live-indicator {
      flex-direction: column !important;
      align-items: flex-start !important;
      gap: 6px !important;
    }
    .live-note { margin-left: 0 !important; }

    /* Source bar chips */
    .source-bar { flex-wrap: wrap; }

    /* Result head badges */
    .result-head { flex-wrap: wrap; gap: 6px !important; }

    /* District button */
    .district-btn { width: 100%; margin-top: 10px; text-align: center; }
  }
`;

const s = {
  root: { minHeight:"100vh", background:"linear-gradient(155deg,#080f1e 0%,#0c1e3a 55%,#080f1e 100%)", fontFamily:"'Source Sans 3',sans-serif", color:"#e0e8f4", position:"relative", overflow:"hidden" },
  glow1: { position:"fixed", top:-200, right:-200, width:600, height:600, borderRadius:"50%", background:"radial-gradient(circle,rgba(178,34,52,0.1) 0%,transparent 70%)", pointerEvents:"none" },
  glow2: { position:"fixed", bottom:-200, left:-200, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle,rgba(20,70,160,0.12) 0%,transparent 70%)", pointerEvents:"none" },
  stripe: { height:4, background:"linear-gradient(90deg,#B22234 33%,#fff 33%,#fff 66%,#3C3B6E 66%)", borderRadius:2, marginBottom:18 },

  // Auth
  authWrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 },
  authCard: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:18, padding:36, width:"100%", maxWidth:420, animation:"fadeUp 0.5s ease" },
  authLogo: { fontSize:44, textAlign:"center", marginBottom:12 },
  authTitle: { fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:900, color:"#fff", textAlign:"center", marginBottom:4 },
  authSub: { fontSize:11, color:"#6b87a8", letterSpacing:2, textTransform:"uppercase", textAlign:"center", marginBottom:12 },
  authDesc: { fontSize:13, color:"#8faabf", textAlign:"center", lineHeight:1.6, marginBottom:16, fontStyle:"italic", borderLeft:"3px solid #B22234", paddingLeft:12 },

  // Election banner on auth screen
  electionBanner: { display:"flex", gap:10, background:"rgba(178,34,52,0.08)", border:"1px solid rgba(178,34,52,0.25)", borderRadius:10, padding:"12px 14px", marginBottom:10, alignItems:"flex-start" },
  electionBannerIcon: { fontSize:20, flexShrink:0, marginTop:1 },
  electionBannerRow: { display:"flex", alignItems:"center", gap:8, flexWrap:"wrap", marginBottom:2 },
  electionBannerDate: { fontSize:11, fontWeight:700, color:"#fbbf24", whiteSpace:"nowrap" },
  electionBannerDateUrgent: { color:"#f87171" },
  electionBannerName: { fontSize:12, fontWeight:600, color:"#dce8f5" },
  electionBannerRaces: { fontSize:11, color:"#6b87a8", lineHeight:1.5, margin:0 },
  electionBannerCta: { fontSize:12, color:"#6b87a8", textAlign:"center", marginBottom:16, lineHeight:1.5 },
  authTabs: { display:"flex", background:"rgba(255,255,255,0.04)", borderRadius:8, padding:3, marginBottom:20, gap:4 },
  authTab: { flex:1, padding:"8px 0", border:"none", borderRadius:6, background:"transparent", color:"#6b87a8", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  authTabActive: { background:"#B22234", color:"#fff" },
  authInput: { width:"100%", background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"11px 14px", fontSize:14, fontFamily:"'Source Sans 3',sans-serif", marginBottom:10, outline:"none" },
  authMsg: { fontSize:12, color:"#f87171", marginBottom:10, lineHeight:1.5 },
  authSuccess: { color:"#6ee7a0" },
  authBtn: { width:"100%", background:"linear-gradient(135deg,#B22234,#8b1a28)", color:"#fff", border:"none", borderRadius:9, padding:"13px 0", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif", marginTop:4 },
  authBtnDisabled: { opacity:0.5, cursor:"not-allowed" },
  authFeatures: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:20 },
  authFeature: { display:"flex", alignItems:"center", gap:6, fontSize:12, color:"#6b87a8" },
  check: { color:"#6ee7a0", fontSize:14, fontWeight:700 },

  // Guide
  container: { maxWidth:880, margin:"0 auto", padding:"32px 20px 60px", position:"relative", zIndex:1 },
  header: { marginBottom:20 },
  titleRow: { display:"flex", alignItems:"center", gap:14, marginBottom:10, flexWrap:"wrap" },
  seal: { fontSize:38 },
  title: { fontFamily:"'Playfair Display',serif", fontSize:32, fontWeight:900, color:"#fff", lineHeight:1.1 },
  sub: { fontSize:11, color:"#6b87a8", letterSpacing:2, textTransform:"uppercase", marginTop:4 },
  mission: { fontSize:13, color:"#8faabf", borderLeft:"3px solid #B22234", paddingLeft:12, fontStyle:"italic" },
  logoutBtn: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.12)", color:"#8faabf", borderRadius:7, padding:"7px 16px", fontSize:12, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  districtBtn: { marginTop:10, background:"rgba(178,34,52,0.15)", border:"1px solid rgba(178,34,52,0.4)", color:"#fca5a5", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  keepFreeBtn: { fontSize:11, color:"#6ee7a0", textDecoration:"none", background:"rgba(60,180,100,0.08)", border:"1px solid rgba(60,180,100,0.2)", borderRadius:20, padding:"5px 12px", fontWeight:600, whiteSpace:"nowrap", fontFamily:"'Source Sans 3',sans-serif" },

  // Dashboard
  dashboard: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:12, padding:16, marginBottom:18, display:"flex", flexWrap:"wrap", gap:16, alignItems:"center" },
  dashItem: { display:"flex", flexDirection:"column", gap:3, minWidth:90 },
  dashLabel: { fontSize:10, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.2 },
  dashValue: { fontSize:14, fontWeight:600, color:"#e0e8f4" },
  progressWrap: { flex:"1 1 100%", height:4, background:"rgba(255,255,255,0.08)", borderRadius:2, overflow:"hidden", marginTop:4 },
  progressBar: { height:"100%", borderRadius:2, transition:"width 0.4s ease" },
  accessBlocked: { display:"flex", gap:12, background:"rgba(178,34,52,0.1)", border:"1px solid rgba(178,34,52,0.3)", borderRadius:11, padding:"14px 16px", marginBottom:18, color:"#fca5a5", fontSize:13, lineHeight:1.6 },

  modeTabs: { display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" },
  modeTab: { padding:"8px 16px", borderRadius:8, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"#7a96b4", fontSize:13, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif", fontWeight:500 },
  modeTabActive: { background:"rgba(178,34,52,0.2)", borderColor:"#B22234", color:"#fff", fontWeight:600 },
  liveIndicator: { display:"flex", alignItems:"center", flexWrap:"wrap", gap:8, marginBottom:16, padding:"8px 12px", background:"rgba(60,180,100,0.05)", border:"1px solid rgba(60,180,100,0.15)", borderRadius:8 },
  liveLabel: { fontSize:11, color:"#4a7060", textTransform:"uppercase", letterSpacing:1 },
  liveNote: { fontSize:11, color:"#3a5a50", marginLeft:"auto" },
  sourceChip: { fontSize:11, borderRadius:20, padding:"2px 10px", fontWeight:500 },
  sourceBar: { display:"flex", alignItems:"center", gap:8, padding:"8px 18px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexWrap:"wrap" },
  sourceBarLabel: { fontSize:11, color:"#3d5470", textTransform:"uppercase", letterSpacing:1 },
  sourceChipSmall: { fontSize:10, background:"rgba(60,180,100,0.12)", color:"#6ee7a0", border:"1px solid rgba(60,180,100,0.2)", borderRadius:20, padding:"2px 8px" },
  liveDataBadge: { fontSize:10, background:"rgba(60,180,100,0.18)", color:"#6ee7a0", border:"1px solid rgba(60,180,100,0.3)", borderRadius:20, padding:"2px 9px", fontWeight:600 },
  trainingBadge: { fontSize:10, background:"rgba(251,191,36,0.12)", color:"#fbbf24", border:"1px solid rgba(251,191,36,0.25)", borderRadius:20, padding:"2px 9px" },
  cats: { display:"flex", flexWrap:"wrap", gap:7, marginBottom:16 },
  catBtn: { padding:"5px 13px", borderRadius:20, border:"1px solid rgba(255,255,255,0.12)", background:"transparent", color:"#7a96b4", fontSize:12, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  catActive: { background:"#B22234", borderColor:"#B22234", color:"#fff", fontWeight:600 },

  searchRow: { display:"flex", alignItems:"center", background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"4px 4px 4px 14px", gap:8, marginBottom:14 },
  input: { flex:1, background:"transparent", border:"none", outline:"none", fontSize:14, padding:"9px 0", fontFamily:"'Source Sans 3',sans-serif" },
  charCount: { fontSize:11, color:"#3d5470", whiteSpace:"nowrap" },
  searchBtn: { background:"linear-gradient(135deg,#B22234,#8b1a28)", color:"#fff", border:"none", borderRadius:7, padding:"9px 18px", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  btnDisabled: { opacity:0.4, cursor:"not-allowed" },

  quickWrap: { marginBottom:22 },
  quickLabel: { fontSize:11, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 },
  quickGrid: { display:"flex", flexWrap:"wrap", gap:7 },
  quickBtn: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:7, color:"#8faabf", fontSize:11, padding:"5px 11px", cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },

  blockedBox: { background:"rgba(178,34,52,0.12)", border:"1.5px solid rgba(178,34,52,0.4)", borderRadius:11, padding:18, marginBottom:18, color:"#fca5a5", fontSize:13 },
  warnBox: { display:"flex", gap:10, background:"rgba(251,191,36,0.07)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:9, padding:"11px 14px", marginBottom:14, color:"#fbbf24", fontSize:13 },
  errorBox: { display:"flex", gap:8, background:"rgba(178,34,52,0.09)", border:"1px solid rgba(178,34,52,0.25)", borderRadius:9, padding:"11px 14px", color:"#f87171", fontSize:13, marginBottom:14 },
  loadBox: { display:"flex", alignItems:"center", gap:14, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:18, marginBottom:18 },
  spinner: { width:22, height:22, border:"3px solid rgba(255,255,255,0.08)", borderTop:"3px solid #B22234", borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 },
  loadText: { color:"#6b87a8", fontSize:13 },

  resultCard: { background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:13, overflow:"hidden", marginBottom:22, animation:"fadeUp 0.35s ease" },
  resultHead: { display:"flex", alignItems:"center", gap:9, padding:"12px 18px", background:"rgba(255,255,255,0.03)", borderBottom:"1px solid rgba(255,255,255,0.07)", fontSize:14 },
  npBadge: { fontSize:10, background:"rgba(60,180,100,0.15)", color:"#6ee7a0", border:"1px solid rgba(60,180,100,0.25)", borderRadius:20, padding:"2px 9px" },
  resultBody: { padding:"16px 20px" },
  disclaimer: { padding:"10px 18px", background:"rgba(251,191,36,0.06)", borderTop:"1px solid rgba(251,191,36,0.12)", color:"#fbbf24", fontSize:11 },

  rh2: { fontFamily:"'Playfair Display',serif", fontSize:19, color:"#fff", marginBottom:10, marginTop:6 },
  rbold: { fontWeight:700, color:"#dce8f5", marginBottom:4, fontSize:14 },
  rp: { fontSize:13, lineHeight:1.7, color:"#a8c0d8", marginBottom:3 },
  rli: { fontSize:13, lineHeight:1.7, color:"#a8c0d8", paddingLeft:14, marginBottom:3, listStyle:"disc", listStylePosition:"inside" },
  ritalic: { fontSize:12, color:"#4a6a8a", fontStyle:"italic", marginTop:8 },

  histSec: { marginBottom:22 },
  histLabel: { fontSize:11, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.5, marginBottom:8 },
  histItem: { display:"flex", alignItems:"center", gap:10, width:"100%", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:7, padding:"9px 13px", cursor:"pointer", marginBottom:5, textAlign:"left", fontFamily:"'Source Sans 3',sans-serif" },
  histTime: { fontSize:10, color:"#2d4060", minWidth:55 },
  histQ: { fontSize:12, color:"#6b87a8" },
  footer: { textAlign:"center", color:"#2d4060", fontSize:12, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.05)" },

  // Donate card (inside result)
  donateCard: { display:"flex", alignItems:"center", justifyContent:"space-between", gap:12, padding:"12px 18px", background:"rgba(60,180,100,0.04)", borderTop:"1px solid rgba(60,180,100,0.1)" },
  donateCardLeft: { flex:1 },
  donateCardTitle: { fontSize:12, fontWeight:600, color:"#6ee7a0", marginBottom:2 },
  donateCardSub: { fontSize:11, color:"#3a5a50", lineHeight:1.5 },
  donateCardBtn: { flexShrink:0, background:"rgba(60,180,100,0.12)", border:"1px solid rgba(60,180,100,0.3)", color:"#6ee7a0", borderRadius:8, padding:"8px 16px", fontSize:12, fontWeight:600, textDecoration:"none", fontFamily:"'Source Sans 3',sans-serif", whiteSpace:"nowrap" },

  // Share bar (inside result)
  shareBar: { display:"flex", alignItems:"center", gap:8, padding:"10px 18px", borderTop:"1px solid rgba(255,255,255,0.05)", flexWrap:"wrap" },
  shareBarLabel: { fontSize:11, color:"#3d5470", marginRight:4 },
  shareBtn: { fontSize:11, fontWeight:600, color:"#8faabf", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"5px 12px", cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  shareBtnNative: { background:"rgba(178,34,52,0.1)", borderColor:"rgba(178,34,52,0.3)", color:"#fca5a5" },

  // Ballot preview on auth screen
  ballotPreview: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 14px", marginBottom:16 },
  ballotPreviewLabel: { fontSize:10, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 },
  ballotRace: { marginBottom:10 },
  ballotRaceOffice: { fontSize:11, fontWeight:600, color:"#6b87a8", marginBottom:5 },
  ballotCandidates: { display:"flex", flexWrap:"wrap", gap:6 },
  ballotCandidate: { fontSize:11, border:"1px solid", borderRadius:20, padding:"3px 10px", fontWeight:500 },
  ballotPreviewNote: { fontSize:10, color:"#2d4060", marginTop:8, textAlign:"center" },

  // Auth donate
  authDonate: { marginTop:20, paddingTop:16, borderTop:"1px solid rgba(255,255,255,0.07)", textAlign:"center" },
  authDonateText: { fontSize:11, color:"#3d5470", marginBottom:10 },
  donateBtn: { display:"inline-block", background:"rgba(60,180,100,0.1)", color:"#6ee7a0", border:"1px solid rgba(60,180,100,0.25)", borderRadius:9, padding:"9px 20px", fontSize:13, fontWeight:600, textDecoration:"none", fontFamily:"'Source Sans 3',sans-serif" },
};
