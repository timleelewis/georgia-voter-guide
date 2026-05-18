// src/CandidateSearch.jsx
// Searchable candidate table — data from Supabase qualified_candidates table
// Party info manually curated from Georgia SOS + OpenStates

import { useState, useEffect, useCallback } from "react";

const PARTY_STYLE = {
  Republican:  { bg:"rgba(178,34,52,0.12)",  border:"rgba(178,34,52,0.3)",  text:"#fca5a5" },
  Democrat:    { bg:"rgba(30,80,200,0.12)",  border:"rgba(30,80,200,0.3)",  text:"#93b8f0" },
  Democratic:  { bg:"rgba(30,80,200,0.12)",  border:"rgba(30,80,200,0.3)",  text:"#93b8f0" },
  Libertarian: { bg:"rgba(251,191,36,0.12)", border:"rgba(251,191,36,0.3)", text:"#fbbf24" },
  Independent: { bg:"rgba(255,255,255,0.06)",border:"rgba(255,255,255,0.12)",text:"#8faabf" },
};
const partyStyle = (p) =>
  PARTY_STYLE[p] || { bg:"rgba(255,255,255,0.05)", border:"rgba(255,255,255,0.1)", text:"#6b87a8" };

const GEORGIA_COUNTIES = [
  "All","Appling","Atkinson","Bacon","Baker","Baldwin","Banks","Barrow","Bartow",
  "Ben Hill","Berrien","Bibb","Bleckley","Brantley","Brooks","Bryan","Bulloch",
  "Burke","Butts","Calhoun","Camden","Candler","Carroll","Catoosa","Charlton",
  "Chatham","Chattahoochee","Chattooga","Cherokee","Clarke","Clay","Clayton",
  "Clinch","Cobb","Coffee","Colquitt","Columbia","Cook","Coweta","Crawford",
  "Crisp","Dade","Dawson","Decatur","DeKalb","Dodge","Dooly","Dougherty",
  "Douglas","Early","Echols","Effingham","Elbert","Emanuel","Evans","Fannin",
  "Fayette","Floyd","Forsyth","Franklin","Fulton","Gilmer","Glascock","Glynn",
  "Gordon","Grady","Greene","Gwinnett","Habersham","Hall","Hancock","Haralson",
  "Harris","Hart","Heard","Henry","Houston","Irwin","Jackson","Jasper",
  "Jeff Davis","Jefferson","Jenkins","Johnson","Jones","Lamar","Lanier",
  "Laurens","Lee","Liberty","Lincoln","Long","Lowndes","Lumpkin","McDuffie",
  "McIntosh","Macon","Madison","Marion","Meriwether","Miller","Mitchell",
  "Monroe","Montgomery","Morgan","Murray","Muscogee","Newton","Oconee",
  "Oglethorpe","Paulding","Peach","Pickens","Pierce","Pike","Polk","Pulaski",
  "Putnam","Quitman","Rabun","Randolph","Richmond","Rockdale","Schley",
  "Screven","Seminole","Spalding","Stephens","Stewart","Sumter","Talbot",
  "Taliaferro","Tattnall","Taylor","Telfair","Terrell","Thomas","Tift","Toombs",
  "Towns","Treutlen","Troup","Turner","Twiggs","Union","Upson","Walker",
  "Walton","Ware","Warren","Washington","Wayne","Webster","Wheeler","White",
  "Whitfield","Wilcox","Wilkes","Wilkinson","Worth",
];

const PARTIES = ["All","Republican","Democrat","Libertarian","Independent","Nonpartisan"];

