#!/usr/bin/env node
// Extract TodayView + TVMode + dependencies from main app.jsx into standalone app.
// Uses known section boundaries rather than brace-counting (JSX braces break counters).
// Usage: node extract-today.js <source-app.jsx> <output-app.jsx>

import { readFileSync, writeFileSync } from 'fs';

const src = process.argv[2];
const out = process.argv[3];
if (!src || !out) { console.error("Usage: node extract-today.js <source> <output>"); process.exit(1); }

const lines = readFileSync(src, "utf-8").split("\n");

const find = (pattern, after = 0) => {
  for (let i = after; i < lines.length; i++) if (pattern.test(lines[i])) return i;
  return -1;
};

const slice = (from, to) => lines.slice(from, to).join("\n");

// 1. Q constant + attainColor (lines ~70-82)
const qStart = find(/^const Q = \{/);
const attainEnd = find(/^$/, find(/^function attainColor/, qStart)); // blank line after attainColor
const qBlock = slice(qStart, attainEnd);

// 2. REGION_TO_SITE + VALID_REGIONS (lines ~388-412)
const rtsStart = find(/^const REGION_TO_SITE/);
const vrLine = find(/^const VALID_REGIONS/, rtsStart);
const rtsBlock = slice(rtsStart, vrLine + 1);

// 3. getGoalEntries (lines ~843-920)
const ggeStart = find(/^function getGoalEntries/);
const ggeEnd = find(/^function computePlanRow/);
const ggeBlock = slice(ggeStart, ggeEnd);

// 4. computePlanRow (lines ~923-935)
const cprStart = ggeEnd;
const cprEnd = find(/^function /, cprStart + 1); // next function after computePlanRow
const cprBlock = slice(cprStart, cprEnd);

// 5. OTM_URL through deriveHsdXm (lines ~8483-8607)
const otmStart = find(/^const OTM_URL/);
const tvModeComment = find(/^\/\/ ── TVMode/, otmStart);
const otmBlock = slice(otmStart, tvModeComment);

// 6. TVMode component — from comment to start of TodayView
const todayViewStart = find(/^function TodayView/);
const tvBlock = slice(tvModeComment, todayViewStart);

// 7. TodayView — from function to the blank line before THEMES
const themesConst = find(/^const THEMES/);
// Walk backwards from THEMES to find end of TodayView (last non-blank line before THEMES section)
let todayEndLine = themesConst - 1;
while (todayEndLine > todayViewStart && lines[todayEndLine].trim() === "" || lines[todayEndLine].startsWith("// ═")) todayEndLine--;
const todayBlock = slice(todayViewStart, todayEndLine + 1);

// 8. THEMES block — from const THEMES to export default
const appStart = find(/^export default function App/);
const themesBlock = slice(themesConst, appStart);

// Build standalone app
const output = `import React from "react";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";

// ── Quartile colors + attainColor ────────────────────────────────────────────
${qBlock}

// ── Region mapping ───────────────────────────────────────────────────────────
${rtsBlock}

// ── Goal helpers ─────────────────────────────────────────────────────────────
${ggeBlock}
${cprBlock}

// ── OTM constants + helpers ──────────────────────────────────────────────────
${otmBlock}

// ── TVMode ───────────────────────────────────────────────────────────────────
${tvBlock}

// ── TodayView ────────────────────────────────────────────────────────────────
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
console.log("  Q + attainColor: " + qBlock.split("\n").length + " lines");
console.log("  Region mapping: " + rtsBlock.split("\n").length + " lines");
console.log("  getGoalEntries: " + ggeBlock.split("\n").length + " lines");
console.log("  computePlanRow: " + cprBlock.split("\n").length + " lines");
console.log("  OTM helpers: " + otmBlock.split("\n").length + " lines");
console.log("  TVMode: " + tvBlock.split("\n").length + " lines");
console.log("  TodayView: " + todayBlock.split("\n").length + " lines");
console.log("  THEMES: " + themesBlock.split("\n").length + " lines");
