import React from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
const REGION_TO_SITE = {
  "SD-Xfinity":        "DR",
  "Belize City-XOTM":  "BZ",
  "OW-XOTM":           "BZ",
  "San Ignacio-XOTM":  "BZ",
};

const GOALS_STORAGE_KEY = "perf_intel_goals_v1";
const NH_STORAGE_KEY    = "perf_intel_newhires_v1";
const SHEET_URLS_KEY    = "perf_intel_sheet_urls_v1";
const PRIOR_MONTH_STORAGE_KEY = "perf_intel_prior_month_v1";
const DEFAULT_AGENT_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRagC_XDSQ84y25onmWs6MUOZcEdWZNA6fVRRDFUzNWQp3ginYLtOIQsSrwmbAERkOJ-daTvbHqEtoy/pub?gid=667346347&single=true&output=csv";
const DEFAULT_GOALS_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRagC_XDSQ84y25onmWs6MUOZcEdWZNA6fVRRDFUzNWQp3ginYLtOIQsSrwmbAERkOJ-daTvbHqEtoy/pub?gid=1685208822&single=true&output=csv";
const DEFAULT_NH_SHEET_URL    = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRagC_XDSQ84y25onmWs6MUOZcEdWZNA6fVRRDFUzNWQp3ginYLtOIQsSrwmbAERkOJ-daTvbHqEtoy/pub?gid=25912283&single=true&output=csv";
const DEFAULT_PRIOR_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZkBGVIxieyjBKftqL1oecSaUxRkao-gz2B9q4Z8zCY8hEtSy1M28S00RDCS8JVPgPFXJAv2LbsZru/pub?gid=667346347&single=true&output=csv";
const DEFAULT_PRIOR_GOALS_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZkBGVIxieyjBKftqL1oecSaUxRkao-gz2B9q4Z8zCY8hEtSy1M28S00RDCS8JVPgPFXJAv2LbsZru/pub?gid=1685208822&single=true&output=csv";


// ══════════════════════════════════════════════════════════════════════════════
// SECTION 2 — DATA NORMALIZATION  (engine/normalizeAgents.js)
// Two-pass: first normalize each daily row, then aggregate per-agent totals
// and stamp a single true quartile back onto every row for that agent.
// ══════════════════════════════════════════════════════════════════════════════

const VALID_REGIONS = new Set(["SD-Xfinity", "Belize City-XOTM", "OW-XOTM", "San Ignacio-XOTM"]);

const OTM_URL  = "https://smart-gcs.com/otm2/JSON/get/OTM.php?grp=1&job=1&loc=1&reg=1&sup=0&agt=1&dir=0";
const CODE_URL = "https://smart-gcs.com/otm2/JSON/get/Code.php";
// Product codes that count as "goals" from Code.php
const GOAL_CODES = new Set(["420","600","601","602","603","604","605","625","626","627","628","696","706","714"]);

// Distinct colors for each region in Today tab
const REG_COLORS = {
  "SD-Xfinity":       "#d97706",  // amber
  "Belize City-XOTM": "#6366f1",  // indigo
  "OW-XOTM":          "#0891b2",  // cyan/teal
  "San Ignacio-XOTM": "#c026d3",  // fuchsia
};
const getRegColor = (reg) => REG_COLORS[reg] || "#6366f1";

// Human-readable display names for product codes (from Sales_page_names.csv)
const PRODUCT_LABELS = {
  "401": "HBO MAX",
  "402": "Showtime",
  "403": "STARZ",
  "404": "Cinemax",
  "405": "The Movie Channel",
  "409": "Latino Add On",
  "415": "Easy Enroll",
  "417": "Epix",
  "418": "AutoPay",
  "419": "No Upgrade Repackage",
  "432": "Samsung Handset",
  "433": "iPhone Handset",
  "434": "LG Handset",
  "435": "Motorola Handset",
  "436": "BYOD Handset (XMC)",
  "437": "Google Pixel",
  "438": "Tablet",
  "439": "Smart Watch",
  "440": "Case",
  "441": "Screen Protector",
  "442": "Memory Card",
  "443": "Portable Charger",
  "444": "Charging Pad",
  "445": "Charging Stand",
  "446": "Wall Charger",
  "459": "Sports & News Pack",
  "460": "Kids & Family Pack",
  "461": "Entertainment Pack",
  "462": "More Sports & Entertainment",
  "463": "Deportes Add On",
  "464": "Scheduled Install",
  "465": "Xfinity Flex",
  "466": "SIK",
  "467": "XH Consult",
  "468": "xFi Complete",
  "469": "XH Camera",
  "470": "XH In-home Consult",
  "475": "X1 HD/DVR",
  "481": "Corrected Order",
  "482": "Gateway Modem",
  "483": "xCam",
  "484": "Unlimited HSD",
  "486": "Comcast Doorbell",
  "487": "Comcast Smartlock",
  "488": "Wifi Pass",
  "489": "Premiums Add On",
  "490": "Carefree World 300",
  "491": "Carefree Latin America 300",
  "492": "XM Device Upgrade",
  "493": "Xumo Stream Box",
  "495": "Streamsaver",
  "500": "Choice TV",
  "501": "Popular TV",
  "502": "Ultimate TV",
  "503": "NowTV",
  "504": "Prepaid Video",
  "513": "Prepaid HSD",
  "514": "Xfinity Voice",
  "515": "Pro Protection XH",
  "516": "Pro Protection Plus XH",
  "517": "Self Protection",
  "518": "Unlimited Intro XM",
  "519": "Unlimited Plus XM",
  "522": "Unlimited Premium XM",
  "523": "By The Gig XM",
  "524": "Now XI 200",
  "525": "Now XI 100",
  "550": "5 Year Price Lock",
  "551": "NowTV Latino",
  "552": "Next Gen 300MB HSD",
  "553": "Next Gen 500MB HSD",
  "554": "Next Gen Gig HSD",
  "555": "Next Gen 2Gig HSD",
  "556": "1 Year Price Lock",
  "600": "HSD Beyond Fast",
  "601": "HSD Super Fast",
  "602": "HSD Even Faster",
  "603": "HSD",
  "604": "HSD Fast",
  "605": "HSD (605)",
  "610": "Voice",
  "696": "Cox Unlimited",
  "701": "New Video",
  "702": "New HSD",
  "703": "New Phone",
  "704": "New XH",
  "706": "HSD Save RGU",
  "713": "Tier Upgrade - Video",
  "714": "Tier Upgrade - HSD",
  "715": "Tier Upgrade - Phone",
  "716": "Tier Upgrade - XH",
  "717": "New Mobile",
  "725": "Tier Upgrade - Mobile",
  "740": "New NOW XI 100",
  "742": "New NOW XI 200",
  "744": "New NOW XM",
  "817": "XM Protection Plan",
};
const prodLabel = (cod, apiCodes) =>
  PRODUCT_LABELS[String(cod)] || apiCodes[String(cod)] || `Code ${cod}`;

// HSD Sell-In % = New RGU - HSD (code 702) / Sales
// Mobile Sell-In % = New RGU - Mobile (code 717) / Sales
const NEW_HSD_CODE = "702";
const NEW_MOBILE_CODE = "717";
const deriveHsdXm = (products) => ({
  hsd: Number(products[NEW_HSD_CODE]) || 0,
  xml: Number(products[NEW_MOBILE_CODE]) || 0,
});