export default function CandidateSearch() {
  const [candidates, setCandidates] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [partyFilter, setPartyFilter] = useState("All");
  const [countyFilter, setCountyFilter] = useState("All");
  const [offset, setOffset] = useState(0);

  const PAGE_SIZE = 100;

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  // Reset pagination when filters change
  useEffect(() => { setOffset(0); setExpanded(null); }, [debouncedSearch, partyFilter, countyFilter]);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          search: debouncedSearch || undefined,
          county: countyFilter !== "All" ? countyFilter : undefined,
          party: partyFilter !== "All" ? partyFilter : undefined,
          limit: PAGE_SIZE,
          offset,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load candidates");
      setCandidates(data.candidates || []);
      setTotal(data.total);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, partyFilter, countyFilter, offset]);

  useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <h2 style={s.title}>2026 Georgia Primary — Qualified Candidates</h2>
        <p style={s.sub}>
          {total !== null ? `${total.toLocaleString()} qualified candidates` : "Loading…"} ·
          Source: Georgia Secretary of State · Party data curated
        </p>
      </div>

      {/* Filters */}
      <div style={s.filters}>
        <input
          style={s.searchInput}
          placeholder="Search by name, race, or county…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          aria-label="Search candidates"
        />
        <select style={s.select} value={partyFilter} onChange={e => setPartyFilter(e.target.value)} aria-label="Filter by party">
          {PARTIES.map(p => <option key={p} value={p}>{p === "All" ? "All Parties" : p}</option>)}
        </select>
        <select style={s.select} value={countyFilter} onChange={e => setCountyFilter(e.target.value)} aria-label="Filter by county">
          {GEORGIA_COUNTIES.map(c => <option key={c} value={c}>{c === "All" ? "All Counties" : `${c} County`}</option>)}
        </select>
      </div>

      {/* Status bar */}
      <div style={s.statusBar}>
        {loading
          ? <span style={s.statusLoading}><span style={s.spinnerInline}/> Loading…</span>
          : <span style={s.statusCount}>
              {candidates.length === 0 ? "No candidates found" :
               debouncedSearch ? `${candidates.length} result${candidates.length !== 1 ? "s" : ""}` :
               total ? `Showing ${offset + 1}–${Math.min(offset + candidates.length, total)} of ${total.toLocaleString()}` :
               `${candidates.length} candidates`}
            </span>
        }
        {error && <span style={s.statusError}>⚠️ {error}</span>}
      </div>

      {/* Candidate list */}
      {!loading && candidates.length === 0 && !error ? (
        <div style={s.empty}>No qualified candidates match your filters.</div>
      ) : (
        <div style={s.list}>
          {candidates.map((c, i) => {
            const ps = partyStyle(c.political_party);
            const isOpen = expanded === i;
            return (
              <div
                key={c.id || i}
                style={{...s.card, ...(isOpen ? s.cardOpen : {})}}
                onClick={() => setExpanded(isOpen ? null : i)}
                role="button"
                aria-expanded={isOpen}
                tabIndex={0}
                onKeyDown={e => e.key === "Enter" && setExpanded(isOpen ? null : i)}
              >
                <div style={s.cardTop}>
                  <div style={s.cardLeft}>
                    <p style={s.candidateName}>{c.candidate_name}</p>
                    <p style={s.contestName}>{c.contest_name}</p>
                    {c.county && (
                      <p style={s.county}>
                        {c.county} County{c.municipality ? ` · ${c.municipality}` : ""}
                      </p>
                    )}
                  </div>
                  <div style={s.cardRight}>
                    <span style={{...s.partyBadge, background:ps.bg, borderColor:ps.border, color:ps.text}}>
                      {c.political_party || "Unknown"}
                    </span>
                    {c.incumbent && <span style={s.incumbentBadge}>★ Incumbent</span>}
                    <span style={s.expandHint}>{isOpen ? "▲" : "▼"}</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={s.cardDetails} onClick={e => e.stopPropagation()}>
                    {c.occupation && (
                      <p style={s.detailRow}>
                        <span style={s.detailLabel}>Occupation</span>
                        <span style={s.detailVal}>{c.occupation}</span>
                      </p>
                    )}
                    {c.qualified_date && (
                      <p style={s.detailRow}>
                        <span style={s.detailLabel}>Qualified</span>
                        <span style={s.detailVal}>{new Date(c.qualified_date).toLocaleDateString()}</span>
                      </p>
                    )}
                    {c.candidate_status && (
                      <p style={s.detailRow}>
                        <span style={s.detailLabel}>Status</span>
                        <span style={{...s.detailVal, color: c.candidate_status === "Qualified" ? "#6ee7a0" : "#f87171"}}>
                          {c.candidate_status}
                        </span>
                      </p>
                    )}
                    {c.email_address && (
                      <p style={s.detailRow}>
                        <span style={s.detailLabel}>Email</span>
                        <a href={`mailto:${c.email_address}`} style={s.detailLink}>{c.email_address}</a>
                      </p>
                    )}
                    {c.website && (
                      <p style={s.detailRow}>
                        <span style={s.detailLabel}>Website</span>
                        <a
                          href={c.website.startsWith("http") ? c.website : `https://${c.website}`}
                          target="_blank" rel="noopener noreferrer" style={s.detailLink}
                        >
                          {c.website}
                        </a>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination (browse mode only) */}
      {!debouncedSearch && total && total > PAGE_SIZE && (
        <div style={s.pagination}>
          <button
            style={{...s.pageBtn, ...(offset === 0 ? s.pageBtnDisabled : {})}}
            onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            disabled={offset === 0}
          >
            ← Previous
          </button>
          <span style={s.pageInfo}>
            Page {Math.floor(offset / PAGE_SIZE) + 1} of {Math.ceil(total / PAGE_SIZE)}
          </span>
          <button
            style={{...s.pageBtn, ...(offset + PAGE_SIZE >= total ? s.pageBtnDisabled : {})}}
            onClick={() => setOffset(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total}
          >
            Next →
          </button>
        </div>
      )}

      <p style={s.sourceNote}>
        Data: Georgia Secretary of State ·{" "}
        <a href="https://sos.ga.gov/candidate-qualified-list" target="_blank" rel="noopener noreferrer" style={s.sourceLink}>
          sos.ga.gov
        </a>{" "}
        · Party info curated from official sources
      </p>
    </div>
  );
}

const s = {
  wrap: { padding:"0 0 32px" },
  header: { marginBottom:16 },
  title: { fontFamily:"'Playfair Display',serif", fontSize:20, color:"#fff", marginBottom:4 },
  sub: { fontSize:12, color:"#6b87a8", lineHeight:1.5 },

  filters: { display:"flex", gap:8, marginBottom:10, flexWrap:"wrap" },
  searchInput: { flex:2, minWidth:180, background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"9px 12px", fontSize:13, color:"#e0e8f4", fontFamily:"'Source Sans 3',sans-serif", outline:"none" },
  select: { flex:1, minWidth:130, background:"#0c1e3a", border:"1px solid rgba(255,255,255,0.12)", borderRadius:8, padding:"9px 10px", fontSize:12, color:"#8faabf", fontFamily:"'Source Sans 3',sans-serif", outline:"none", cursor:"pointer" },

  statusBar: { display:"flex", alignItems:"center", gap:12, marginBottom:12, minHeight:20 },
  statusCount: { fontSize:11, color:"#3d5470" },
  statusLoading: { fontSize:11, color:"#6b87a8", display:"flex", alignItems:"center", gap:6 },
  spinnerInline: { display:"inline-block", width:12, height:12, border:"2px solid rgba(255,255,255,0.08)", borderTop:"2px solid #B22234", borderRadius:"50%", animation:"spin 0.8s linear infinite" },
  statusError: { fontSize:11, color:"#f87171" },

  list: { display:"flex", flexDirection:"column", gap:5 },
  card: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"11px 14px", cursor:"pointer" },
  cardOpen: { border:"1px solid rgba(255,255,255,0.14)", background:"rgba(255,255,255,0.05)" },
  cardTop: { display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:10 },
  cardLeft: { flex:1, minWidth:0 },
  cardRight: { display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4, flexShrink:0 },
  candidateName: { fontSize:14, fontWeight:600, color:"#dce8f5", marginBottom:2 },
  contestName: { fontSize:12, color:"#8faabf", marginBottom:2 },
  county: { fontSize:11, color:"#4a6080" },
  partyBadge: { fontSize:10, border:"1px solid", borderRadius:20, padding:"2px 10px", fontWeight:600, whiteSpace:"nowrap" },
  incumbentBadge: { fontSize:10, color:"#fbbf24", background:"rgba(251,191,36,0.1)", border:"1px solid rgba(251,191,36,0.2)", borderRadius:20, padding:"2px 8px" },
  expandHint: { fontSize:9, color:"#2d4060", marginTop:2 },

  cardDetails: { marginTop:10, paddingTop:10, borderTop:"1px solid rgba(255,255,255,0.06)", display:"flex", flexDirection:"column", gap:6 },
  detailRow: { display:"flex", gap:10, fontSize:12, alignItems:"baseline" },
  detailLabel: { fontSize:10, color:"#3d5470", textTransform:"uppercase", letterSpacing:1, minWidth:72, flexShrink:0 },
  detailVal: { color:"#a8c0d8" },
  detailLink: { color:"#93b8f0", textDecoration:"none", wordBreak:"break-all" },

  empty: { textAlign:"center", color:"#3d5470", padding:40, fontSize:13 },

  pagination: { display:"flex", alignItems:"center", justifyContent:"center", gap:16, marginTop:20 },
  pageBtn: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#8faabf", borderRadius:8, padding:"8px 18px", fontSize:12, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif" },
  pageBtnDisabled: { opacity:0.3, cursor:"not-allowed" },
  pageInfo: { fontSize:12, color:"#3d5470" },

  sourceNote: { fontSize:11, color:"#2d4060", marginTop:16, textAlign:"center" },
  sourceLink: { color:"#3d5470" },
};
