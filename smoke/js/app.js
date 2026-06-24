// The Smoke Rankings — entry point.
//
// Zeldman, client-only: app.js does the bare minimum. It registers the
// components and loads the dataset into the ambient store. It does NOT reach
// into the DOM, wire events, or push data around — components pull data from
// the store on connect, and interactive state flows through the component
// tree (events up, props down).

import "./components/bump-chart.js";
import "./components/tier-list.js";
import "./components/tier-section.js";
import "./components/filter-bar.js";
import "./components/restaurant-card.js";

import { loadData } from "./data.js";
import { setData } from "./store.js";

loadData()
  .then(setData)
  .catch((err) => console.error("Smoke: failed to load data", err));
