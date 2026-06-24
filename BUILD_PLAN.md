# Texas Monthly Top 50 BBQ — Historical Bump Chart

A web visualization tracking every restaurant across every edition of Texas Monthly's Top 50 BBQ list, from 2008 to present.

## What is this?

A **bump chart** (aka ranking chart) showing how BBQ joints rise and fall across Texas Monthly's quadrennial Top 50 BBQ rankings. Think Tour de France GC standings or Premier League tables — but for smoked meat.

The visualization was inspired by Henry Gannett's 1890 US Statistical Atlas charts showing city population rankings over time.

## The Editions

| Year | #1 | Ranked Depth | Notes |
|------|-----|-------------|-------|
| 2008 | Snow's BBQ | ~10 | Snow's explodes onto the scene. Franklin hadn't opened yet. |
| 2013 | Franklin Barbecue | Top 4 only | Daniel Vaughn's first list as BBQ editor. Only top 4 ranked, rest alphabetical. |
| 2017 | Snow's BBQ | Top 10 | Snow's reclaims #1. First edition with a full ranked top 10. |
| 2021 | Goldee's Barbecue | Top 10 | Young Fort Worth upstart dethrones legends. First edition with honorable mentions (next 50). |
| 2025 | Burnt Bean Co. | Top 10 | Snow's and Franklin both drop out of top 10 for the first time ever. |

## Data Structure

Normalized JSON with three "tables":

```json
{
  "editions": [
    { "year": 2008, "rankedDepth": 10, "honorableMentions": false },
    { "year": 2013, "rankedDepth": 4,  "honorableMentions": false },
    { "year": 2017, "rankedDepth": 10, "honorableMentions": false },
    { "year": 2021, "rankedDepth": 10, "honorableMentions": true },
    { "year": 2025, "rankedDepth": 10, "honorableMentions": true }
  ],

  "restaurants": {
    "franklin-barbecue": {
      "name": "Franklin Barbecue",
      "shortCode": "FR",
      "city": "Austin",
      "address": "900 E 11th St, Austin, TX 78702",
      "color": "#E85D3A",
      "logo": "logos/franklin.png"
    }
  },

  "rankings": [
    { "year": 2013, "id": "franklin-barbecue", "rank": 1, "tier": "top10" },
    { "year": 2017, "id": "franklin-barbecue", "rank": 2, "tier": "top10" },
    { "year": 2021, "id": "franklin-barbecue", "rank": 7, "tier": "top10" },
    { "year": 2025, "id": "franklin-barbecue",            "tier": "top50" }
  ]
}
```

**Key design decisions:**
- `rank` is only present when we actually know it. Omitted for unranked tiers.
- `tier` is one of `"top10"`, `"top50"`, `"honorable"` — determines which visual zone.
- `editions` captures metadata like 2013 only ranking a top 4.
- Rankings as a flat array is easy to filter both ways: by restaurant for history, by year for a snapshot.

## Visual Design

### Three tiers (descending visual weight)

1. **Top 10 Bump Chart** — big coin-sized circles (~40px) with logos, connected by curved lines. Y-axis = rank 1–10 (top to bottom, #1 at top). X-axis = edition years. Grey lines by default; darken on hover. Restaurants that drop below 10 or arrive from outside get lines entering/exiting the zone.

2. **11–50 Grid** — smaller profile-pic circles (~24px). Grouped by city, cities ordered by population descending (Houston, DFW, San Antonio, Austin, then smaller towns). Shows which year(s) each appeared.

3. **51–100 / Honorable Mentions** — text list. Only exists for 2021 and 2025 editions.

### Interactions
- All lines grey by default.
- Hover on any restaurant: its line turns dark/colored, all others dim further.
- Tooltip with name, city, full rank history.
- Future: click to pin, map integration ("I'm in ___ town, show me nearby joints").

## Project Structure

```
smoke/
├── index.html
├── css/
│   └── styles.css
├── js/
│   ├── app.js                  # entry point, orchestration
│   ├── components/
│   │   ├── bump-chart.js        # <bump-chart> web component
│   │   ├── tier-list.js         # <tier-list> web component (11-50, 51-100)
│   │   └── restaurant-card.js   # <restaurant-card> web component
│   └── data.js                  # data loading/parsing helpers
├── data/
│   └── rankings.json
├── logos/                       # restaurant logos (png/svg)
├── BUILD_PLAN.md                # this file
└── README.md
```

**Tech stack:** Vanilla HTML/CSS/JS with Web Components. D3.js v7 for the bump chart (via CDN). No frameworks. No build step.

## Build Phases

### Phase 1: Data Collection → `rankings.json`
Research and compile all restaurants + rankings across all 5 editions (2008, 2013, 2017, 2021, 2025). Include addresses. Sources: Texas Monthly articles, CultureMap recaps, TexAgs threads, BBQ Posse, Wikipedia.

**Known data gaps:**
- 2008: Snow's is #1. Exact ranks for #2–10 may be hard to confirm from free sources.
- 2013: Only top 4 officially ranked (Franklin, Snow's, Louie Mueller, Pecan Lodge). Positions 5–50 alphabetical.
- 2017+: Full top 10 available.

**Status:** Not started

### Phase 2: Logos
Attempt to find/create small logos for restaurants that have appeared in any top 10 (~25–30 unique restaurants). Generate colored-circle-with-initials fallbacks for the rest.

**Status:** Not started

### Phase 3: App Scaffolding
HTML shell, CSS layout, web component stubs (`<bump-chart>`, `<tier-list>`, `<restaurant-card>`), static file serving via systemd.

**Status:** Not started

### Phase 4: Wiring It Up
D3 bump chart renders from JSON. Tier lists populate. Lines connect restaurants across editions. Logos clip into circles.

**Status:** Not started

### Phase 5: Interactions & Refinements
Hover highlighting, tooltips, responsive layout, accessibility. Future: map search ("I'm in ___ town"), filter by region, pin/compare restaurants.

**Status:** Not started

## Notable Storylines the Chart Should Tell

- **Snow's BBQ**: #1 → #2 → #1 → #9 → out of top 10. The rise and gentle fade of Tootsie Tomanetz's legend.
- **Franklin Barbecue**: (not open) → #1 → #2 → #7 → out of top 10. Aaron Franklin raised the tide for all Texas BBQ, then the tide he raised overtook him.
- **Goldee's**: didn't exist → didn't exist → didn't exist → #1 → #3. Meteoric debut.
- **Burnt Bean Co.**: didn't exist → didn't exist → didn't exist → (not on list?) → #1. Newest king.
- **Louie Mueller**: Perennial presence since forever, floats between top 10 and top 50.
- **Truth BBQ**: Steady climber from first appearance to consistent top 10.
