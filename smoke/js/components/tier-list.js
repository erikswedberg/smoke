// <tier-list tier="top50|honorable"> — joints in a tier, grouped by city.
// Template-driven (nunjucks -> idiomorph). Receives the dataset via the
// `data` property from app.js.

import BaseComponent from "../../lib/BaseComponent.js";
import { tierByCity } from "../data.js";

export default class TierList extends BaseComponent {
  constructor() {
    super();
    this.template = "tier-list.html";
    this.state = { data: null };
  }

  // `tier` is fixed config (set in HTML), read directly — not reactive.
  get tier() { return this.getAttribute("tier") || "top50"; }

  // Data flows in as a property from app.js; trigger a render when set.
  set data(d) { this.setState({ data: d }); }
  get data() { return this.state.data; }

  getTemplateContext() {
    const d = this.state.data;
    return { cities: d ? tierByCity(d, this.tier) : [] };
  }
}

customElements.define("tier-list", TierList);
