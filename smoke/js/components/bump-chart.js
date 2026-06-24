// <bump-chart> — the ranked top-10 standings over time.
//
// THE D3 EXCEPTION (see ZELDMAN_CLIENT.md): this component does NOT route
// its SVG through the nunjucks -> idiomorph path. D3 owns the SVG subtree;
// BaseComponent provides only the shell, lifecycle, props, and events.
// `this.template` stays null so render() is a no-op. Phase 4 fills in draw().

import BaseComponent from "../../lib/BaseComponent.js";
import { top10Restaurants, years } from "../data.js";

export default class BumpChart extends BaseComponent {
  constructor() {
    super();
    this.template = null;          // D3 owns the DOM here
    this.state = { data: null, highlightedId: null };
  }

  static props = { "highlighted-id": String };

  set data(d) { this.state.data = d; this.draw(); }
  get data() { return this.state.data; }

  onConnected() { this.draw(); }

  // Phase 3 placeholder: prove the data arrives and the shell renders.
  // Phase 4 replaces this body with the real D3 bump chart.
  draw() {
    const d = this.state.data;
    if (!d || !window.d3) return;
    const lines = top10Restaurants(d);
    const yrs = years(d);
    this.innerHTML = `
      <div class="bump-chart-container is-placeholder">
        <p class="bump-chart__note">
          Bump chart goes here — ${lines.length} joints have cracked the ranked
          top 10 across ${yrs.length} editions (${yrs.join(", ")}).
          <span>D3 + SVG, Phase 4.</span>
        </p>
        <ul class="bump-chart__preview">
          ${lines.slice(0, 8).map((r) => `
            <li style="--coin:${r.color}">
              ${r.logo ? `<img src="/${r.logo}" alt="">` : `<span>${r.shortCode}</span>`}
              <em>${r.name}</em>
            </li>`).join("")}
        </ul>
      </div>`;
  }

  // React to highlight changes (Phase 4 will animate the D3 selection).
  attributeChangedCallback(name) {
    if (name === "highlighted-id") this.state.highlightedId = this.getAttribute("highlighted-id");
  }
}

customElements.define("bump-chart", BumpChart);
