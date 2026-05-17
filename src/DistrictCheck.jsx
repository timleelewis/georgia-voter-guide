// src/DistrictCheck.jsx
// "Did My District Change?" + "Find My District" feature
// Calls /api/district → Google Civic representativeInfoByAddress
// Returns structured district cards — no AI, no search quota used

import { useState } from "react";

const REDISTRICTING_EVENTS = [
  {
    id: "2023_maps",
    name: "2023 Georgia Redistricting",
    date: "December 2023",
    description: "Georgia legislature redrew congressional and state legislative maps following federal court orders related to minority representation.",
    affectedDistricts: {
      congressional: "District 6 and District 13 boundaries significantly changed",
      stateSenate: "Multiple districts redrawn in metro Atlanta and South Georgia",
      stateHouse: "Widespread changes across suburban Atlanta counties",
    },
    courtCase: "Pendergrass v. Raffensperger",
    impact: "Created additional majority-minority districts in response to Voting Rights Act litigation",
  },
  {
    id: "2026_special",
    name: "2026 Georgia Special Session Redistricting",
    date: "2026 (ongoing)",
    description: "Governor called a special session to redraw congressional maps following the Supreme Court's Louisiana ruling limiting Section 2 of the Voting Rights Act.",
    affectedDistricts: {
      congressional: "All 14 congressional districts under review",
      stateSenate: "Potential changes pending special session outcome",
      stateHouse: "Potential changes pending special session outcome",
    },
    courtCase: "Louisiana v. Callais (U.S. Supreme Court, 2026)",
    impact: "Maps may reduce majority-minority districts — affects representation for Black and Hispanic voters statewide",
  },
];

const PARTY_COLORS = {
  Republican: { bg: "rgba(178,34,52,0.12)", border: "rgba(178,34,52,0.3)", text: "#fca5a5" },
  Democrat:   { bg: "rgba(30,80,200,0.12)", border: "rgba(30,80,200,0.3)",  text: "#93b8f0" },
  Democratic: { bg: "rgba(30,80,200,0.12)", border: "rgba(30,80,200,0.3)",  text: "#93b8f0" },
};
const partyStyle = (party) => PARTY_COLORS[party] || { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.12)", text: "#8faabf" };

