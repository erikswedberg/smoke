#!/usr/bin/env node
// Build data/rankings.json from the per-edition research rosters.
//
// The hard problem is IDENTITY: the same joint appears under name/city
// variants across editions, while some identical names are different joints.
// We resolve this with two explicit, auditable tables:
//   UNIFY        - exact variant name  -> canonical id (merge same joint)
//   DISAMBIGUATE - names that need city appended (same name, different joints)
// Everything else falls back to a conservative base slug of the name.
//
// Curated fields (color, shortCode, address) for joints that have ever been
// in a ranked top-tier are preserved from curated.json. Others get an
// auto-generated shortCode and a deterministic palette color.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const R = (f) => JSON.parse(readFileSync(join(ROOT, "data", "_research", f), "utf8"));

const EDITIONS = [
  { year: 2008, file: "2008.json" },
  { year: 2013, file: "2013.json" },
  { year: 2017, file: "2017.json" },
  { year: 2021, file: "2021.json" },
  { year: 2025, file: "2025.json" },
];

// --- identity resolution -------------------------------------------------

function baseSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[°+]/g, "")
    .replace(/['.,!]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Same joint, spelled differently across editions -> one canonical id.
const UNIFY = {
  // top-tier joints (ids match the Phase-1 curated set)
  "Truth BBQ": "truth-bbq",
  "Truth Barbeque": "truth-bbq",
  "Tejas Chocolate + Barbecue": "tejas-chocolate",
  "Tejas Chocolate Craftory": "tejas-chocolate",
  "CorkScrew BBQ": "corkscrew-bbq",
  "Corkscrew BBQ": "corkscrew-bbq",
  "Micklethwait Craft Meats": "micklethwait",
  "Micklethwait Barbecue": "micklethwait",
  "Bodacious Bar-B-Q|Longview": "bodacious-bbq", // 2017 #4 flagship
  "LeRoy and Lewis Barbecue": "leroy-and-lewis",
  "Dayne's Craft Barbecue": "daynes-craft-bbq",
  "Cattleack Barbeque": "cattleack-barbeque",
  // curated short ids (keep hand-written addresses/colors attached)
  "Evie Mae's Pit Barbeque": "evie-maes",
  "Evie Mae's Pit Barbecue": "evie-maes",
  "Louie Mueller Barbecue": "louie-mueller",
  "Killen's Barbecue": "killens-bbq",
  "Valentina's Tex Mex BBQ": "valentinas",
  "Blood Bros. BBQ": "blood-bros",
  "Heim Barbecue": "heim-bbq",
  // same Fort Worth joint, two spellings
  "Cousin's Barbecue": "cousins",
  "Cousin's Bar-B-Q": "cousins",
  // long tail variant unifications
  "Stiles Switch BBQ & Brew": "stiles-switch",
  "Stiles Switch BBQ": "stiles-switch",
  "Hays Co. Bar-B-Que": "hays-co-bbq",
  "Hays Co. Bar-B-Que and Catering": "hays-co-bbq",
  "Hay's County Barbeque": "hays-co-bbq",
  "The Granary 'Cue & Brew": "the-granary",
  "The Granary 'Cue and Brew": "the-granary",
  "Joseph's Riverport Barbecue": "josephs-riverport",
  "Joseph's Riverport Bar-B-Cue": "josephs-riverport",
  "Gatlin's BBQ": "gatlins-bbq",
  "Gatlin's BBQ & Catering": "gatlins-bbq",
  "Tyler's Barbecue": "tylers-bbq",
  "Tyler's Barbeque": "tylers-bbq",
  "Cowpoke's": "cowpokes",
  "Cowpokes Texas-Style Bar-B-Que": "cowpokes",
  "Slow Bone": "slow-bone",
  "Slow Bone BBQ": "slow-bone",
  "Stanley's Famous Pit Bar-B-Que": "stanleys-famous",
  "Stanley's Famous Pit BBQ": "stanleys-famous",
  "Stanley's Famous Pit Barbecue": "stanleys-famous",
  "Roegels Barbecue Co.": "roegels",
  "Roegels Barbecue Co": "roegels",
  "Meshack's Bar-B-Que": "meshacks",
  "Meshack's Bar-Be-Que": "meshacks",
  "Tom and Bingo's Hickory Pit Bar-b-que": "tom-and-bingos",
  "Tom & Bingo's Hickory Pit Bar-B-Q": "tom-and-bingos",
  "Whup's Boomerang Bar-B-Q": "whups-boomerang",
  "Whup's Boomerang Bar-B-Que": "whups-boomerang",
  "Buzzie's Bar-B-Que": "buzzies",
  "Buzzie's Bar-B-Q": "buzzies",
  "Schoepf's Old Time Pit Bar-B-Que": "schoepfs",
  "Schoepf's BBQ": "schoepfs",
  "Black Board Bar-B-Q": "black-board",
  "Black Board Bar B Q": "black-board",
  "Choche's BBQ": "choches",
  "Choche's BBQ & Bar": "choches",
  "Brick Vault Brewery and Barbecue": "brick-vault",
  "Brick Vault Brewery & Barbecue": "brick-vault",
  "Harris Bar-B-Que": "harris-bbq", // Waxahachie/Cedar Hill (same family)
  "Butter's BBQ": "butters-bbq",   // Mathis -> Sinton (relocated)
  "Pinkerton's Barbecue": "pinkertons", // Houston/SA outposts, one brand
  "Lockhart Smokehouse": "lockhart-smokehouse", // Dallas/Plano, one brand
  "Terry Black's Barbecue": "terry-blacks", // Austin/Dallas, one brand
};

// Identical names that are DIFFERENT joints -> append city to the id.
const DISAMBIGUATE = new Set([
  "Bodacious Bar-B-Q", // Longview (top10) vs Hallsville (honorable)
]);

function canonicalId(name, city) {
  const keyed = `${name}|${city}`;
  if (UNIFY[keyed]) return UNIFY[keyed];
  if (UNIFY[name]) return UNIFY[name];
  if (DISAMBIGUATE.has(name)) return `${baseSlug(name)}-${baseSlug(city)}`;
  return baseSlug(name);
}

// Prefer the cleanest display name per joint (longest "official"-looking).
// We pick the name from the most RECENT edition the joint appears in, since
// that reflects current branding; ties broken by longer string.
function pickDisplay(records) {
  return [...records].sort((a, b) => b.year - a.year || b.name.length - a.name.length)[0];
}

// --- assemble ------------------------------------------------------------

// rows: { year, id, name, city, tier(raw), rank }
const rows = [];
for (const { year, file } of EDITIONS) {
  for (const e of R(file)) {
    const id = canonicalId(e.name, e.city);
    rows.push({ year, id, name: e.name, city: e.city, rawTier: e.tier, rank: e.rank ?? null });
  }
}

// Map research tiers -> schema tiers. top4 (2013) is the ranked top tier,
// so it maps to top10 in our schema (the bump-chart line zone).
const TIER = { top10: "top10", top4: "top10", top50: "top50", honorable: "honorable" };

// Group rows per joint.
const byId = new Map();
for (const r of rows) {
  if (!byId.has(r.id)) byId.set(r.id, []);
  byId.get(r.id).push(r);
}

// Curated overrides (colors / shortCodes / addresses) preserved across builds.
const curated = JSON.parse(readFileSync(join(ROOT, "scripts", "curated.json"), "utf8"));

// Deterministic palette for non-curated joints (warm smoke/bbq tones).
const PALETTE = [
  "#A0522D", "#8C6239", "#B7950B", "#7E5109", "#6B8E23", "#2E8B57",
  "#1F8A8A", "#3D5AAE", "#566573", "#9B59B6", "#CB4335", "#117A65",
  "#AF601A", "#2471A3", "#922B21", "#D68910", "#196F3D", "#B03A2E",
  "#7D3C98", "#148F77", "#CA6F1E", "#A93226", "#1ABC9C", "#5D4037",
];
function colorFor(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function shortCodeFor(name) {
  const stop = new Set(["the", "a", "of", "and", "co", "bbq", "bar", "b", "q", "que", "pit"]);
  const words = name.replace(/[^A-Za-z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  const sig = words.filter((w) => !stop.has(w.toLowerCase()));
  const pick = sig.length ? sig : words;
  if (pick.length >= 2) return (pick[0][0] + pick[1][0]).toUpperCase();
  return (pick[0] || name).slice(0, 2).toUpperCase();
}

// Build restaurants dict.
const restaurants = {};
for (const [id, recs] of byId) {
  const disp = pickDisplay(recs);
  const cur = curated[id] || {};
  restaurants[id] = {
    name: cur.name || disp.name,
    shortCode: cur.shortCode || shortCodeFor(disp.name),
    city: cur.city || disp.city,
    address: cur.address || "",
    color: cur.color || colorFor(id),
  };
}

// Build rankings array (one row per year+id), ordered by year then rank.
const rankings = [];
for (const { year } of EDITIONS) {
  const yr = rows
    .filter((r) => r.year === year)
    .map((r) => {
      // A ranked entry always lives in the bump-chart (top10) zone, even if
      // the source roster filed it under top50 (e.g. Snow's #1 in the 2008
      // alphabetical list).
      const tier = r.rank != null ? "top10" : TIER[r.rawTier];
      const row = { year, id: r.id, tier };
      if (r.rank != null) row.rank = r.rank;
      // 2013 top-tier joints other than Franklin (#1) are not individually
      // ranked, and 2008 is alphabetical with only Snow's known: mark the
      // unranked-but-top-tier entries uncertain so the chart can dim them.
      if (tier === "top10" && r.rank == null) row.uncertain = true;
      return row;
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  rankings.push(...yr);
}

const out = {
  meta: {
    title: "Texas Monthly Top 50 BBQ — The Bump Chart",
    source:
      "Texas Monthly quadrennial Top 50 BBQ lists (2008, 2013, 2017, 2021, 2025), each compiled from the published edition and cross-checked against CultureMap, PaperCity, WFAA, Texas BBQ Posse, feastio, and contemporaneous reporting. Per-edition rosters archived under data/_research/.",
    notes:
      "rank is present only when the published edition ranked that position. 2008 listed all 50 alphabetically by city with only Snow's known at #1 (others uncertain). 2013 ranked only the top 4 (Franklin #1; the other three uncertain). 2017 ranked a full top 10. 2021 and 2025 ranked a top 10, listed 40 more (top50), and added 50 honorable mentions each. Same-joint name/city variants are unified via scripts/build-rankings.mjs; chains appearing in different cities are treated as one brand except Bodacious (Longview vs Hallsville).",
  },
  editions: [
    { year: 2008, rankedDepth: 1, honorableMentions: false, note: "Snow's explodes onto the scene at #1. Franklin hadn't opened yet. Listed alphabetically; ranks #2-50 not published." },
    { year: 2013, rankedDepth: 4, honorableMentions: false, note: "Daniel Vaughn's first list as BBQ editor. Only the top 4 ranked (Franklin #1); the rest alphabetical." },
    { year: 2017, rankedDepth: 10, honorableMentions: false, note: "Snow's reclaims #1. First edition with a full ranked top 10." },
    { year: 2021, rankedDepth: 10, honorableMentions: true, note: "Goldee's, a young Fort Worth upstart, dethrones the legends. First edition with 50 honorable mentions." },
    { year: 2025, rankedDepth: 10, honorableMentions: true, note: "Burnt Bean Co. takes #1. Snow's and Franklin both drop out of the top 10 for the first time ever." },
  ],
  restaurants,
  rankings,
};

writeFileSync(join(ROOT, "data", "rankings.json"), JSON.stringify(out, null, 2) + "\n");

// --- report --------------------------------------------------------------
console.log(`restaurants: ${Object.keys(restaurants).length}`);
console.log(`ranking rows: ${rankings.length}`);
for (const { year } of EDITIONS) {
  const yr = rankings.filter((r) => r.year === year);
  const t10 = yr.filter((r) => r.tier === "top10").length;
  const t50 = yr.filter((r) => r.tier === "top50").length;
  const hon = yr.filter((r) => r.tier === "honorable").length;
  console.log(`  ${year}: ${yr.length}  (top10 ${t10}, top50 ${t50}, honorable ${hon})`);
}
// Audit: every canonical id with the distinct (name|city) variants merged in.
const audit = [];
for (const [id, recs] of byId) {
  const variants = [...new Set(recs.map((r) => `${r.name} [${r.city}]`))];
  if (variants.length > 1) audit.push(`  ${id}: ${variants.join("  |  ")}`);
}
console.log(`\nmerged joints (>1 variant): ${audit.length}`);
console.log(audit.sort().join("\n"));