// ── Components ───────────────────────────────────────────────────────────────
// ── TVMode — Screensaver for TV displays ─────────────────────────────────────
// Full-screen auto-rotating view using current theme, site filter, campaign comparison.
function TVMode({ d, codes, doFetch, lastRefresh, onExit }) {
  const [slideIdx, setSlideIdx] = useState(0);
  const [tvSite, setTvSite] = useState("ALL"); // ALL | DR | BZ
  const CYCLE_MS = 12000;
  const COST_PER_HOUR = 19.77;

  const getSite = (reg) => (reg || "").toUpperCase().includes("XOTM") ? "BZ" : "DR";

  // Group programs by campaign name, with per-site breakdowns
  const campaignMap = useMemo(() => {
    if (!d) return {};
    const map = {};
    d.programs.forEach(p => {
      const key = p.grp;
      if (!map[key]) map[key] = { grp: key, sites: {} };
      const site = getSite(p.reg);
      if (!map[key].sites[site]) map[key].sites[site] = { hrs: 0, goals: 0, rgu: 0, hsd: 0, xm: 0, agents: new Set() };
      const s = map[key].sites[site];
      s.hrs += p.hrs; s.goals += p.effectiveGoals; s.rgu += p.rgu;
      s.hsd += p.hsd || 0; s.xm += p.xml || 0;
      p.agts.forEach(n => s.agents.add(n));
    });
    return map;
  }, [d]);

  // Build slides based on site filter
  const slides = useMemo(() => {
    if (!d) return [];
    const s = [];
    const siteAgents = tvSite === "ALL" ? d.agents : d.agents.filter(a => getSite(a.reg) === tvSite);
    const sitePrograms = tvSite === "ALL" ? d.programs : d.programs.filter(p => getSite(p.reg) === tvSite);

    // Overview slide
    const totHrs = siteAgents.reduce((a, x) => a + x.hrs, 0);
    const totGoals = siteAgents.reduce((a, x) => a + x.effectiveGoals, 0);
    const totRgu = siteAgents.reduce((a, x) => a + x.rgu, 0);
    const totHsd = sitePrograms.reduce((a, p) => a + (p.hsd || 0), 0);
    const totXm = sitePrograms.reduce((a, p) => a + (p.xml || 0), 0);
    s.push({ type: "overview", label: tvSite === "ALL" ? "Company Overview" : tvSite === "DR" ? "Dominican Republic" : "Belize",
      agentCount: siteAgents.length, hrs: totHrs, goals: totGoals, rgu: totRgu, hsd: totHsd, xm: totXm, programs: sitePrograms });

    // Per-campaign slides
    const grpTotals = {};
    sitePrograms.forEach(p => {
      if (!grpTotals[p.grp]) grpTotals[p.grp] = { grp: p.grp, hrs: 0, goals: 0, rgu: 0, hsd: 0, xm: 0, agents: new Set(), pctSum: 0, pctCount: 0 };
      const g = grpTotals[p.grp];
      g.hrs += p.hrs; g.goals += p.effectiveGoals; g.rgu += p.rgu;
      g.hsd += p.hsd || 0; g.xm += p.xml || 0;
      p.agts.forEach(n => g.agents.add(n));
      if (p.pctToGoal !== null && p.pctToGoal !== undefined) { g.pctSum += p.pctToGoal * p.agentCount; g.pctCount += p.agentCount; }
    });
    Object.values(grpTotals).sort((a, b) => b.hrs - a.hrs).forEach(g => {
      const bothSites = campaignMap[g.grp] && Object.keys(campaignMap[g.grp].sites).length > 1;
      s.push({ type: "campaign", label: g.grp, ...g, agentCount: g.agents.size,
        pctToGoal: g.pctCount > 0 ? g.pctSum / g.pctCount : null,
        bothSites, comparison: bothSites ? campaignMap[g.grp].sites : null });
    });

    return s;
  }, [d, tvSite, campaignMap]);

  useEffect(() => { setSlideIdx(0); }, [tvSite]);
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => setSlideIdx(i => (i + 1) % slides.length), CYCLE_MS);
    return () => clearInterval(timer);
  }, [slides.length]);
  useEffect(() => {
    const interval = setInterval(doFetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [doFetch]);
  useEffect(() => {
    const handler = e => { if (e.key === "Escape") onExit(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onExit]);

  if (slides.length === 0) return null;
  const slide = slides[slideIdx % slides.length];
  const fmt = (v, dec = 0) => dec > 0 ? Number(v).toFixed(dec) : Math.round(v).toLocaleString();
  const now = lastRefresh ? new Date(lastRefresh).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const cps = (hrs, goals) => goals > 0 ? `$${((hrs * COST_PER_HOUR) / goals).toFixed(2)}` : "–";
  const pctFmt = (v) => v !== null && v !== undefined ? `${Math.round(v)}%` : "–";

  // Stat card — big number with label
  const Stat = ({ value, label, color }) => (
    <div style={{ flex: "1 1 0", textAlign: "center", padding: "1rem 0.5rem" }}>
      <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "clamp(2.5rem, 5vw, 4.5rem)", color, fontWeight: 800, lineHeight: 1, letterSpacing: "-0.03em" }}>{value}</div>
      <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "clamp(0.7rem, 1.2vw, 0.95rem)", color: `var(--text-muted)`, marginTop: "0.4rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{label}</div>
    </div>
  );

  // Site comparison column
  const SiteCol = ({ data, label, color }) => {
    if (!data) return null;
    const gph = data.hrs > 0 ? data.goals / data.hrs : 0;
    return (
      <div style={{ flex: "1 1 0", background: `var(--bg-tertiary)`, borderRadius: "var(--radius-lg, 16px)", padding: "1.5rem", border: `2px solid ${color}30` }}>
        <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "1rem", color, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem", textAlign: "center" }}>{label}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem 1.5rem" }}>
          {[
            { l: "Agents", v: data.agents.size, c: "#16a34a" },
            { l: "Hours", v: fmt(data.hrs, 1), c: "#6366f1" },
            { l: "Sales", v: data.goals, c: "#d97706" },
            { l: "GPH", v: gph.toFixed(3), c: "#16a34a" },
            { l: "RGU", v: data.rgu || "–", c: "#2563eb" },
            { l: "HSD", v: data.hsd || "–", c: "#f59e0b" },
            { l: "XM Lines", v: data.xm || "–", c: "#ec4899" },
            { l: "Cost/Sale", v: cps(data.hrs, data.goals), c: data.goals > 0 ? "#16a34a" : `var(--text-faint)` },
          ].map(({ l, v, c }) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "clamp(1.5rem, 3vw, 2.5rem)", color: c, fontWeight: 700, lineHeight: 1 }}>{v}</div>
              <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", color: `var(--text-faint)`, marginTop: "0.2rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>{l}</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSlide = () => {
    const gph = slide.hrs > 0 ? slide.goals / slide.hrs : 0;
    const pct = slide.pctToGoal;

    if (slide.type === "overview") {
      return (
        <>
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <Stat value={slide.agentCount} label="On Floor" color="#16a34a" />
            <Stat value={fmt(slide.hrs, 1)} label="Hours" color="#6366f1" />
            <Stat value={slide.goals} label="Sales" color="#d97706" />
            <Stat value={gph.toFixed(3)} label="GPH" color="#16a34a" />
            <Stat value={slide.rgu || "–"} label="RGU" color="#2563eb" />
            <Stat value={slide.hsd || "–"} label="HSD" color="#f59e0b" />
            <Stat value={slide.xm || "–"} label="XM Lines" color="#ec4899" />
            <Stat value={cps(slide.hrs, slide.goals)} label="Cost/Sale" color={slide.goals > 0 ? "#16a34a" : `var(--text-faint)`} />
          </div>
          {/* Campaign table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid var(--border)` }}>
                  {["Campaign","Agents","Hours","Sales","GPH","RGU","HSD","XM","Cost/Sale","% Goal"].map((h, i) => (
                    <th key={h} style={{ padding: "0.6rem 0.75rem", textAlign: i === 0 ? "left" : "right", color: `var(--text-muted)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "clamp(0.7rem, 1vw, 0.85rem)", fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slide.programs.sort((a, b) => b.hrs - a.hrs).reduce((acc, p) => {
                  const existing = acc.find(x => x.grp === p.grp);
                  if (existing) { existing.hrs += p.hrs; existing.goals += p.effectiveGoals; existing.rgu += p.rgu; existing.hsd += p.hsd || 0; existing.xm += p.xml || 0; p.agts.forEach(n => existing._agents.add(n)); if (p.pctToGoal !== null) { existing._pctSum += p.pctToGoal * p.agentCount; existing._pctN += p.agentCount; } }
                  else acc.push({ grp: p.grp, hrs: p.hrs, goals: p.effectiveGoals, rgu: p.rgu, hsd: p.hsd || 0, xm: p.xml || 0, _agents: new Set(p.agts), _pctSum: p.pctToGoal !== null ? p.pctToGoal * p.agentCount : 0, _pctN: p.pctToGoal !== null ? p.agentCount : 0 });
                  return acc;
                }, []).sort((a, b) => b.hrs - a.hrs).map((p, i) => {
                  const pGph = p.hrs > 0 ? p.goals / p.hrs : 0;
                  const pPct = p._pctN > 0 ? p._pctSum / p._pctN : null;
                  return (
                    <tr key={i} style={{ borderBottom: `1px solid var(--border)`, background: i % 2 === 0 ? "transparent" : `var(--bg-row-alt)` }}>
                      <td style={{ padding: "0.6rem 0.75rem", color: `var(--text-warm)`, fontSize: "clamp(0.85rem, 1.2vw, 1.1rem)", fontWeight: 600 }}>{p.grp}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: `var(--text-secondary)`, fontSize: "1rem", textAlign: "right" }}>{p._agents.size}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#6366f1", fontSize: "1rem", textAlign: "right", fontWeight: 600 }}>{fmt(p.hrs, 1)}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#d97706", fontSize: "1rem", textAlign: "right", fontWeight: 600 }}>{p.goals}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#16a34a", fontSize: "1rem", textAlign: "right", fontWeight: 600 }}>{pGph.toFixed(3)}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#2563eb", fontSize: "1rem", textAlign: "right" }}>{p.rgu || "–"}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#f59e0b", fontSize: "1rem", textAlign: "right" }}>{p.hsd || "–"}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: "#ec4899", fontSize: "1rem", textAlign: "right" }}>{p.xm || "–"}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: p.goals > 0 ? "#16a34a" : `var(--text-faint)`, fontSize: "1rem", textAlign: "right" }}>{cps(p.hrs, p.goals)}</td>
                      <td style={{ padding: "0.6rem 0.75rem", color: pPct !== null ? (pPct >= 100 ? "#16a34a" : pPct >= 80 ? "#d97706" : "#dc2626") : `var(--text-faint)`, fontSize: "1rem", textAlign: "right", fontWeight: 600 }}>{pctFmt(pPct)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      );
    }

    if (slide.type === "campaign") {
      return (
        <>
          {/* Campaign headline stats */}
          <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
            <Stat value={slide.agentCount} label="Agents" color="#16a34a" />
            <Stat value={fmt(slide.hrs, 1)} label="Hours" color="#6366f1" />
            <Stat value={slide.goals} label="Sales" color="#d97706" />
            <Stat value={gph.toFixed(3)} label="GPH" color="#16a34a" />
            <Stat value={slide.rgu || "–"} label="RGU" color="#2563eb" />
            <Stat value={slide.hsd || "–"} label="HSD" color="#f59e0b" />
            <Stat value={slide.xm || "–"} label="XM Lines" color="#ec4899" />
            <Stat value={cps(slide.hrs, slide.goals)} label="Cost/Sale" color={slide.goals > 0 ? "#16a34a" : `var(--text-faint)`} />
            <Stat value={pctFmt(pct)} label="% to Goal" color={pct !== null ? (pct >= 100 ? "#16a34a" : pct >= 80 ? "#d97706" : "#dc2626") : `var(--text-faint)`} />
          </div>

          {/* Side-by-side site comparison if both sites dial this campaign */}
          {slide.bothSites && slide.comparison && (
            <div style={{ display: "flex", gap: "1.5rem" }}>
              <SiteCol data={slide.comparison["DR"]} label="Dominican Republic" color="#6366f1" />
              <SiteCol data={slide.comparison["BZ"]} label="Belize" color="#16a34a" />
            </div>
          )}
        </>
      );
    }
    return null;
  };

  const siteBtnStyle = (active) => ({
    padding: "0.3rem 0.85rem", border: "none", borderRadius: 0,
    fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.78rem", cursor: "pointer",
    fontWeight: active ? 700 : 400, letterSpacing: "0.04em",
    background: active ? "#d9770620" : "transparent",
    color: active ? "#d97706" : `var(--text-dim)`,
  });

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: `var(--bg-primary)`, color: `var(--text-primary)`, fontFamily: "var(--font-ui, Inter, sans-serif)", display: "flex", flexDirection: "column", overflow: "hidden" }}
      onClick={e => { if (e.detail === 2) onExit(); }}>

      {/* Top bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "1rem 2.5rem", borderBottom: `1px solid var(--border)`, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#16a34a", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: "0.82rem", color: "#16a34a", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 600 }}>LIVE</span>
          <span style={{ fontSize: "0.78rem", color: `var(--text-faint)` }}>updated {now}</span>
        </div>

        <div style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)", color: `var(--text-warm)`, fontWeight: 800, letterSpacing: "-0.02em" }}>{slide.label}</div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          {/* Site filter */}
          <div style={{ display: "inline-flex", borderRadius: "var(--radius-sm, 6px)", border: `1px solid var(--border)`, overflow: "hidden" }}>
            {[["ALL","All"],["DR","DR"],["BZ","BZ"]].map(([k, label]) => (
              <button key={k} onClick={e => { e.stopPropagation(); setTvSite(k); }} style={siteBtnStyle(tvSite === k)}>{label}</button>
            ))}
          </div>
          {/* Dots */}
          <div style={{ display: "flex", gap: "0.3rem" }}>
            {slides.map((_, i) => (
              <div key={i} onClick={e => { e.stopPropagation(); setSlideIdx(i); }}
                style={{ width: i === slideIdx % slides.length ? "18px" : "6px", height: "6px", borderRadius: "3px",
                  background: i === slideIdx % slides.length ? "#d97706" : `var(--border)`, transition: "all 0.3s ease", cursor: "pointer" }} />
            ))}
          </div>
          <button onClick={e => { e.stopPropagation(); onExit(); }}
            style={{ background: "transparent", border: `1px solid var(--border)`, borderRadius: "6px", color: `var(--text-dim)`, padding: "0.3rem 0.65rem", fontSize: "0.72rem", cursor: "pointer" }}>
            ESC
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: "3px", background: `var(--border)`, flexShrink: 0 }}>
        <div key={slideIdx} style={{ height: "100%", background: "#d97706", animation: `tvProgress ${CYCLE_MS}ms linear forwards`, width: "0%" }} />
      </div>

      {/* Slide content */}
      <div style={{ flex: 1, overflow: "auto", padding: "1.5rem 2.5rem" }}>
        {renderSlide()}
      </div>

      {/* Footer */}
      <div style={{ padding: "0.6rem 2.5rem", borderTop: `1px solid var(--border)`, display: "flex", justifyContent: "space-between", flexShrink: 0 }}>
        <span style={{ fontSize: "0.72rem", color: `var(--text-faint)` }}>Performance Intel · TV Mode</span>
        <span style={{ fontSize: "0.72rem", color: `var(--text-faint)` }}>Double-click or ESC to exit · Click dots to jump</span>
      </div>

      <style>{`
        @keyframes tvProgress { from { width: 0%; } to { width: 100%; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </div>
  );
}

function TodayView({ recentAgentNames, historicalAgentMap, goalLookup }) {
  const [raw,         setRaw]         = useState(() => {
    try {
      const saved = localStorage.getItem("today_raw_data");
      return saved ? JSON.parse(saved) : null;
    } catch(e) { return null; }
  });
  const [codes,       setCodes]       = useState(() => {
    try {
      const saved = localStorage.getItem("today_codes");
      return saved ? JSON.parse(saved) : {};
    } catch(e) { return {}; }
  });
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);
  const [lastRefresh, setLastRefresh] = useState(() => {
    try {
      const saved = localStorage.getItem("today_last_refresh");
      return saved ? new Date(saved) : null;
    } catch(e) { return null; }
  });
  const [sortBy,      setSortBy]      = useState("hrs");
  const [sortDir,     setSortDir]     = useState(-1);
  const [showAbsent,  setShowAbsent]  = useState(true);
  const [pasteMode,   setPasteMode]   = useState(false);
  const [pasteText,   setPasteText]   = useState("");
  const [pasteError,  setPasteError]  = useState(null);
  const [progSortBy,  setProgSortBy]  = useState("hrs");
  const [progSortDir, setProgSortDir] = useState(-1);
  const [progSiteFilter, setProgSiteFilter] = useState(null);
  const [bzSiteFilter,   setBzSiteFilter]   = useState(null); // null = combined BZ, or specific region name
  const [lbRegion,    setLbRegion]    = useState("All");
  const [lbJob,       setLbJob]       = useState(null);
  const [selectedCodes, setSelectedCodes] = useState(() => {
    try {
      const saved = localStorage.getItem("today_selected_codes");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch(e) { return new Set(); }
  });
  const [codeDropOpen,  setCodeDropOpen]  = useState(false);

  // Active agents tracking: store agent→hours from previous load.
  // An agent is "active" if their hours increased between refreshes (still dialing).
  const [prevAgentHours, _setPrevAgentHours] = useState(() => {
    try { const s = localStorage.getItem("today_prev_agent_hours"); return s ? JSON.parse(s) : {}; } catch(e) { return {}; }
  });
  const setPrevAgentHours = useCallback(map => {
    _setPrevAgentHours(map);
    try { localStorage.setItem("today_prev_agent_hours", JSON.stringify(map)); } catch(e) {}
  }, []);
  const [activeOnly, setActiveOnly] = useState(false);
  const [screensaverMode, setScreensaverMode] = useState(false);

  // Persist code selection to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem("today_selected_codes", JSON.stringify([...selectedCodes]));
    } catch(e) {}
  }, [selectedCodes]);

  // Persist raw data, codes, and refresh timestamp to localStorage
  useEffect(() => {
    try {
      if (raw) localStorage.setItem("today_raw_data", JSON.stringify(raw));
    } catch(e) {}
  }, [raw]);
  useEffect(() => {
    try {
      if (codes && Object.keys(codes).length > 0) localStorage.setItem("today_codes", JSON.stringify(codes));
    } catch(e) {}
  }, [codes]);
  useEffect(() => {
    try {
      if (lastRefresh) localStorage.setItem("today_last_refresh", lastRefresh.toISOString());
    } catch(e) {}
  }, [lastRefresh]);

  // Try a live fetch first; if it fails, try CORS proxy, then fall through to paste mode
  const doFetch = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      let otm, cArr;
      try {
        // Direct fetch first
        const [otmRes, codeRes] = await Promise.all([fetch(OTM_URL), fetch(CODE_URL)]);
        otm  = await otmRes.json();
        cArr = await codeRes.json();
      } catch(e) {
        // If direct fails (CORS), try with no-cors or proxy
        const proxyUrl = url => `https://corsproxy.io/?${encodeURIComponent(url)}`;
        const [otmRes, codeRes] = await Promise.all([fetch(proxyUrl(OTM_URL)), fetch(proxyUrl(CODE_URL))]);
        otm  = await otmRes.json();
        cArr = await codeRes.json();
      }
      if (!Array.isArray(otm)) throw new Error("Unexpected response format");
      const cMap = {};
      cArr.forEach(c => { cMap[String(c.cod)] = c.nam; });
      // Snapshot current agent→hours before replacing data (for active detection)
      if (raw && Array.isArray(raw)) {
        const hoursMap = {};
        raw.forEach(r => {
          const name = (r.agt || "").trim();
          if (name) hoursMap[name] = (hoursMap[name] || 0) + (Number(r.hrs) || 0);
        });
        if (Object.keys(hoursMap).length > 0) setPrevAgentHours(hoursMap);
      }
      setCodes(cMap);
      setRaw(otm);
      setLastRefresh(new Date());
      setPasteMode(false);
    } catch(e) {
      // All fetch methods failed — switch to paste mode only if no cached data
      if (!raw) setPasteMode(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePaste = useCallback(() => {
    setPasteError(null);
    try {
      const parsed = JSON.parse(pasteText.trim());
      if (!Array.isArray(parsed)) throw new Error("Expected a JSON array — make sure you copied the full page content.");
      if (raw && Array.isArray(raw)) {
        const hoursMap = {};
        raw.forEach(r => {
          const name = (r.agt || "").trim();
          if (name) hoursMap[name] = (hoursMap[name] || 0) + (Number(r.hrs) || 0);
        });
        if (Object.keys(hoursMap).length > 0) setPrevAgentHours(hoursMap);
      }
      setRaw(parsed);
      setLastRefresh(new Date());
      setPasteMode(false);
      setPasteText("");
    } catch(e) {
      setPasteError(e.message);
    }
  }, [pasteText]);

  useEffect(() => {
    doFetch();
    // Auto-refresh every 5 minutes
    const interval = setInterval(doFetch, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [doFetch]);

  const d = useMemo(() => {
    if (!raw) return null;
    // Guard: OTM endpoint must return an array
    if (!Array.isArray(raw)) return null;

    // ── Filter to known regions only ────────────────────────────────────────
    const ALLOWED_REGIONS = new Set([
      "Belize City-XOTM", "OW-XOTM", "SD-Xfinty", "San Ignacio-XOTM",
      // also accept the corrected spelling just in case
      "SD-Xfinity",
      // SD-Cox included so GL-job agents can be remapped
      "SD-Cox",
    ]);
    // Exclude GS jobs and anything with "cox" in the group name
    // BUT allow SD-Cox agents dialing GL (Xfinity) campaigns
    const filtered = raw.filter(row => {
      const reg = (row.reg || "").trim();
      const job = String(row.job || "").trim().toUpperCase();
      const grp = String(row.grp || "").trim().toUpperCase();
      if (!ALLOWED_REGIONS.has(reg)) return false;
      // SD-Cox: only include if job starts with GL (Xfinity program)
      if (reg === "SD-Cox") return job.startsWith("GL");
      // For all other regions, exclude GS jobs and Cox group names
      return !job.startsWith("GS") && !grp.includes("COX");
    });

    // ── Per-unique-agent aggregate ──────────────────────────────────────────
    // Normalize region spelling (match historical data)
    const fixReg = r => {
      const t = (r || "?").trim();
      return t === "SD-Xfinty" ? "SD-Xfinity" : t === "SD-Cox" ? "SD-Xfinity" : t;
    };
    const agentMap = {};
    // Per-agent-per-job map for job-level drilldowns
    const agentJobMap = {};
    filtered.forEach(row => {
      const name = (row.agt || "").trim();
      if (!name) return;
      const grp = row.grp || "?";
      const regNorm = fixReg(row.reg);
      // Unique agent aggregate
      if (!agentMap[name]) {
        agentMap[name] = {
          name, loc: row.loc || "?", reg: regNorm,
          grps: new Set(), hrs: 0, sal: 0, rgu: 0, goals: 0,
          products: {},
        };
      }
      const a = agentMap[name];
      a.hrs  += Number(row.hrs)  || 0;
      a.sal  += Number(row.sal)  || 0;
      a.rgu  += Number(row.rgu)  || 0;
      a.reg   = regNorm;
      a.grps.add(grp);
      // Per-agent-per-job aggregate
      const ajKey = `${name}|||${grp}`;
      if (!agentJobMap[ajKey]) {
        agentJobMap[ajKey] = {
          name, loc: row.loc || "?", reg: regNorm,
          grps: new Set([grp]), job: grp, hrs: 0, sal: 0, rgu: 0, goals: 0,
          products: {},
        };
      }
      const aj = agentJobMap[ajKey];
      aj.hrs += Number(row.hrs) || 0;
      aj.sal += Number(row.sal) || 0;
      aj.rgu += Number(row.rgu) || 0;
      aj.reg  = regNorm;
      // Track ALL numeric product code columns (not just GOAL_CODES)
      Object.keys(row).forEach(k => {
        const v = Number(row[k]);
        if (v > 0 && /^\d+$/.test(k)) {
          a.products[k] = (a.products[k] || 0) + v;
          aj.products[k] = (aj.products[k] || 0) + v;
          if (GOAL_CODES.has(k)) { a.goals += v; aj.goals += v; }
        }
      });
    });

    const agents = Object.values(agentMap).map(a => {
      const effectiveGoals = a.sal > 0 ? a.sal : a.goals;
      const hist = historicalAgentMap[a.name.toLowerCase()];
      const sphGoal = hist?.sphGoal || 0;
      const pctToGoal = sphGoal > 0 && a.hrs > 0
        ? (effectiveGoals / (sphGoal * a.hrs)) * 100
        : null;
      return { ...a, effectiveGoals, sphGoal, pctToGoal, quartile: hist?.quartile || null, jobType: hist?.jobType || [...a.grps][0] || "?", ...deriveHsdXm(a.products) };
    });

    // Per-agent-per-job finalized entries (for job drilldowns)
    const agentsByJob = Object.values(agentJobMap).map(a => {
      const effectiveGoals = a.sal > 0 ? a.sal : a.goals;
      const hist = historicalAgentMap[a.name.toLowerCase()];
      const sphGoal = hist?.sphGoal || 0;
      const pctToGoal = sphGoal > 0 && a.hrs > 0
        ? (effectiveGoals / (sphGoal * a.hrs)) * 100
        : null;
      return { ...a, effectiveGoals, sphGoal, pctToGoal, quartile: hist?.quartile || null, jobType: a.job, ...deriveHsdXm(a.products) };
    });
    // ── Active agent detection: hours increased since last refresh ─────────
    const hasPrevHours = Object.keys(prevAgentHours).length > 0;
    const activeAgentNames = new Set();
    if (hasPrevHours) {
      agents.forEach(a => {
        const prevHrs = prevAgentHours[a.name] || 0;
        if (a.hrs > prevHrs) activeAgentNames.add(a.name);
      });
    }
    const allAgentCount = agents.length;
    const activeAgentCount = hasPrevHours ? activeAgentNames.size : agents.length;

    // Filter to active-only when toggled (applied to agents, agentsByJob, and raw rows for programs)
    const displayAgents = activeOnly && hasPrevHours ? agents.filter(a => activeAgentNames.has(a.name)) : agents;
    const displayAgentsByJob = activeOnly && hasPrevHours ? agentsByJob.filter(a => activeAgentNames.has(a.name)) : agentsByJob;
    const displayNames = new Set(displayAgents.map(a => a.name));
    const todayNames = new Set(agents.map(a => a.name));

    // ── Attendance analysis — split by region ───────────────────────────────
    const absent   = [...recentAgentNames].filter(n => !todayNames.has(n));
    const newFaces = [...todayNames].filter(n => {
      if (recentAgentNames.has(n)) return false;
      // Only show new faces that are in valid regions
      const agent = agents.find(a => a.name === n);
      return agent && VALID_REGIONS.has(agent.reg);
    });

    // Group absent agents by their historical region — only show known valid regions
    const absentByRegion = {};
    const validAbsent = [];
    absent.forEach(name => {
      const hist = historicalAgentMap[name.toLowerCase()];
      const reg  = hist?.region || "Unknown";
      if (!VALID_REGIONS.has(reg)) return; // omit Unknown / non-valid regions
      if (!absentByRegion[reg]) absentByRegion[reg] = [];
      absentByRegion[reg].push({ name, quartile: hist?.quartile || null });
      validAbsent.push(name);
    });

    // ── By Region — built from RAW ROWS, not agent aggregates ──────────────
    // CRITICAL: agents[] merges all rows per name and sets .reg to the LAST
    // seen region. Any agent appearing in programs from two different regions
    // (e.g. SD-Xfinity + BZ) would have ALL their hours mis-attributed to
    // whichever region processed last. We must sum hours at the row level so
    // each row's hours land in that row's region.
    const displayFiltered = activeOnly && hasPrevHours
      ? filtered.filter(row => displayNames.has((row.agt || "").trim()))
      : filtered;
    const byReg = {};
    const byRegAgentSets = {}; // reg → Set<agentName> for unique head count
    displayFiltered.forEach(row => {
      const r  = fixReg(row.reg);
      if (!VALID_REGIONS.has(r)) return;
      const nm = (row.agt || "").trim();
      if (!byReg[r]) {
        byReg[r] = { count: 0, hrs: 0, goals: 0, sal: 0, rgu: 0, pctSum: 0, pctCount: 0, products: {} };
        byRegAgentSets[r] = new Set();
      }
      byRegAgentSets[r].add(nm);
      byReg[r].hrs += Number(row.hrs) || 0;
      byReg[r].sal += Number(row.sal) || 0;
      byReg[r].rgu += Number(row.rgu) || 0;
      Object.keys(row).forEach(k => {
        const v = Number(row[k]);
        if (v > 0 && /^\d+$/.test(k)) {
          byReg[r].products[k] = (byReg[r].products[k] || 0) + v;
          if (GOAL_CODES.has(k)) byReg[r].goals += v;
        }
      });
    });
    // Finalise: agent count, goals fallback, pct-to-goal average
    Object.entries(byReg).forEach(([r, s]) => {
      s.count  = byRegAgentSets[r].size;
      s.goals  = s.sal > 0 ? s.sal : s.goals;
      agents.filter(a => byRegAgentSets[r].has(a.name)).forEach(a => {
        if (a.pctToGoal !== null) { s.pctSum += a.pctToGoal; s.pctCount++; }
      });
    });

    // ── By Location (kept for legacy pulse cards) ────────────────────────────
    const byLoc = {};
    displayAgents.forEach(a => {
      const l = a.loc;
      if (!byLoc[l]) byLoc[l] = { count: 0, hrs: 0, goals: 0 };
      byLoc[l].count++;
      byLoc[l].hrs   += a.hrs;
      byLoc[l].goals += a.effectiveGoals;
    });

    // ── By program/group — with % to goal via goalLookup ────────────────────
    const grpMap = {};
    displayFiltered.forEach(row => {
      const g       = row.grp || "Unknown";
      const regNorm = fixReg(row.reg);
      const jobCode = (row.job || "").trim();
      // Key by reg|job so each ROC code gets its own row. Fall back to grp if no job.
      const key = jobCode ? `${regNorm}|${jobCode}` : `${regNorm}|${g}`;
      if (!grpMap[key]) grpMap[key] = { grp: g, loc: row.loc || "?", reg: regNorm, roc: jobCode, agts: new Set(), hrs: 0, sal: 0, goals: 0, rgu: 0, products: {} };
      grpMap[key].agts.add((row.agt || "").trim());
      grpMap[key].hrs += Number(row.hrs) || 0;
      grpMap[key].sal += Number(row.sal) || 0;
      grpMap[key].rgu += Number(row.rgu) || 0;
      Object.keys(row).forEach(k => {
        const v = Number(row[k]);
        if (v > 0 && /^\d+$/.test(k)) {
          grpMap[key].products[k] = (grpMap[key].products[k] || 0) + v;
          if (GOAL_CODES.has(k)) grpMap[key].goals += v;
        }
      });
    });
    // Build agent pctToGoal lookup for program-level fallback
    const agentPctMap = {};
    agents.forEach(a => { if (a.pctToGoal !== null) agentPctMap[a.name] = a.pctToGoal; });

    const programs = Object.values(grpMap).map(p => {
      // Use sal as primary goals metric, fall back to GOAL_CODES sum
      const effectiveGoals = p.sal > 0 ? p.sal : p.goals;
      // Try to find a daily goal for this program via goalLookup (sphGoal × hrs)
      let sphGoal = null;
      if (goalLookup) {
        // Try ROC code match first (direct 1:1)
        let entries = p.roc ? getGoalEntries(goalLookup, p.grp, p.roc) : [];
        // Fall back to name matching
        if (entries.length === 0) entries = getGoalEntries(goalLookup, p.grp);
        if (entries.length > 0) {
          // Use site-specific SPH goal: BZ regions get BZ goal, DR gets DR goal
          const isBZ = (p.reg || "").toUpperCase().includes("XOTM");
          const siteKey = isBZ ? "BZ" : "DR";
          const siteRows = entries.flatMap(e => e.siteMap[siteKey] || []);
          const goalRows = siteRows.length > 0 ? siteRows : entries.flatMap(e => Object.values(e.siteMap).flat());
          const vals = goalRows.map(r => computePlanRow(r).sphGoal).filter(v => v > 0);
          if (vals.length) sphGoal = vals.reduce((s,v)=>s+v,0) / vals.length;
        }
      }
      let pctToGoal = sphGoal && p.hrs > 0 ? (effectiveGoals / (sphGoal * p.hrs)) * 100 : null;
      // Fallback: average pctToGoal of agents in this program (mirrors byReg logic)
      // But only if the program actually has sales — 0 sales = 0% regardless of agent averages
      if (pctToGoal === null && effectiveGoals > 0) {
        const agentPcts = [...p.agts].map(n => agentPctMap[n]).filter(v => v !== undefined);
        if (agentPcts.length > 0) pctToGoal = agentPcts.reduce((s, v) => s + v, 0) / agentPcts.length;
      } else if (pctToGoal === null && effectiveGoals === 0 && p.hrs > 0) {
        pctToGoal = 0;
      }
      return { ...p, effectiveGoals, agentCount: p.agts.size, sphGoal, pctToGoal, ...deriveHsdXm(p.products) };
    }).sort((a, b) => b.hrs - a.hrs);

    // ── Unique regions for site filter ──────────────────────────────────────
    const uniqueRegs = [...new Set(displayAgents.map(a => a.reg))].sort();

    // ── Product mix ─────────────────────────────────────────────────────────
    const productTotals = {};
    displayAgents.forEach(a => {
      Object.entries(a.products).forEach(([k, v]) => {
        productTotals[k] = (productTotals[k] || 0) + v;
      });
    });

    // ── Collect all unique product codes for dynamic columns ─────────────
    const allProductCodes = [...new Set(displayAgents.flatMap(a => Object.keys(a.products)))].sort();

    return {
      agents: displayAgents, agentsByJob: displayAgentsByJob,
      totalHrs:   displayAgents.reduce((s,a) => s + a.hrs,   0),
      totalGoals: displayAgents.reduce((s,a) => s + a.effectiveGoals,  0),
      totalSal:   displayAgents.reduce((s,a) => s + a.sal,    0),
      totalRgu:   displayAgents.reduce((s,a) => s + a.rgu,    0),
      presentCount: displayAgents.length,
      activeCount: activeAgentCount, allCount: allAgentCount,
      absent: validAbsent, newFaces, absentByRegion,
      byLoc, byReg, programs, productTotals, uniqueRegs, allProductCodes,
    };
  }, [raw, recentAgentNames, historicalAgentMap, goalLookup, activeOnly, prevAgentHours]);

  const sortedAgents = useMemo(() => {
    if (!d) return [];
    // When job filter is active, use per-agent-per-job entries (agents appear per-job)
    // When no job filter, use unique agent entries
    let list;
    if (lbJob) {
      list = d.agentsByJob.filter(a => a.job === lbJob);
      if (lbRegion !== "All") list = list.filter(a => a.reg === lbRegion);
    } else {
      list = d.agents;
      if (lbRegion !== "All") list = list.filter(a => a.reg === lbRegion);
    }
    return [...list].sort((a, b) => {
      const key = sortBy === "goals" ? "effectiveGoals" : sortBy;
      return ((a[key]||0) - (b[key]||0)) * sortDir;
    });
  }, [d, sortBy, sortDir, lbRegion, lbJob]);

  const sortedPrograms = useMemo(() => {
    if (!d) return [];
    let list = d.programs;
    // Site filter: group regions into DR (non-XOTM) and BZ (XOTM)
    if (progSiteFilter) {
      list = list.filter(p => {
        const isBZ = (p.reg || "").toUpperCase().includes("XOTM");
        if (progSiteFilter === "BZ") {
          // If a specific BZ site is selected, filter to just that site
          if (bzSiteFilter) return isBZ && p.reg === bzSiteFilter;
          return isBZ;
        }
        return !isBZ;
      });
    }
    return [...list].sort((a, b) => {
      let va, vb;
      if (progSortBy === "grp") return progSortDir * a.grp.localeCompare(b.grp);
      if (progSortBy === "roc") return progSortDir * (a.roc || "").localeCompare(b.roc || "");
      if (progSortBy === "reg") return progSortDir * (a.reg || "").localeCompare(b.reg || "");
      if (progSortBy === "agentCount") { va = a.agentCount; vb = b.agentCount; }
      else if (progSortBy === "hrs") { va = a.hrs; vb = b.hrs; }
      else if (progSortBy === "goals") { va = a.effectiveGoals; vb = b.effectiveGoals; }
      else if (progSortBy === "gph") { va = a.hrs > 0 ? a.effectiveGoals / a.hrs : 0; vb = b.hrs > 0 ? b.effectiveGoals / b.hrs : 0; }
      else if (progSortBy === "cps") { va = a.effectiveGoals > 0 ? (a.hrs * 19.77) / a.effectiveGoals : a.hrs * 19.77; vb = b.effectiveGoals > 0 ? (b.hrs * 19.77) / b.effectiveGoals : b.hrs * 19.77; }
      else if (progSortBy === "rgu") { va = a.rgu || 0; vb = b.rgu || 0; }
      else if (progSortBy === "pctToGoal") { va = a.pctToGoal ?? -1; vb = b.pctToGoal ?? -1; }
      else { va = a[progSortBy] || 0; vb = b[progSortBy] || 0; }
      return ((va || 0) - (vb || 0)) * progSortDir;
    });
  }, [d, progSortBy, progSortDir, progSiteFilter, bzSiteFilter]);

  // All codes present in today's data (for the selector dropdown)
  const allAvailableCodes = useMemo(() => {
    if (!d) return [];
    return [...new Set([
      ...d.agents.flatMap(a => Object.keys(a.products)),
      ...d.programs.flatMap(p => Object.keys(p.products || {})),
    ])].sort((a, b) => Number(a) - Number(b));
  }, [d]);

  // Codes to actually display (filtered by selector; empty selection = show all)
  const displayCodes = useMemo(() => {
    if (selectedCodes.size === 0) return allAvailableCodes;
    return allAvailableCodes.filter(c => selectedCodes.has(c));
  }, [allAvailableCodes, selectedCodes]);

  // Leaderboard: codes among visible agents
  const activeCodes = useMemo(() => {
    if (!d) return displayCodes;
    const agentCodes = new Set(sortedAgents.flatMap(a => Object.keys(a.products)));
    return displayCodes.filter(c => agentCodes.has(c));
  }, [displayCodes, sortedAgents]);

  // Programs: codes among visible programs
  const progActiveCodes = useMemo(() => {
    if (!d) return displayCodes;
    const pCodes = new Set(sortedPrograms.flatMap(p => Object.keys(p.products || {})));
    return displayCodes.filter(c => pCodes.has(c));
  }, [displayCodes, sortedPrograms]);

  const toggleCode = cod => {
    setSelectedCodes(prev => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod); else next.add(cod);
      return next;
    });
  };

  const toggleSort = key => {
    if (sortBy === key) setSortDir(v => -v);
    else { setSortBy(key); setSortDir(-1); }
  };

  const toggleProgSort = key => {
    if (progSortBy === key) setProgSortDir(v => -v);
    else { setProgSortBy(key); setProgSortDir(-1); }
  };

  const SortTh = ({ k, label, right }) => (
    <th onClick={() => toggleSort(k)}
      style={{ padding: "0.4rem 0.6rem", textAlign: right?"right":"left", fontWeight: 400,
        color: sortBy===k ? "#d97706" : `var(--text-dim)`, cursor: "pointer", whiteSpace: "nowrap",
        fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", userSelect: "none" }}>
      {label}{sortBy===k?(sortDir===-1?" ↓":" ↑"):""}
    </th>
  );

  const ProgSortTh = ({ k, label, right }) => (
    <th onClick={() => toggleProgSort(k)}
      style={{ padding: "0.4rem 0.75rem", textAlign: right?"right":"left", fontWeight: 400,
        color: progSortBy===k ? "#d97706" : `var(--text-dim)`, cursor: "pointer", whiteSpace: "nowrap",
        fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", userSelect: "none" }}>
      {label}{progSortBy===k?(progSortDir===-1?" ↓":" ↑"):""}
    </th>
  );

  const now = lastRefresh ? (() => {
    const today = new Date();
    const isToday = lastRefresh.toDateString() === today.toDateString();
    const time = lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return isToday ? time : `${lastRefresh.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
  })() : "—";

  if (loading) return (
    <div style={{ minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center", background: `var(--bg-primary)` }}>
      <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.85rem", color: `var(--text-dim)` }}>Checking connection…</div>
    </div>
  );

  if (pasteMode) return (
    <div style={{ minHeight: "90vh", background: `var(--bg-primary)`, padding: "3rem 2.5rem" }}>
      <div style={{ maxWidth: "640px", margin: "0 auto" }}>
        <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: "#16a34a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.5rem" }}>Today's Operations — Manual Data Load</div>
        <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "3rem", color: `var(--text-warm)`, fontWeight: 700, marginBottom: "1.5rem" }}>Paste Live Data</div>

        <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1.5rem", marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Step 1 — Open the live data URL</div>
          <a href={OTM_URL} target="_blank" rel="noreferrer"
            style={{ display: "inline-block", background: "#16a34a18", border: "1px solid #16a34a55", borderRadius: "6px", color: "#16a34a", padding: "0.5rem 1rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", textDecoration: "none", marginBottom: "0.5rem" }}>
            ↗ Open OTM Data Feed
          </a>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: `var(--text-faint)`, marginTop: "0.5rem" }}>
            This opens the live data in a new tab. You'll see raw JSON text.
          </div>
        </div>

        <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1.5rem", marginBottom: "1.25rem" }}>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1rem" }}>Step 2 — Copy & paste the data here</div>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: `var(--text-muted)`, marginBottom: "0.75rem" }}>
            In that tab, press <kbd style={{ background: `var(--bg-tertiary)`, border: "1px solid var(--text-faint)", borderRadius: "3px", padding: "0.1rem 0.35rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.85rem" }}>Ctrl+A</kbd> then <kbd style={{ background: `var(--bg-tertiary)`, border: "1px solid var(--text-faint)", borderRadius: "3px", padding: "0.1rem 0.35rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.85rem" }}>Ctrl+C</kbd> to copy everything, then paste it below.
          </div>
          <textarea
            value={pasteText}
            onChange={e => { setPasteText(e.target.value); setPasteError(null); }}
            placeholder='Paste JSON here… (starts with [{"agt":…)'
            style={{ width: "100%", height: "120px", background: `var(--bg-primary)`, border: `1px solid ${pasteError ? "#dc2626" : `var(--border)`}`, borderRadius: "6px", color: `var(--text-secondary)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", padding: "0.75rem", resize: "vertical", boxSizing: "border-box" }}
          />
          {pasteError && (
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: "#dc2626", marginTop: "0.4rem" }}>⚠ {pasteError}</div>
          )}
          <button onClick={handlePaste} disabled={!pasteText.trim()}
            style={{ marginTop: "0.75rem", padding: "0.5rem 1.25rem", background: pasteText.trim() ? "#16a34a18" : "transparent", border: `1px solid ${pasteText.trim() ? "#16a34a" : `var(--border)`}`, borderRadius: "6px", color: pasteText.trim() ? "#16a34a" : `var(--text-faint)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", cursor: pasteText.trim() ? "pointer" : "not-allowed" }}>
            Load Data →
          </button>
        </div>

        <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-faint)`, textAlign: "center" }}>
          Direct fetch is blocked in this environment. Pasting the data works identically — you'll see all the same live stats.
        </div>
      </div>
    </div>
  );

  if (!d) return (
    <div style={{ minHeight: "90vh", display: "flex", alignItems: "center", justifyContent: "center", background: `var(--bg-primary)` }}>
      <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.85rem", color: `var(--text-dim)`, textAlign: "center" }}>
        <div style={{ fontSize: "1.8rem", marginBottom: "0.5rem" }}>{loading ? "\u23F3" : "\uD83D\uDCE1"}</div>
        {loading ? "Fetching live data..." : "No data available."}
        <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.5rem", justifyContent: "center" }}>
          <button onClick={doFetch} style={{ background: "transparent", border: "1px solid #16a34a", borderRadius: "var(--radius-sm, 6px)", color: "#16a34a", padding: "0.3rem 0.8rem", cursor: "pointer", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem" }}>
            {loading ? "Fetching..." : "Try Auto-Fetch"}
          </button>
          <button onClick={() => setPasteMode(true)} style={{ background: "transparent", border: "1px solid var(--text-faint)", borderRadius: "var(--radius-sm, 6px)", color: `var(--text-muted)`, padding: "0.3rem 0.8rem", cursor: "pointer", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem" }}>Paste Data</button>
        </div>
      </div>
    </div>
  );

  // ── Screensaver / TV Mode ────────────────────────────────────────────────
  if (screensaverMode && d) {
    return (<TVMode d={d} codes={codes} doFetch={doFetch} lastRefresh={lastRefresh} onExit={() => setScreensaverMode(false)} />);
  }

  return (
    <div style={{ background: `var(--bg-primary)`, minHeight: "90vh", padding: "2rem 2.5rem", paddingBottom: "4rem" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
        <div>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: "#16a34a", letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
          ● LIVE · auto-refreshes every 5 min · last loaded {now}
          </div>
          <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "3rem", color: `var(--text-warm)`, fontWeight: 700 }}>Today's Operations</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", alignItems: "flex-end" }}>
          <button onClick={() => setScreensaverMode(true)}
            style={{ background: "#6366f110", border: "1px solid #6366f140", borderRadius: "6px",
              color: "#6366f1", padding: "0.5rem 1.25rem", fontFamily: "var(--font-ui, Inter, sans-serif)",
              fontSize: "1.1rem", cursor: "pointer", fontWeight: 700, width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "2.4rem", lineHeight: 1 }}>📺</span> TV Mode
          </button>
          <button onClick={async () => {
              try {
                await doFetch();
              } catch(e) {
                setPasteMode(true);
              }
            }}
            style={{ background: "transparent", border: "1px solid var(--text-faint)", borderRadius: "6px",
              color: `var(--text-muted)`, padding: "0.4rem 1rem", fontFamily: "var(--font-ui, Inter, sans-serif)",
              fontSize: "0.8rem", cursor: "pointer", width: "100%" }}>
            {loading ? "Fetching..." : "\u27F3 Refresh Data"}
          </button>
        </div>
      </div>

      {/* ── Active/All toggle + Pulse cards ── */}
      {(() => {
        const tBtnBase = { padding: "0.3rem 0.7rem", border: "none", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.75rem", cursor: "pointer", letterSpacing: "0.03em" };
        const activeToggle = (
          <div style={{ display: "inline-flex", borderRadius: "var(--radius-sm, 6px)", border: "1px solid var(--border)", overflow: "hidden" }}>
            <button onClick={() => setActiveOnly(false)}
              style={{ ...tBtnBase, fontWeight: activeOnly ? 400 : 700, background: !activeOnly ? "#16a34a18" : "transparent", color: !activeOnly ? "#16a34a" : `var(--text-dim)` }}>
              All Agents{d.allCount != null ? ` (${d.allCount})` : ""}
            </button>
            <button onClick={() => setActiveOnly(true)}
              style={{ ...tBtnBase, borderLeft: "1px solid var(--border)", fontWeight: activeOnly ? 700 : 400, background: activeOnly ? "#d9770618" : "transparent", color: activeOnly ? "#d97706" : `var(--text-dim)` }}>
              Active{d.activeCount != null && Object.keys(prevAgentHours).length > 0 ? ` (${d.activeCount})` : ""}
            </button>
          </div>
        );
        return (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", color: activeOnly ? "#d97706" : `var(--text-faint)`, letterSpacing: "0.08em" }}>
              {activeOnly ? "Showing agents whose hours increased since last refresh (currently dialing)" : "Showing all agents with data today"}
              {Object.keys(prevAgentHours).length === 0 && <span style={{ color: `var(--text-faint)` }}> — needs one refresh cycle to detect active</span>}
            </div>
            {activeToggle}
          </div>
        );
      })()}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
        {[
          { v: d.presentCount,           l: activeOnly ? "Active" : "On Floor", sub: `${d.absent.length} absent · ${d.newFaces.length} new`, c: "#16a34a" },
          { v: fmt(d.totalHrs, 1),        l: "Hours Today", sub: `${fmt(d.totalHrs/Math.max(d.presentCount,1), 2)} avg/agent`,  c: "#6366f1" },
          { v: d.totalGoals,              l: "Sales Today", sub: d.totalGoals > 0 ? `${fmt(d.totalHrs > 0 ? d.totalGoals/d.totalHrs : 0, 3)} GPH pace` : "no sales yet", c: "#d97706" },
          { v: d.totalRgu || "—",         l: "RGU",         sub: "today total",  c: "#2563eb" },
          { v: d.absent.length,           l: "Absent",      sub: `of ${recentAgentNames.size} last-7-day roster`, c: d.absent.length > 0 ? "#dc2626" : "#16a34a" },
        ].map(({ v, l, sub, c }) => (
          <div key={l} style={{ background: `var(--bg-secondary)`, border: `1px solid ${c}22`, borderRadius: "var(--radius-md, 10px)", padding: "1rem", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "3rem", color: c, fontWeight: 700, lineHeight: 1 }}>{v}</div>
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: c, marginTop: "0.2rem" }}>{l}</div>
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: `var(--text-faint)`, marginTop: "0.2rem" }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* ── Product Code Columns — full-width slim bar ── */}
      {allAvailableCodes.length > 0 && (
        <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1rem 1.25rem", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.12em", textTransform: "uppercase" }}>
              Product Code Columns
            </div>
            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
              {selectedCodes.size > 0 && (
                <button onClick={() => setSelectedCodes(new Set())}
                  style={{ background: "transparent", border: "1px solid var(--text-faint)", borderRadius: "var(--radius-sm, 6px)", color: `var(--text-muted)`, padding: "0.15rem 0.5rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", cursor: "pointer" }}>
                  Show All
                </button>
              )}
              <button onClick={() => setCodeDropOpen(v => !v)}
                style={{ background: codeDropOpen ? "#d9770620" : "transparent", border: `1px solid ${codeDropOpen ? "#d97706" : `var(--text-faint)`}`, borderRadius: "var(--radius-sm, 6px)",
                  color: codeDropOpen ? "#d97706" : `var(--text-muted)`, padding: "0.15rem 0.6rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", cursor: "pointer" }}>
                {codeDropOpen ? "▲ Close" : "▼ Select Codes"}{selectedCodes.size > 0 ? ` (${selectedCodes.size})` : ""}
              </button>
            </div>
          </div>
          {/* Selected code chips */}
          {selectedCodes.size > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.5rem" }}>
              {[...selectedCodes].sort((a,b)=>Number(a)-Number(b)).map(cod => (
                <span key={cod} onClick={() => toggleCode(cod)}
                  style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", padding: "0.15rem 0.45rem", borderRadius: "3px",
                    background: "#d9770620", border: "1px solid #d9770650", color: "#d97706", cursor: "pointer" }}
                  title="Click to remove">
                  {prodLabel(cod, codes)} ×
                </span>
              ))}
            </div>
          )}
          {/* Dropdown code picker — fills full width */}
          {codeDropOpen && (
            <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--bg-tertiary)", paddingTop: "0.75rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "0.25rem" }}>
                {allAvailableCodes.map(cod => {
                  const active = selectedCodes.has(cod);
                  const lbl = prodLabel(cod, codes);
                  return (
                    <button key={cod} onClick={() => toggleCode(cod)}
                      style={{ background: active ? "#6366f120" : "transparent", border: `1px solid ${active ? "#6366f1" : `var(--border)`}`,
                        borderRadius: "var(--radius-sm, 6px)", color: active ? "#6366f1" : `var(--text-dim)`, padding: "0.2rem 0.55rem",
                        fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", cursor: "pointer", textAlign: "center",
                        width: "100%", transition: "all 0.1s" }}>
                      {lbl}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Attendance + By Region side by side ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.25rem", alignItems: "stretch" }}>

        {/* ── Attendance panel ── */}
        <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1.25rem" }}>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            Attendance vs Last 7 Days
          </div>
          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            {[
              { label: "Present", count: d.presentCount,   color: "#16a34a" },
              { label: "Absent",  count: d.absent.length,  color: "#dc2626" },
              { label: "New",     count: d.newFaces.length, color: "#d97706" },
            ].map(({ label, count, color }) => (
              <div key={label} style={{ flex: 1, padding: "0.6rem", background: color+"12", border: `1px solid ${color}30`, borderRadius: "var(--radius-md, 10px)", textAlign: "center" }}>
                <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "1.75rem", color, fontWeight: 700, lineHeight: 1 }}>{count}</div>
                <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color, marginTop: "0.15rem" }}>{label}</div>
              </div>
            ))}
          </div>
          {d.absent.length > 0 && (
            <div>
              <button onClick={() => setShowAbsent(v => !v)}
                style={{ background: "transparent", border: "none", cursor: "pointer", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: "#dc2626", padding: 0, display: "flex", alignItems: "center", gap: "0.3rem", marginBottom: "0.4rem" }}>
                <span>{showAbsent?"▾":"▸"}</span>
                {d.absent.length} absent today — worked in last 7 days
              </button>
              {showAbsent && (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {Object.entries(d.absentByRegion).sort().map(([reg, agents]) => (
                    <div key={reg}>
                      <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: getRegColor(reg), textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.25rem" }}>
                        {reg} <span style={{ color: `var(--text-faint)` }}>({agents.length})</span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                        {agents.sort((a,b)=>a.name.localeCompare(b.name)).map(({ name, quartile }) => (
                          <div key={name} style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", padding: "0.15rem 0.5rem", borderRadius: "3px",
                            background: "#dc262612", border: "1px solid #dc262630", color: "#dc2626",
                            display: "flex", alignItems: "center", gap: "0.3rem" }}>
                            {name.split(" ")[0]}
                            {quartile && <span style={{ opacity: 0.6, fontSize: "0.81rem", color: Q[quartile]?.color || `var(--text-muted)` }}>{quartile}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {d.newFaces.length > 0 && (
            <div style={{ marginTop: "0.75rem" }}>
              <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: "#d97706", marginBottom: "0.4rem" }}>
                ▸ {d.newFaces.length} agents working today not in recent history
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {d.newFaces.sort().map(name => (
                  <div key={name} style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", padding: "0.15rem 0.5rem", borderRadius: "3px",
                    background: "#d9770612", border: "1px solid #d9770630", color: "#d97706" }}>
                    {name.split(" ")[0]}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── By Region ── */}
        <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1.25rem", display: "flex", flexDirection: "column" }}>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
            By Region — Live
          </div>
          {Object.entries(d.byReg).sort().map(([reg, s]) => {
            const gph = s.hrs > 0 ? s.goals / s.hrs : 0;
            const avgPct = s.pctCount > 0 ? s.pctSum / s.pctCount : null;
            const isBZ = reg.toUpperCase().includes("XOTM");
            const regColor = getRegColor(reg);
            const pctColor = avgPct !== null ? attainColor(avgPct) : `var(--text-dim)`;
            const hasProd = Object.keys(s.products).length > 0;
            return (
              <div key={reg} style={{ padding: "0.85rem 1rem", background: `var(--bg-primary)`, borderRadius: "var(--radius-md, 10px)", border: `1px solid ${regColor}22`, marginBottom: "0.6rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <span style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "1.32rem", color: regColor, fontWeight: 600 }}>{reg}</span>
                  <span style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: `var(--text-muted)` }}>{s.count} agents</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "0.5rem" }}>
                  {[
                    { l: "Hours",     v: fmt(s.hrs, 1),                                      c: "#6366f1" },
                    { l: "Sales",     v: s.goals || "—",                                      c: "#d97706" },
                    { l: "GPH",       v: s.goals > 0 ? gph.toFixed(3) : "—",                 c: "#16a34a" },
                    { l: "RGU",       v: s.rgu || "—",                                        c: "#2563eb" },
                    { l: "% to Goal", v: avgPct !== null ? `${Math.round(avgPct)}%` : "—",   c: pctColor  },
                  ].map(({ l, v, c }) => (
                    <div key={l} style={{ textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "1.15rem", color: c, fontWeight: 600 }}>{v}</div>
                      <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.78rem", color: `var(--text-dim)` }}>{l}</div>
                    </div>
                  ))}
                </div>
                {hasProd && displayCodes.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem", marginTop: "0.5rem" }}>
                    {Object.entries(s.products)
                      .filter(([cod]) => selectedCodes.size === 0 || selectedCodes.has(cod))
                      .sort((a,b)=>b[1]-a[1]).map(([cod, cnt]) => (
                      <span key={cod} style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.81rem", padding: "0.1rem 0.35rem", borderRadius: "3px", background: "#6366f108", border: "1px solid #6366f120", color: "#6366f1aa",
                        wordBreak: "break-word", overflowWrap: "anywhere" }}
                        title={`${prodLabel(cod, codes)}: ${cnt}`}>
                        {prodLabel(cod, codes)}: {cnt}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {/* Product mix if any sales exist */}
          {Object.keys(d.productTotals).length > 0 && (
            <div style={{ marginTop: "auto", paddingTop: "0.75rem", borderTop: "1px solid var(--bg-tertiary)" }}>
              <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-dim)`, marginBottom: "0.4rem" }}>PRODUCT MIX TODAY</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {Object.entries(d.productTotals).sort((a,b)=>b[1]-a[1]).map(([cod, cnt]) => (
                  <div key={cod} style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", padding: "0.15rem 0.5rem", borderRadius: "3px", background: "#6366f112", border: "1px solid #6366f130", color: "#6366f1",
                    wordBreak: "break-word", overflowWrap: "anywhere" }}>
                    {prodLabel(cod, codes)}: {cnt}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Programs breakdown ── */}
      <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1.25rem", marginBottom: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.12em", textTransform: "uppercase" }}>Performance by Campaign · by Site</div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ display: "inline-flex", borderRadius: "var(--radius-sm, 6px)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <button onClick={() => setActiveOnly(false)}
                style={{ padding: "0.25rem 0.6rem", border: "none", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", cursor: "pointer", fontWeight: activeOnly ? 400 : 700, background: !activeOnly ? "#16a34a18" : "transparent", color: !activeOnly ? "#16a34a" : `var(--text-dim)` }}>
                All ({d.allCount})
              </button>
              <button onClick={() => setActiveOnly(true)}
                style={{ padding: "0.25rem 0.6rem", border: "none", borderLeft: "1px solid var(--border)", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", cursor: "pointer", fontWeight: activeOnly ? 700 : 400, background: activeOnly ? "#d9770618" : "transparent", color: activeOnly ? "#d97706" : `var(--text-dim)` }}>
                Active{Object.keys(prevAgentHours).length > 0 ? ` (${d.activeCount})` : ""}
              </button>
            </div>
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", color: `var(--text-faint)` }}>sort · filter by site</div>
          </div>
        </div>
        {/* Site drill-down tabs */}
        {(() => {
          const uniqueProgRegs = [...new Set((d?.programs || []).map(p => p.reg))].sort();
          const bzRegs = uniqueProgRegs.filter(r => r.toUpperCase().includes("XOTM"));
          const drRegs = uniqueProgRegs.filter(r => !r.toUpperCase().includes("XOTM"));
          const siteTabs = [];
          if (drRegs.length > 0) siteTabs.push({ label: drRegs.length === 1 ? drRegs[0] : "DR", regs: drRegs });
          if (bzRegs.length > 0) siteTabs.push({ label: "BZ", regs: bzRegs });
          // Only render site tabs when there are multiple site groups
          if (siteTabs.length < 2) return null;
          return (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: progSiteFilter === "BZ" ? "0.5rem" : 0 }}>
                <button onClick={() => { setProgSiteFilter(null); setBzSiteFilter(null); }}
                  style={{ padding: "0.3rem 0.8rem", borderRadius: "var(--radius-sm, 6px)", border: `1px solid ${!progSiteFilter?"#d97706":`var(--border)`}`, background: !progSiteFilter?"#d9770618":"transparent", color: !progSiteFilter?"#d97706":`var(--text-muted)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", cursor: "pointer" }}>
                  All Sites
                </button>
                {siteTabs.map(st => {
                  const isActive = progSiteFilter === st.label;
                  const btnColor = getRegColor(st.regs[0]);
                  return (
                    <button key={st.label} onClick={() => { setProgSiteFilter(isActive ? null : st.label); setBzSiteFilter(null); }}
                      style={{ padding: "0.3rem 0.8rem", borderRadius: "var(--radius-sm, 6px)", border: `1px solid ${isActive?btnColor:`var(--border)`}`, background: isActive?btnColor+"18":"transparent", color: isActive?btnColor:`var(--text-muted)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", cursor: "pointer" }}>
                      {st.label}
                      <span style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-dim)`, marginLeft: "0.35rem" }}>
                        ({st.regs.length > 1 ? `${st.regs.length} sites` : st.regs[0]})
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* BZ sub-site tabs — shown when BZ is the active site filter */}
              {progSiteFilter === "BZ" && bzRegs.length > 1 && (
                <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", paddingLeft: "0.5rem", borderLeft: "2px solid #6366f130" }}>
                  <button onClick={() => setBzSiteFilter(null)}
                    style={{ padding: "0.25rem 0.7rem", borderRadius: "var(--radius-sm, 6px)", border: `1px solid ${!bzSiteFilter ? "#6366f1" : `var(--border)`}`, background: !bzSiteFilter ? "#6366f118" : "transparent", color: !bzSiteFilter ? "#6366f1" : `var(--text-dim)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "1.02rem", cursor: "pointer", transition: "all 0.15s" }}>
                    Combined
                  </button>
                  {bzRegs.map(reg => {
                    const isActive = bzSiteFilter === reg;
                    const regColor = getRegColor(reg);
                    // Short label: strip "-XOTM" suffix for cleaner display
                    const shortLabel = reg.replace(/-XOTM$/i, "");
                    return (
                      <button key={reg} onClick={() => setBzSiteFilter(isActive ? null : reg)}
                        style={{ padding: "0.25rem 0.7rem", borderRadius: "var(--radius-sm, 6px)", border: `1px solid ${isActive ? regColor : `var(--border)`}`, background: isActive ? regColor + "18" : "transparent", color: isActive ? regColor : `var(--text-dim)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "1.02rem", cursor: "pointer", transition: "all 0.15s" }}>
                        {shortLabel}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}
        {/* Site summary strip when filtered */}
        {progSiteFilter && sortedPrograms.length > 0 && (() => {
          const totHrs = sortedPrograms.reduce((s, p) => s + p.hrs, 0);
          const totGoals = sortedPrograms.reduce((s, p) => s + p.effectiveGoals, 0);
          const totRgu = sortedPrograms.reduce((s, p) => s + (p.rgu || 0), 0);
          const totGph = totHrs > 0 ? totGoals / totHrs : 0;
          const totAgents = sortedPrograms.reduce((s, p) => s + p.agentCount, 0);
          const filterColor = sortedPrograms.length > 0 ? getRegColor(sortedPrograms[0].reg) : "#d97706";
          return (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "0.5rem", marginBottom: "1rem", padding: "0.75rem", background: filterColor + "08", border: `1px solid ${filterColor}25`, borderRadius: "var(--radius-md, 10px)" }}>
              {[
                { l: "Campaigns", v: sortedPrograms.length, c: filterColor },
                { l: "Agents", v: totAgents, c: `var(--text-secondary)` },
                { l: "Hours", v: fmt(totHrs, 1), c: "#6366f1" },
                { l: "Sales", v: totGoals || "—", c: "#d97706" },
                { l: "GPH", v: totGoals > 0 ? totGph.toFixed(3) : "—", c: "#16a34a" },
                { l: "CPS", v: totGoals > 0 ? `$${((totHrs * 19.77) / totGoals).toFixed(2)}` : `$${(totHrs * 19.77).toFixed(2)}`, c: (() => { const pv = sortedPrograms.filter(p => p.pctToGoal !== null); return pv.length > 0 ? attainColor(pv.reduce((s,p) => s + p.pctToGoal, 0) / pv.length) : `var(--text-faint)`; })() },
              ].map(({ l, v, c }) => (
                <div key={l} style={{ textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-display, Inter, sans-serif)", fontSize: "1.95rem", color: c, fontWeight: 700, lineHeight: 1 }}>{v}</div>
                  <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.9rem", color: `var(--text-dim)`, marginTop: "0.1rem" }}>{l}</div>
                </div>
              ))}
            </div>
          );
        })()}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <ProgSortTh k="grp"        label="Program" />
                <ProgSortTh k="roc"        label="ROC" />
                <ProgSortTh k="reg"        label="Region" />
                <ProgSortTh k="agentCount" label="Agents"    right />
                <ProgSortTh k="hrs"        label="Hours"     right />
                <ProgSortTh k="goals"      label="Sales"     right />
                <ProgSortTh k="gph"        label="GPH"       right />
                <ProgSortTh k="cps"        label="CPS"       right />
                <ProgSortTh k="rgu"        label="RGU"       right />
                {progActiveCodes.map(cod => {
                  const lbl = prodLabel(cod, codes);
                  return (
                    <th key={cod} title={lbl} style={{ padding: "0.4rem 0.4rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>
                      {lbl.length > 13 ? lbl.slice(0,12) + "…" : lbl}
                    </th>
                  );
                })}
                <ProgSortTh k="pctToGoal"  label="% to Goal" right />
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>HSD %</th>
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>Mobile %</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                // Build display rows: DR rows stay flat, BZ programs grouped with combined + individual sub-rows
                // BUT if a specific BZ site is selected (bzSiteFilter), show flat rows only
                const isBZReg = r => (r || "").toUpperCase().includes("XOTM");
                const drRows = sortedPrograms.filter(p => !isBZReg(p.reg));
                const bzRows = sortedPrograms.filter(p => isBZReg(p.reg));

                const renderRow = (p, key, style = {}) => {
                  const eg = p.effectiveGoals;
                  const gph = p.hrs > 0 ? eg / p.hrs : 0;
                  const regColor = p.isCombined ? "#6366f1" : getRegColor(p.reg);
                  const pctColor = p.pctToGoal !== null ? attainColor(p.pctToGoal) : `var(--text-faint)`;
                  return (
                    <tr key={key} style={{ borderBottom: "1px solid var(--bg-tertiary)", ...style }}>
                      <td style={{ padding: "0.4rem 0.75rem", color: `var(--text-primary)`, fontFamily: "var(--font-ui, Inter, sans-serif)", ...style.tdProgram }}>{style.progLabel || p.grp}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: `var(--text-dim)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.9rem" }}>{p.roc || "\u2014"}</td>
                      <td style={{ padding: "0.4rem 0.75rem" }}>
                        <span style={{ background: regColor+"18", border: `1px solid ${regColor}40`, borderRadius: "3px", color: regColor, padding: "0.1rem 0.35rem" }}>{p.isCombined ? "BZ" : p.reg}</span>
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", color: `var(--text-secondary)`, textAlign: "right" }}>{p.agentCount}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: "#6366f1", textAlign: "right" }}>{fmt(p.hrs, 2)}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: eg > 0 ? "#d97706" : `var(--text-faint)`, textAlign: "right" }}>{eg || "—"}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: eg > 0 ? "#16a34a" : `var(--text-faint)`, textAlign: "right" }}>{eg > 0 ? gph.toFixed(3) : "—"}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: p.pctToGoal !== null ? attainColor(p.pctToGoal) : `var(--text-faint)`, textAlign: "right" }}>{eg > 0 ? `$${((p.hrs * 19.77) / eg).toFixed(2)}` : `$${(p.hrs * 19.77).toFixed(2)}`}</td>
                      <td style={{ padding: "0.4rem 0.75rem", color: p.rgu > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right" }}>{p.rgu || "—"}</td>
                      {progActiveCodes.map(cod => {
                        const v = p.products?.[cod] || 0;
                        return (
                          <td key={cod} style={{ padding: "0.4rem 0.4rem", color: v > 0 ? "#2563eb" : "#1f2937", textAlign: "right", fontWeight: v > 0 ? 700 : 400 }}>
                            {v || ""}
                          </td>
                        );
                      })}
                      <td style={{ padding: "0.4rem 0.75rem", color: pctColor, textAlign: "right", fontWeight: 700 }}>
                        {p.pctToGoal !== null ? `${Math.round(p.pctToGoal)}%` : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", color: p.hsd > 0 && eg > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right" }}>
                        {p.hsd > 0 && eg > 0 ? `${Math.round(p.hsd / eg * 100)}%` : "—"}
                      </td>
                      <td style={{ padding: "0.4rem 0.75rem", color: p.xml > 0 && eg > 0 ? "#8b5cf6" : `var(--text-faint)`, textAlign: "right" }}>
                        {p.xml > 0 && eg > 0 ? `${Math.round(p.xml / eg * 100)}%` : "—"}
                      </td>
                    </tr>
                  );
                };

                // If a specific BZ site is selected, show all as flat rows (no grouping)
                if (bzSiteFilter) {
                  let rowIdx = 0;
                  return sortedPrograms.map((p) => {
                    rowIdx++;
                    return renderRow(p, `${p.reg}|${p.roc}|${p.grp}`, {
                      background: rowIdx % 2 === 0 ? "transparent" : `var(--bg-row-alt)`,
                    });
                  });
                }

                // Build display rows respecting sort order, with BZ grouping
                const displayRows = [];
                const isBZReg2 = r => (r || "").toUpperCase().includes("XOTM");
                const bzProcessed = new Set();
                
                sortedPrograms.forEach(p => {
                  if (!isBZReg2(p.reg)) {
                    // DR row — render directly
                    displayRows.push({ type: "normal", data: p });
                  } else {
                    // BZ row — group by program name (grp), combining all ROCs for same program
                    const groupKey = p.grp;
                    if (bzProcessed.has(groupKey)) return; // already handled as part of a group
                    bzProcessed.add(groupKey);
                    const group = sortedPrograms.filter(r => isBZReg2(r.reg) && r.grp === p.grp);
                    if (group.length > 1) {
                      // Build combined row
                      const combined = {
                        grp: p.grp, reg: "BZ Combined", isCombined: true,
                        roc: [...new Set(group.map(r => r.roc).filter(Boolean))].sort().join(", "),
                        agentCount: group.reduce((s, r) => s + r.agentCount, 0),
                        hrs: group.reduce((s, r) => s + r.hrs, 0),
                        effectiveGoals: group.reduce((s, r) => s + r.effectiveGoals, 0),
                        rgu: group.reduce((s, r) => s + (r.rgu || 0), 0),
                        hsd: group.reduce((s, r) => s + (r.hsd || 0), 0),
                        xml: group.reduce((s, r) => s + (r.xml || 0), 0),
                        products: {},
                        pctToGoal: (() => {
                          const pcts = group.filter(r => r.pctToGoal !== null);
                          return pcts.length > 0 ? pcts.reduce((s, r) => s + r.pctToGoal, 0) / pcts.length : null;
                        })(),
                      };
                      group.forEach(r => Object.entries(r.products || {}).forEach(([k, v]) => {
                        combined.products[k] = (combined.products[k] || 0) + v;
                      }));
                      displayRows.push({ type: "bzCombined", data: combined });
                    } else {
                      displayRows.push({ type: "normal", data: group[0] });
                    }
                  }
                });

                let rowIdx = 0;
                return displayRows.map(({ type, data }) => {
                  rowIdx++;
                  if (type === "bzCombined") {
                    return renderRow(data, `bz-combined-${data.grp}-${data.roc || ""}`, {
                      background: rowIdx % 2 === 0 ? "transparent" : `var(--bg-row-alt)`,
                    });
                  } else if (type === "bzSub") {
                    const regColor = getRegColor(data.reg);
                    return renderRow(data, `${data.reg}|${data.roc || ""}|${data.grp}`, {
                      background: "#6366f106",
                      borderLeft: `3px solid ${regColor}40`,
                      tdProgram: { paddingLeft: "1.75rem", fontSize: "0.95em", color: `var(--text-muted)` },
                      progLabel: <span style={{ color: `var(--text-muted)` }}>└ {data.grp}</span>,
                    });
                  } else {
                    return renderRow(data, `${data.reg}|${data.roc || ""}|${data.grp}`, {
                      background: rowIdx % 2 === 0 ? "transparent" : `var(--bg-row-alt)`,
                    });
                  }
                });
              })()}
            </tbody>
            <tfoot>
              {(() => {
                const totAgents = sortedPrograms.reduce((s, p) => s + p.agentCount, 0);
                const totHrs    = sortedPrograms.reduce((s, p) => s + p.hrs, 0);
                const totGoals  = sortedPrograms.reduce((s, p) => s + p.effectiveGoals, 0);
                const totRgu    = sortedPrograms.reduce((s, p) => s + (p.rgu || 0), 0);
                const totHsd    = sortedPrograms.reduce((s, p) => s + (p.hsd || 0), 0);
                const totXml    = sortedPrograms.reduce((s, p) => s + (p.xml || 0), 0);
                const totGph    = totHrs > 0 ? totGoals / totHrs : 0;
                const pctVals   = sortedPrograms.filter(p => p.pctToGoal !== null);
                const avgPct    = pctVals.length > 0 ? pctVals.reduce((s, p) => s + p.pctToGoal, 0) / pctVals.length : null;
                const pctColor  = avgPct !== null ? attainColor(avgPct) : `var(--text-faint)`;
                return (
                  <tr style={{ borderTop: "2px solid var(--border)", background: `var(--bg-row-alt)` }}>
                    <td style={{ padding: "0.5rem 0.75rem", color: `var(--text-warm)`, fontWeight: 700 }}>TOTAL</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}></td>
                    <td style={{ padding: "0.5rem 0.75rem" }}></td>
                    <td style={{ padding: "0.5rem 0.75rem", color: `var(--text-warm)`, textAlign: "right", fontWeight: 700 }}>{totAgents}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: "#6366f1", textAlign: "right", fontWeight: 700 }}>{fmt(totHrs, 2)}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: totGoals > 0 ? "#d97706" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>{totGoals || "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: totGoals > 0 ? "#16a34a" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>{totGoals > 0 ? totGph.toFixed(3) : "—"}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: pctColor, textAlign: "right", fontWeight: 700 }}>{totGoals > 0 ? `$${((totHrs * 19.77) / totGoals).toFixed(2)}` : `$${(totHrs * 19.77).toFixed(2)}`}</td>
                    <td style={{ padding: "0.5rem 0.75rem", color: totRgu > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>{totRgu || "—"}</td>
                    {progActiveCodes.map(cod => {
                      const tot = sortedPrograms.reduce((s, p) => s + (p.products?.[cod] || 0), 0);
                      return (
                        <td key={cod} style={{ padding: "0.5rem 0.4rem", color: tot > 0 ? "#2563eb" : "#1f2937", textAlign: "right", fontWeight: 700 }}>
                          {tot || ""}
                        </td>
                      );
                    })}
                    <td style={{ padding: "0.5rem 0.75rem", color: pctColor, textAlign: "right", fontWeight: 700 }}>
                      {avgPct !== null ? `${Math.round(avgPct)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", color: totHsd > 0 && totGoals > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>
                      {totHsd > 0 && totGoals > 0 ? `${Math.round(totHsd / totGoals * 100)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.75rem", color: totXml > 0 && totGoals > 0 ? "#8b5cf6" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>
                      {totXml > 0 && totGoals > 0 ? `${Math.round(totXml / totGoals * 100)}%` : "—"}
                    </td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
        </div>
      </div>

      {/* ── Agent leaderboard ── */}
      <div style={{ background: `var(--bg-secondary)`, border: "1px solid var(--border)", borderRadius: "var(--radius-lg, 16px)", padding: "1.25rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-muted)`, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Agent Leaderboard · {sortedAgents.length} {lbRegion === "All" ? (lbJob ? `in ${lbJob}` : (activeOnly ? "active now" : "today")) : `in ${lbRegion}`}{lbJob && lbRegion !== "All" ? ` · ${lbJob}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ display: "inline-flex", borderRadius: "var(--radius-sm, 6px)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <button onClick={() => setActiveOnly(false)}
                style={{ padding: "0.25rem 0.6rem", border: "none", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", cursor: "pointer", fontWeight: activeOnly ? 400 : 700, background: !activeOnly ? "#16a34a18" : "transparent", color: !activeOnly ? "#16a34a" : `var(--text-dim)` }}>
                All ({d.allCount})
              </button>
              <button onClick={() => setActiveOnly(true)}
                style={{ padding: "0.25rem 0.6rem", border: "none", borderLeft: "1px solid var(--border)", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", cursor: "pointer", fontWeight: activeOnly ? 700 : 400, background: activeOnly ? "#d9770618" : "transparent", color: activeOnly ? "#d97706" : `var(--text-dim)` }}>
                Active{Object.keys(prevAgentHours).length > 0 ? ` (${d.activeCount})` : ""}
              </button>
            </div>
            <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.72rem", color: `var(--text-faint)` }}>sort by headers</div>
          </div>
        </div>
        {/* Region selector */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginBottom: "0.5rem" }}>
          {["All", ...(d.uniqueRegs || [])].map(r => {
            const active = lbRegion === r;
            const isBZ = r !== "All" && r.toUpperCase().includes("XOTM");
            const btnColor = r === "All" ? `var(--text-muted)` : getRegColor(r);
            return (
              <button key={r} onClick={() => { setLbRegion(r); setLbJob(null); }}
                style={{ background: active ? btnColor+"20" : "transparent", border: `1px solid ${active ? btnColor : `var(--border)`}`, borderRadius: "var(--radius-sm, 6px)",
                  color: active ? btnColor : `var(--text-dim)`, padding: "0.2rem 0.6rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", cursor: "pointer", transition: "all 0.15s" }}>
                {r}
              </button>
            );
          })}
        </div>
        {/* Job/Program filter — shows unique programs for selected region */}
        {(() => {
          const regionAgents = lbRegion === "All" ? (d.agents || []) : (d.agents || []).filter(a => a.reg === lbRegion);
          const jobSet = new Set();
          regionAgents.forEach(a => { if (a.grps) a.grps.forEach(g => jobSet.add(g)); });
          const jobs = [...jobSet].sort();
          if (jobs.length < 2) return null;
          return (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem", marginBottom: "1rem" }}>
              <button onClick={() => setLbJob(null)}
                style={{ padding: "0.2rem 0.55rem", borderRadius: "var(--radius-sm, 6px)", border: `1px solid ${!lbJob ? "#16a34a" : `var(--border)`}`, background: !lbJob ? "#16a34a18" : "transparent", color: !lbJob ? "#16a34a" : `var(--text-dim)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "1.02rem", cursor: "pointer" }}>
                All Programs
              </button>
              {jobs.map(j => {
                const active = lbJob === j;
                return (
                  <button key={j} onClick={() => setLbJob(active ? null : j)}
                    style={{ padding: "0.2rem 0.55rem", borderRadius: "var(--radius-sm, 6px)", border: `1px solid ${active ? "#16a34a" : `var(--border)`}`, background: active ? "#16a34a18" : "transparent", color: active ? "#16a34a" : `var(--text-dim)`, fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "1.02rem", cursor: "pointer" }}>
                    {j}
                  </button>
                );
              })}
            </div>
          );
        })()}
        {(() => {
          return (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", whiteSpace: "nowrap" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <SortTh k="name"  label="Agent"    />
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400 }}>Region</th>
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400 }}>Program</th>
                <SortTh k="hrs"             label="Hrs"       right />
                <SortTh k="effectiveGoals"  label="Sales"     right />
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>GPH</th>
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>RGU</th>
                {activeCodes.map(cod => {
                  const lbl = prodLabel(cod, codes);
                  return (
                    <th key={cod} title={lbl} style={{ padding: "0.4rem 0.4rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>
                      {lbl.length > 14 ? lbl.slice(0, 13) + "…" : lbl}
                    </th>
                  );
                })}
                <SortTh k="pctToGoal"  label="% to Goal"  right />
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>HSD %</th>
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>Mobile %</th>
                <th style={{ padding: "0.4rem 0.6rem", color: `var(--text-dim)`, fontWeight: 400, textAlign: "right" }}>Hist Q</th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((a, i) => {
                const eg = a.effectiveGoals;
                const gph      = a.hrs > 0 && eg > 0 ? (eg / a.hrs).toFixed(3) : "—";
                const regColor = getRegColor(a.reg);
                const grpStr   = [...a.grps].join(", ");
                const pctColor = a.pctToGoal !== null ? attainColor(a.pctToGoal) : `var(--text-faint)`;
                return (
                  <tr key={`${a.name}|${a.job || i}`} style={{ borderBottom: "1px solid var(--bg-tertiary)", background: i%2===0?"transparent":`var(--bg-row-alt)` }}>
                    <td style={{ padding: "0.4rem 0.6rem", color: `var(--text-warm)`, fontFamily: "var(--font-ui, Inter, sans-serif)" }}>{a.name}</td>
                    <td style={{ padding: "0.4rem 0.6rem" }}>
                      <span style={{ background: regColor+"18", border: `1px solid ${regColor}40`, borderRadius: "3px", color: regColor, padding: "0.1rem 0.35rem" }}>{a.reg}</span>
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", color: `var(--text-muted)`, maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={grpStr}>{grpStr}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: "#6366f1", textAlign: "right" }}>{fmt(a.hrs, 2)}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: eg > 0 ? "#d97706" : `var(--text-faint)`, textAlign: "right", fontWeight: eg > 0 ? 700 : 400 }}>{eg || "—"}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: eg > 0 ? "#16a34a" : `var(--text-faint)`, textAlign: "right" }}>{gph}</td>
                    <td style={{ padding: "0.4rem 0.6rem", color: a.rgu > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right" }}>{a.rgu || "—"}</td>
                    {activeCodes.map(cod => {
                      const v = a.products[cod] || 0;
                      return (
                        <td key={cod} style={{ padding: "0.4rem 0.4rem", color: v > 0 ? "#2563eb" : "#1f2937", textAlign: "right", fontWeight: v > 0 ? 700 : 400 }}>
                          {v || ""}
                        </td>
                      );
                    })}
                    <td style={{ padding: "0.4rem 0.6rem", color: pctColor, textAlign: "right", fontWeight: 700 }}>
                      {a.pctToGoal !== null ? `${Math.round(a.pctToGoal)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", color: a.hsd > 0 && eg > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right" }}>
                      {a.hsd > 0 && eg > 0 ? `${Math.round(a.hsd / eg * 100)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", color: a.xml > 0 && eg > 0 ? "#8b5cf6" : `var(--text-faint)`, textAlign: "right" }}>
                      {a.xml > 0 && eg > 0 ? `${Math.round(a.xml / eg * 100)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.4rem 0.6rem", textAlign: "right" }}>
                      {a.quartile ? <QBadge q={a.quartile} /> : <span style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.82rem", color: `var(--text-faint)` }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              {(() => {
                const totHrs   = sortedAgents.reduce((s, a) => s + a.hrs, 0);
                const totGoals = sortedAgents.reduce((s, a) => s + a.effectiveGoals, 0);
                const totRgu   = sortedAgents.reduce((s, a) => s + (a.rgu || 0), 0);
                const totHsd   = sortedAgents.reduce((s, a) => s + (a.hsd || 0), 0);
                const totXml   = sortedAgents.reduce((s, a) => s + (a.xml || 0), 0);
                const totGph   = totHrs > 0 ? totGoals / totHrs : 0;
                const pctVals  = sortedAgents.filter(a => a.pctToGoal !== null);
                const avgPct   = pctVals.length > 0 ? pctVals.reduce((s, a) => s + a.pctToGoal, 0) / pctVals.length : null;
                const pctColor = avgPct !== null ? attainColor(avgPct) : `var(--text-faint)`;
                return (
                  <tr style={{ borderTop: "2px solid var(--border)", background: `var(--bg-row-alt)` }}>
                    <td style={{ padding: "0.5rem 0.6rem", color: `var(--text-warm)`, fontWeight: 700 }}>TOTAL ({sortedAgents.length})</td>
                    <td></td>
                    <td></td>
                    <td style={{ padding: "0.5rem 0.6rem", color: "#6366f1", textAlign: "right", fontWeight: 700 }}>{fmt(totHrs, 2)}</td>
                    <td style={{ padding: "0.5rem 0.6rem", color: totGoals > 0 ? "#d97706" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>{totGoals || "—"}</td>
                    <td style={{ padding: "0.5rem 0.6rem", color: totGoals > 0 ? "#16a34a" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>{totGoals > 0 ? totGph.toFixed(3) : "—"}</td>
                    <td style={{ padding: "0.5rem 0.6rem", color: totRgu > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>{totRgu || "—"}</td>
                    {activeCodes.map(cod => {
                      const tot = sortedAgents.reduce((s, a) => s + (a.products[cod] || 0), 0);
                      return (
                        <td key={cod} style={{ padding: "0.5rem 0.4rem", color: tot > 0 ? "#2563eb" : "#1f2937", textAlign: "right", fontWeight: 700 }}>
                          {tot || ""}
                        </td>
                      );
                    })}
                    <td style={{ padding: "0.5rem 0.6rem", color: pctColor, textAlign: "right", fontWeight: 700 }}>
                      {avgPct !== null ? `${Math.round(avgPct)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", color: totHsd > 0 && totGoals > 0 ? "#2563eb" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>
                      {totHsd > 0 && totGoals > 0 ? `${Math.round(totHsd / totGoals * 100)}%` : "—"}
                    </td>
                    <td style={{ padding: "0.5rem 0.6rem", color: totXml > 0 && totGoals > 0 ? "#8b5cf6" : `var(--text-faint)`, textAlign: "right", fontWeight: 700 }}>
                      {totXml > 0 && totGoals > 0 ? `${Math.round(totXml / totGoals * 100)}%` : "—"}
                    </td>
                    <td></td>
                  </tr>
                );
              })()}
            </tfoot>
          </table>
          <div style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.8rem", color: `var(--text-faint)`, padding: "0.4rem 0.6rem" }}>
            Hist Q = quartile from uploaded historical file · % to Goal = today's sales vs SPH goal × hours worked · HSD % = New HSD / Sales · Mobile % = New Mobile / Sales
          </div>
        </div>
          );
        })()}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// SECTION 14 — APP SHELL  (App.jsx)
// Owns state. Calls usePerformanceEngine. Passes data to pages. No computation.
// ══════════════════════════════════════════════════════════════════════════════

// ── Theme ────────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    "--bg-primary":      "#06090d",
    "--bg-secondary":    "#0c1017",
    "--bg-row-alt":      "#090d13",
    "--bg-tertiary":     "#141a23",
    "--border":          "#1e2530",
    "--border-muted":    "#2a3240",
    "--text-faint":      "#334155",
    "--text-dim":        "#475569",
    "--text-muted":      "#64748b",
    "--text-secondary":  "#94a3b8",
    "--text-primary":    "#e2e8f0",
    "--text-warm":       "#f1f5f9",
    "--glass-bg":        "rgba(12, 16, 23, 0.75)",
    "--glass-bg-subtle": "rgba(12, 16, 23, 0.5)",
    "--glass-border":    "rgba(255, 255, 255, 0.06)",
    "--card-glow":       "0 0 0 1px rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.3)",
    "--card-hover-glow": "0 0 0 1px rgba(217,119,6,0.12), 0 8px 32px rgba(0,0,0,0.4)",
    "--accent-surface":  "rgba(217, 119, 6, 0.06)",
    "--nav-bg":          "rgba(6, 9, 13, 0.85)",
    "--nh-color":        "#d97706",
    "--nh-bg":           "#d9770618",
    "--nh-border":       "#d9770640",
  },
  light: {
    "--bg-primary":      "#f1f5f9",
    "--bg-secondary":    "#ffffff",
    "--bg-row-alt":      "#f8fafc",
    "--bg-tertiary":     "#e2e8f0",
    "--border":          "#cbd5e1",
    "--border-muted":    "#e2e8f0",
    "--text-faint":      "#94a3b8",
    "--text-dim":        "#64748b",
    "--text-muted":      "#475569",
    "--text-secondary":  "#334155",
    "--text-primary":    "#0f172a",
    "--text-warm":       "#1e293b",
    "--glass-bg":        "rgba(255, 255, 255, 0.7)",
    "--glass-bg-subtle": "rgba(255, 255, 255, 0.5)",
    "--glass-border":    "rgba(0, 0, 0, 0.06)",
    "--card-glow":       "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
    "--card-hover-glow": "0 2px 8px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)",
    "--accent-surface":  "rgba(217, 119, 6, 0.04)",
    "--nav-bg":          "rgba(241, 245, 249, 0.85)",
    "--nh-color":        "#92400e",
    "--nh-bg":           "#92400e14",
    "--nh-border":       "#92400e35",
  },
};


// ── App Shell (LiveStats standalone) ─────────────────────────────────────────
export default function App() {
  const [lightMode, setLightMode] = useState(true);

  useEffect(() => {
    const vars = lightMode ? THEMES.light : THEMES.dark;
    const root = document.documentElement;
    Object.entries(vars).forEach(([k, v]) => root.style.setProperty(k, v));
    root.style.background = vars["--bg-primary"];
  }, [lightMode]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", color: "var(--text-primary)" }}>
      {/* Minimal top bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 200, background: "var(--nav-bg)", backdropFilter: "blur(16px) saturate(180%)", WebkitBackdropFilter: "blur(16px) saturate(180%)", borderBottom: "1px solid var(--glass-border)", padding: "0.6rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.78rem", color: "var(--text-dim)", letterSpacing: "0.08em", fontWeight: 500 }}>
          LIVESTATS
        </span>
        <button onClick={() => setLightMode(v => !v)}
          style={{ background: "transparent", border: "1px solid var(--border-muted)", borderRadius: "var(--radius-sm, 6px)", color: "var(--text-muted)", padding: "0.35rem 0.65rem", fontFamily: "var(--font-ui, Inter, sans-serif)", fontSize: "0.78rem", cursor: "pointer", fontWeight: 500 }}>
          {lightMode ? "\u2600" : "\u263E"}
        </button>
      </div>
      <div style={{ paddingTop: "42px" }}>
        <TodayView recentAgentNames={new Set()} historicalAgentMap={{}} goalLookup={null} />
      </div>
    </div>
  );
}
