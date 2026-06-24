#!/usr/bin/env node
// Derive each logo's representative brand color for the bump-chart lines.
//
// Approach: flatten onto white, quantize to a small palette, read the
// histogram, then score candidates — prefer frequent AND saturated colors,
// discard near-white/near-black/grey (background + outlines). Falls back to
// the curated color if a logo is essentially monochrome.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const LOGOS = join(ROOT, "logos");

function hist(file) {
  // Flatten transparency onto white, downscale, quantize to 16 colors,
  // emit "count: (r,g,b) ..." histogram.
  const out = execFileSync("convert", [
    file, "-background", "white", "-flatten",
    "-resize", "80x80", "-colors", "16", "-depth", "8",
    "-format", "%c", "histogram:info:-",
  ], { encoding: "utf8", maxBuffer: 8 << 20 });
  const rows = [];
  const re = /(\d+):\s*\(\s*(\d+),\s*(\d+),\s*(\d+)/g;
  let m;
  while ((m = re.exec(out))) {
    rows.push({ count: +m[1], r: +m[2], g: +m[3], b: +m[4] });
  }
  return rows;
}

function hsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const s = max === 0 ? 0 : d / max;
  return { s, v: max };
}

function toHex(r, g, b) {
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Pick the brand color: among non-background colors, maximize a blend of
// frequency and saturation so a vivid logo color wins over grey/ink.
function pick(rows) {
  const total = rows.reduce((a, x) => a + x.count, 0) || 1;
  let best = null, bestScore = -1;
  for (const c of rows) {
    const { s, v } = hsv(c.r, c.g, c.b);
    const frac = c.count / total;
    // discard background-ish: very light, very dark, or desaturated greys
    if (v > 0.93 && s < 0.12) continue;        // white-ish
    if (v < 0.16) continue;                    // black-ish (outlines)
    if (s < 0.18) continue;                    // greys
    // score: saturation matters most, frequency as a tiebreaker, mild
    // bonus for mid-to-high value (avoid muddy darks)
    const score = s * 1.6 + frac * 1.0 + v * 0.4;
    if (score > bestScore) { bestScore = score; best = c; }
  }
  return best ? toHex(best.r, best.g, best.b) : null;
}

const files = readdirSync(LOGOS).filter((f) => /\.(png|jpg|jpeg|webp|svg)$/i.test(f) && !f.startsWith("_"));
const colors = {};
for (const f of files) {
  const id = f.replace(/\.[^.]+$/, "");
  try {
    const c = pick(hist(join(LOGOS, f)));
    if (c) colors[id] = c;
    console.log(`${id.padEnd(22)} ${c || "(monochrome - keep curated)"}`);
  } catch (e) {
    console.log(`${id.padEnd(22)} ERR ${e.message.split("\n")[0]}`);
  }
}

writeFileSync(join(__dirname, "logo-colors.json"), JSON.stringify(colors, null, 2) + "\n");
console.log(`\nwrote ${Object.keys(colors).length} colors -> scripts/logo-colors.json`);
