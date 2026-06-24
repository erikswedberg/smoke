# Design Notes & Decisions

Supplemental context not captured in `BUILD_PLAN.md`. Read both before building.

## Data Gaps: Just Ship It

The 2008 edition has incomplete ranking data (we know #1 is Snow's, but exact positions for #2–10 are hard to confirm from free sources). **Decision: build with what we have, mark uncertain positions with a visual indicator (e.g. dashed border on the circle, dimmed line). Don't block on perfect 2008 data.**

## The "Below the Fold" Zone in the Bump Chart

The bump chart's Y-axis is rank 1–10, but there needs to be a visual zone *below* rank 10 — call it the "off the top 10" gutter. When a restaurant drops out of the top 10 (like Franklin going from #7 in 2021 to unranked-top-50 in 2025), its line should curve down into this zone rather than just disappearing. If a restaurant later returns to the top 10, the line curves back up. This makes drops and comebacks visible and dramatic.

This zone is not the same as the 11–50 tier list below the chart — it's part of the chart itself.

## Faded Pins for Delisted Restaurants (Future Map Feature)

When we eventually build the map search ("I'm in ___ town, show me nearby joints"), restaurants that appeared on *any* past list but not the current one should still appear — just with a faded/muted pin color. The user's feeling is that dropping off the list is sometimes criminal, and those joints still deserve to be findable. The current year's list gets full-color pins.

## Logo Strategy: Don't Block

Try to grab real logos for the ~25–30 restaurants that have appeared in any top 10. But if logo sourcing becomes a time sink, punt immediately to colored circles with bold 2-letter abbreviations (the `shortCode` field in the data). Logos are a nice-to-have, not a blocker. Can always backfill later.

## Editorial Voice

This isn't a neutral data dump. The visualization should have a point of view — it should let you *feel* when a legendary joint gets dethroned, when an upstart rockets to #1, or when a beloved place quietly falls off the list. Design choices (line weight, animation, color contrast) should serve that storytelling instinct.
