// <tier-section tier="top50" heading="11–50" filterable> — a stateful section
// that owns its filter selection and composes a filter-bar + tier-list.
//
// This is the Zeldman parent: it holds state (which years are active),
// re-renders its subtree via the template, passes state DOWN to children as
// attributes (filter-bar gets `active`, tier-list gets `active-years`), and
// listens for the `filter-toggle` events that bubble UP from filter-bar.
// Children are dumb and controlled; no component reaches across the DOM.

import BaseComponent from "../../lib/BaseComponent.js";
import { whenData } from "../store.js";
import { years } from "../data.js";

export default class TierSection extends BaseComponent {
  constructor() {
    super();
    this.template = "tier-section.html";
    this.state = { allYears: [], activeYears: [] };
  }

  static props = {
    "tier": String,
    "heading": String,
    "note": String,
    "filterable": Boolean,
  };

  connectedCallback() {
    super.connectedCallback();
    // Catch filter changes bubbling up from the child filter-bar.
    this.addEventListener("filter-toggle", (e) => this.onToggle(e.detail));
    // Pull the dataset from the store to learn the available years.
    whenData((data) => {
      const all = years(data);
      this.setState({ allYears: all, activeYears: all });
    });
  }

  onToggle({ group, value, action }) {
    if (group !== "years") return;
    let active = new Set(this.state.activeYears);
    if (action === "all") {
      active = new Set(this.state.allYears);
    } else {
      active.has(value) ? active.delete(value) : active.add(value);
      if (active.size === 0) active = new Set(this.state.allYears); // never empty
    }
    // keep chronological order
    this.setState({ activeYears: this.state.allYears.filter((y) => active.has(y)) });
  }

  getTemplateContext() {
    const all = this.state.allYears;
    const active = this.state.activeYears;
    return {
      tier: this.state.tier,
      heading: this.state.heading,
      note: this.state.note,
      filterable: this.state.filterable,
      // shaped for the filter-bar: groups of options with on/off
      groups: [{
        key: "years",
        label: "Year",
        options: all.map((y) => ({ value: y, label: String(y), on: active.includes(y) })),
      }],
      activeYears: active,
    };
  }
}

customElements.define("tier-section", TierSection);
