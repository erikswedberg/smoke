// The Smoke Rankings — app entry point.
//
// 1. Load the normalized data once.
// 2. Stash it on window.Smoke so components can read it (client-only: there's
//    no SSR, so the loaded data — not the DOM — is the source of truth).
// 3. Register the components (each module calls customElements.define).
// 4. Hand data down to the top-level components via properties.

import { loadData, top10Restaurants, snapshot, years } from "./data.js";

// Register components (side-effect imports — each defines a custom element).
import "./components/bump-chart.js";
import "./components/tier-list.js";
import "./components/restaurant-card.js";

async function main() {
  let data;
  try {
    data = await loadData();
  } catch (err) {
    console.error("Smoke: failed to load data", err);
    return;
  }

  // Make the dataset + a few precomputed views ambient for components.
  window.Smoke = window.Smoke || {};
  window.Smoke.data = data;
  window.Smoke.views = {
    years: years(data),
    top10: top10Restaurants(data),
    snapshot: (year) => snapshot(data, year),
  };

  // Hand data down to top-level components. Setting a property (not an
  // attribute) avoids stuffing kilobytes of JSON into the DOM; the component
  // reads it on connect / when set.
  const bump = document.querySelector("bump-chart");
  if (bump) bump.data = data;

  document.querySelectorAll("tier-list").forEach((el) => { el.data = data; });

  // Announce readiness for any late-arriving listeners.
  window.dispatchEvent(new CustomEvent("smoke-data-ready", { detail: { data } }));
}

main();
