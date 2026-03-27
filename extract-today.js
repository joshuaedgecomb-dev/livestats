#!/usr/bin/env node
// Extract TodayView + TVMode + dependencies from main app.jsx into standalone app.
// Usage: node extract-today.js <source-app.jsx> <output-app.jsx>

import { readFileSync, writeFileSync } from 'fs';

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) { console.error("Usage: node extract-today.js <source> <output>"); process.exit(1); }

const lines = readFileSync(src, "utf-8").split("\n");

// Find line ranges
const find = (pattern) => lines.findIndex(l => pattern.test(l));
const findLast = (pattern, start = 0) => {
  for (let i = lines.length - 1; i >= start; i--) if (pattern.test(lines[i])) return i;
  return -1;
};

// Extract specific sections by line markers
const getRange = (startPattern, endPattern) => {
  const s = find(startPattern);
  if (s === -1) return "";
  const e = endPattern ? findLast(endPattern, s) : s;
  return lines.slice(s, e + 1).join("\n");
};

// Section: REGION_TO_SITE and VALID_REGIONS (around line 388-412)
const regionStart = find(/^const REGION_TO_SITE/);
const validRegEnd = find(/^const VALID_REGIONS/);
const regionBlock = lines.slice(regionStart, validRegEnd + 1).join("\n");

// Section: OTM constants, GOAL_CODES, helpers (around line 8483-8607)
const otmStart = find(/^const OTM_URL/);
const deriveEnd = find(/^const deriveHsdXm/);
// Find the closing of deriveHsdXm
let deriveClose = deriveEnd;
for (let i = deriveEnd; i < deriveEnd + 5; i++) { if (lines[i].includes("});")) { deriveClose = i; break; } }
const helpersBlock = lines.slice(otmStart, deriveClose + 1).join("\n");

// Section: TVMode component
const tvStart = find(/^\/\/ ── TVMode — Screensaver/);
const tvEnd = find(/^function TodayView/);
const tvBlock = lines.slice(tvStart, tvEnd).join("\n");

// Section: TodayView component (until closing brace before THEMES)
const todayStart = tvEnd;
const themesStart = find(/^const THEMES/);
// TodayView ends at the "}" line before THEMES
let todayEnd = themesStart - 1;
while (todayEnd > todayStart && lines[todayEnd].trim() === "") todayEnd--;
const todayBlock = lines.slice(todayStart, todayEnd + 1).join("\n");

// Section: THEMES
const themesEnd = find(/^export default function App/);
const themesBlock = lines.slice(themesStart, themesEnd).join("\n");

// Build the standalone app
const output = `import React from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────────────────
${regionBlock}

${helpersBlock}

// ── Components ───────────────────────────────────────────────────────────────
${tvBlock}
${todayBlock}

// ── Theme ────────────────────────────────────────────────────────────────────
${themesBlock}

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
          {lightMode ? "\\u2600" : "\\u263E"}
        </button>
      </div>
      <div style={{ paddingTop: "42px" }}>
        <TodayView recentAgentNames={new Set()} historicalAgentMap={{}} goalLookup={null} />
      </div>
    </div>
  );
}
`;

writeFileSync(out, output, "utf-8");
console.log("Extracted standalone app to " + out);
console.log("  TVMode: " + tvBlock.split("\n").length + " lines");
console.log("  TodayView: " + todayBlock.split("\n").length + " lines");