export default function DistrictCheck({ onClose }) {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [step, setStep] = useState(1);

  const checkDistrict = async () => {
    if (!address.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/district", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lookup failed");
      setResult(data);
      setStep(2);
    } catch (err) {
      setError(err.message || "Could not look up district. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.overlay}>
      <div style={s.modal}>

        {/* Header */}
        <div style={s.header}>
          <div style={s.headerLeft}>
            <span style={s.headerIcon}>🗺️</span>
            <div>
              <h2 style={s.title}>Find My District</h2>
              <p style={s.subtitle}>Georgia Redistricting Tracker</p>
            </div>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Alert Banner */}
        <div style={s.alertBanner}>
          <span style={s.alertIcon}>⚠️</span>
          <div>
            <strong style={s.alertTitle}>Active Redistricting in Georgia</strong>
            <p style={s.alertBody}>
              A special session has been called to redraw Georgia's congressional maps. Your
              district may have changed since you last voted.
            </p>
          </div>
        </div>

        {/* ── STEP 1: Address Entry ── */}
        {step === 1 && (
          <div style={s.stepWrap}>
            <p style={s.stepLabel}>Enter your Georgia address to see your current districts and representatives:</p>
            <div style={s.inputRow}>
              <input
                style={s.input}
                placeholder="e.g. 123 Peachtree St NE, Atlanta"
                value={address}
                onChange={e => setAddress(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkDistrict()}
                aria-label="Georgia address"
              />
              <button
                style={{ ...s.searchBtn, ...(loading ? s.btnDisabled : {}) }}
                onClick={checkDistrict}
                disabled={loading}
              >
                {loading ? "Looking up…" : "Find My District"}
              </button>
            </div>
            {error && <p style={s.errorMsg}>⚠️ {error}</p>}

            {/* Redistricting events */}
            <div style={s.eventsSection}>
              <p style={s.eventsLabel}>Recent Georgia Redistricting Events:</p>
              {REDISTRICTING_EVENTS.map(event => (
                <div key={event.id} style={s.eventCard}>
                  <div style={s.eventHeader}>
                    <span style={s.eventName}>{event.name}</span>
                    <span style={s.eventDate}>{event.date}</span>
                  </div>
                  <p style={s.eventDesc}>{event.description}</p>
                  <div style={s.eventDistricts}>
                    {[
                      ["Congressional", event.affectedDistricts.congressional],
                      ["State Senate",  event.affectedDistricts.stateSenate],
                      ["State House",   event.affectedDistricts.stateHouse],
                    ].map(([label, val]) => (
                      <div key={label} style={s.districtRow}>
                        <span style={s.districtLabel}>{label}:</span>
                        <span style={s.districtValue}>{val}</span>
                      </div>
                    ))}
                  </div>
                  <p style={s.courtCase}>📋 {event.courtCase}</p>
                  <p style={s.eventImpact}>💡 {event.impact}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Results ── */}
        {step === 2 && result && (
          <div style={s.stepWrap}>

            {/* Address confirmed */}
            <div style={s.resultsHeader}>
              <span style={s.resultsIcon}>📍</span>
              <div style={{ flex: 1 }}>
                <p style={s.resultsTitle}>Your Current Districts & Representatives</p>
                <p style={s.resultsAddr}>{result.normalizedAddress}</p>
              </div>
              <span style={s.liveBadge}>🟢 Live Data</span>
            </div>

            {/* District numbers summary */}
            {Object.keys(result.districtInfo || {}).length > 0 && (
              <div style={s.districtSummary}>
                <p style={s.districtSummaryLabel}>Your Districts</p>
                <div style={s.districtSummaryGrid}>
                  {result.districtInfo.congressional && (
                    <div style={s.districtSummaryItem}>
                      <span style={s.districtSummaryIcon}>🏛️</span>
                      <span style={s.districtSummaryType}>Congressional</span>
                      <span style={s.districtSummaryNum}>{result.districtInfo.congressional}</span>
                    </div>
                  )}
                  {result.districtInfo.stateSenate && (
                    <div style={s.districtSummaryItem}>
                      <span style={s.districtSummaryIcon}>🏛️</span>
                      <span style={s.districtSummaryType}>State Senate</span>
                      <span style={s.districtSummaryNum}>{result.districtInfo.stateSenate}</span>
                    </div>
                  )}
                  {result.districtInfo.stateHouse && (
                    <div style={s.districtSummaryItem}>
                      <span style={s.districtSummaryIcon}>🏛️</span>
                      <span style={s.districtSummaryType}>State House</span>
                      <span style={s.districtSummaryNum}>{result.districtInfo.stateHouse}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Representatives by level */}
            {(result.levelOrder || []).map(level => {
              const reps = result.representatives?.[level];
              if (!reps?.length) return null;
              return (
                <div key={level} style={s.levelSection}>
                  <p style={s.levelLabel}>
                    {result.levelLabels?.[level] || level} Representatives
                  </p>
                  <div style={s.repGrid}>
                    {reps.map((rep, i) => {
                      const ps = partyStyle(rep.party);
                      return (
                        <div key={i} style={{ ...s.repCard, borderColor: ps.border }}>
                          <div style={s.repCardTop}>
                            <div style={{ flex: 1 }}>
                              <p style={s.repOffice}>{rep.office}</p>
                              <p style={s.repName}>{rep.name}</p>
                            </div>
                            <span style={{ ...s.partyBadge, background: ps.bg, color: ps.text, borderColor: ps.border }}>
                              {rep.party}
                            </span>
                          </div>
                          <div style={s.repContacts}>
                            {rep.phone && (
                              <a href={`tel:${rep.phone}`} style={s.contactLink}>
                                📞 {rep.phone}
                              </a>
                            )}
                            {rep.website && (
                              <a href={rep.website} target="_blank" rel="noopener noreferrer" style={s.contactLink}>
                                🌐 Official Website
                              </a>
                            )}
                            {rep.email && (
                              <a href={`mailto:${rep.email}`} style={s.contactLink}>
                                ✉️ {rep.email}
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* What may have changed */}
            <div style={s.changeAlert}>
              <p style={s.changeTitle}>⚠️ What May Have Changed Since Your Last Election</p>
              <div style={s.changeList}>
                {[
                  { icon: "🗳️", text: "Your congressional district number or boundaries" },
                  { icon: "🏛️", text: "Your state senate or house district" },
                  { icon: "👤", text: "The representative who serves your area" },
                  { icon: "📍", text: "Your assigned polling place location" },
                  { icon: "📋", text: "Which candidates appear on your ballot" },
                ].map((item, i) => (
                  <div key={i} style={s.changeItem}>
                    <span>{item.icon}</span>
                    <span style={s.changeText}>{item.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Official verification links */}
            <div style={s.verifySection}>
              <p style={s.verifyTitle}>✅ Verify Officially</p>
              <div style={s.verifyLinks}>
                {[
                  { label: "My Voter Page (Georgia SOS)", url: "https://mvp.sos.ga.gov", desc: "Official voter registration and district info" },
                  { label: "Georgia District Maps", url: "https://www.legis.ga.gov/maps", desc: "Official Georgia legislative district maps" },
                  { label: "USA.gov Find My Rep", url: "https://www.usa.gov/elected-officials", desc: "Federal representatives by address" },
                ].map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" style={s.verifyLink}>
                    <span style={s.verifyLinkLabel}>{link.label}</span>
                    <span style={s.verifyLinkDesc}>{link.desc}</span>
                    <span style={{ color: "#4a6080" }}>→</span>
                  </a>
                ))}
              </div>
            </div>

            <button style={s.backBtn} onClick={() => { setStep(1); setResult(null); setError(null); }}>
              ← Check Another Address
            </button>
          </div>
        )}

        <div style={s.footer}>
          <p>Live data from Google Civic Information API · Always verify at <strong>mvp.sos.ga.gov</strong></p>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Source+Sans+3:wght@400;500;600&display=swap');
        @keyframes slideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; }
        input::placeholder { color: #3d5470; }
      `}</style>
    </div>
  );
}

const s = {
  overlay: { position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16, backdropFilter:"blur(4px)" },
  modal: { background:"linear-gradient(160deg,#0c1e3a,#0a1628)", border:"1px solid rgba(255,255,255,0.12)", borderRadius:18, width:"100%", maxWidth:700, maxHeight:"90vh", overflowY:"auto", animation:"slideUp 0.35s ease", fontFamily:"'Source Sans 3',sans-serif", color:"#e0e8f4" },
  header: { display:"flex", alignItems:"center", justifyContent:"space-between", padding:"20px 24px 16px", borderBottom:"1px solid rgba(255,255,255,0.08)" },
  headerLeft: { display:"flex", alignItems:"center", gap:12 },
  headerIcon: { fontSize:32 },
  title: { fontFamily:"'Playfair Display',serif", fontSize:22, color:"#fff", margin:0 },
  subtitle: { fontSize:11, color:"#6b87a8", letterSpacing:2, textTransform:"uppercase", marginTop:3 },
  closeBtn: { background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", color:"#8faabf", borderRadius:6, width:32, height:32, cursor:"pointer", fontSize:14, display:"flex", alignItems:"center", justifyContent:"center" },
  alertBanner: { margin:"16px 24px 0", background:"rgba(178,34,52,0.1)", border:"1px solid rgba(178,34,52,0.3)", borderRadius:10, padding:"12px 16px", display:"flex", gap:12, alignItems:"flex-start" },
  alertIcon: { fontSize:20, marginTop:2, flexShrink:0 },
  alertTitle: { display:"block", color:"#fca5a5", fontSize:13, marginBottom:4 },
  alertBody: { color:"#9a6060", fontSize:12, lineHeight:1.6, margin:0 },
  stepWrap: { padding:"16px 24px 8px" },
  stepLabel: { fontSize:13, color:"#8faabf", marginBottom:12 },
  inputRow: { display:"flex", gap:8, marginBottom:12 },
  input: { flex:1, background:"rgba(255,255,255,0.05)", border:"1.5px solid rgba(255,255,255,0.12)", borderRadius:9, padding:"11px 14px", fontSize:14, color:"#e0e8f4", fontFamily:"'Source Sans 3',sans-serif", outline:"none" },
  searchBtn: { background:"linear-gradient(135deg,#B22234,#8b1a28)", color:"#fff", border:"none", borderRadius:8, padding:"11px 20px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", fontFamily:"'Source Sans 3',sans-serif" },
  btnDisabled: { opacity:0.4, cursor:"not-allowed" },
  errorMsg: { color:"#f87171", fontSize:12, marginBottom:12 },
  eventsSection: { marginTop:20 },
  eventsLabel: { fontSize:11, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.5, marginBottom:12 },
  eventCard: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:12, padding:16, marginBottom:12 },
  eventHeader: { display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8, flexWrap:"wrap", gap:6 },
  eventName: { fontWeight:600, fontSize:14, color:"#dce8f5" },
  eventDate: { fontSize:11, color:"#4a6080", background:"rgba(255,255,255,0.05)", borderRadius:20, padding:"2px 10px" },
  eventDesc: { fontSize:12, color:"#7a96b4", lineHeight:1.6, marginBottom:10 },
  eventDistricts: { background:"rgba(0,0,0,0.2)", borderRadius:8, padding:"10px 12px", marginBottom:8 },
  districtRow: { display:"flex", gap:8, marginBottom:4, flexWrap:"wrap" },
  districtLabel: { fontSize:11, color:"#4a6080", minWidth:110, fontWeight:600 },
  districtValue: { fontSize:11, color:"#8faabf", flex:1 },
  courtCase: { fontSize:11, color:"#4a6080", fontStyle:"italic", marginBottom:6 },
  eventImpact: { fontSize:12, color:"#6b87a8", lineHeight:1.5, margin:0, borderLeft:"2px solid #B22234", paddingLeft:10 },

  // Results
  resultsHeader: { display:"flex", alignItems:"center", gap:12, background:"rgba(60,180,100,0.06)", border:"1px solid rgba(60,180,100,0.15)", borderRadius:10, padding:"12px 16px", marginBottom:16, flexWrap:"wrap" },
  resultsIcon: { fontSize:24 },
  resultsTitle: { fontWeight:600, fontSize:14, color:"#dce8f5", margin:0 },
  resultsAddr: { fontSize:12, color:"#6b87a8", margin:0, marginTop:2 },
  liveBadge: { fontSize:10, background:"rgba(60,180,100,0.18)", color:"#6ee7a0", border:"1px solid rgba(60,180,100,0.3)", borderRadius:20, padding:"3px 10px", fontWeight:600, marginLeft:"auto" },

  districtSummary: { background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:10, padding:"12px 16px", marginBottom:16 },
  districtSummaryLabel: { fontSize:11, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 },
  districtSummaryGrid: { display:"flex", flexWrap:"wrap", gap:10 },
  districtSummaryItem: { display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, padding:"7px 12px" },
  districtSummaryIcon: { fontSize:14 },
  districtSummaryType: { fontSize:11, color:"#6b87a8" },
  districtSummaryNum: { fontSize:13, fontWeight:600, color:"#e0e8f4", marginLeft:4 },

  levelSection: { marginBottom:18 },
  levelLabel: { fontSize:11, color:"#3d5470", textTransform:"uppercase", letterSpacing:1.5, marginBottom:10 },
  repGrid: { display:"flex", flexDirection:"column", gap:8 },
  repCard: { background:"rgba(255,255,255,0.03)", border:"1px solid", borderRadius:10, padding:"12px 16px" },
  repCardTop: { display:"flex", alignItems:"flex-start", gap:10, marginBottom:8 },
  repOffice: { fontSize:11, color:"#6b87a8", margin:0, marginBottom:3 },
  repName: { fontSize:15, fontWeight:600, color:"#fff", margin:0 },
  partyBadge: { fontSize:10, border:"1px solid", borderRadius:20, padding:"2px 10px", fontWeight:600, whiteSpace:"nowrap", flexShrink:0 },
  repContacts: { display:"flex", flexWrap:"wrap", gap:8 },
  contactLink: { fontSize:11, color:"#6b87a8", textDecoration:"none", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:6, padding:"4px 10px" },

  changeAlert: { background:"rgba(251,191,36,0.06)", border:"1px solid rgba(251,191,36,0.15)", borderRadius:10, padding:"14px 16px", marginBottom:16 },
  changeTitle: { fontSize:13, fontWeight:600, color:"#fbbf24", marginBottom:10 },
  changeList: { display:"flex", flexDirection:"column", gap:7 },
  changeItem: { display:"flex", alignItems:"center", gap:10 },
  changeText: { fontSize:12, color:"#a8966a" },

  verifySection: { background:"rgba(99,140,220,0.06)", border:"1px solid rgba(99,140,220,0.15)", borderRadius:10, padding:"14px 16px", marginBottom:16 },
  verifyTitle: { fontSize:13, fontWeight:600, color:"#93b8f0", marginBottom:10 },
  verifyLinks: { display:"flex", flexDirection:"column", gap:8 },
  verifyLink: { display:"flex", alignItems:"center", gap:10, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"10px 14px", textDecoration:"none", flexWrap:"wrap" },
  verifyLinkLabel: { fontSize:13, color:"#93b8f0", fontWeight:600, flex:1 },
  verifyLinkDesc: { fontSize:11, color:"#3d5470" },

  backBtn: { background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.1)", color:"#8faabf", borderRadius:8, padding:"9px 18px", fontSize:13, cursor:"pointer", fontFamily:"'Source Sans 3',sans-serif", marginBottom:16 },
  footer: { padding:"12px 24px 20px", borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:11, color:"#2d4060", textAlign:"center" },
};
