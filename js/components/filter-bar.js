// <filter-bar groups="[...]" active="[...]"> — controlled toggle-pill rows.
//
// A dumb, controlled child (Zeldman): it holds NO state. It renders whatever
// `groups` (with each option's on/off already decided by the parent) it's
// given, and on click emits a `filter-toggle` event UP to its parent:
//   { detail: { group, value, action } }
// The parent owns the selection, updates it, and passes new attributes back
// down — which re-renders this component. Generic: knows nothing about years
// or regions, just groups of options.

import BaseComponent from "../../lib/BaseComponent.js";

export default class FilterBar extends BaseComponent {
  constructor() {
    super();
    this.template = "filter-bar.html";
    this.state = { groups: [] };
  }

  static props = { "groups": Array };

  getTemplateContext() {
    return { groups: this.state.groups || [] };
  }

  connectedCallback() {
    super.connectedCallback();
    // Delegated; emit intent upward. Parent decides what it means.
    this.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-group]");
      if (!btn) return;
      const group = btn.dataset.group;
      if (btn.dataset.action === "all") {
        this.emit("filter-toggle", { group, action: "all" });
      } else {
        // values arrive as strings from the DOM; coerce back to Number when
        // the option's value was numeric (years are numbers).
        const raw = btn.dataset.value;
        const value = /^-?\d+$/.test(raw) ? Number(raw) : raw;
        this.emit("filter-toggle", { group, value });
      }
    });
  }
}

customElements.define("filter-bar", FilterBar);
