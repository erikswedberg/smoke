// <tier-list tier="top50" active-years="[2017,2021]"> — joints in a tier,
// grouped by city. A controlled child: it pulls the (immutable) dataset from
// the store on connect, and takes its filter as the `active-years` attribute
// from its parent. No internal filter UI, no DOM reaching.

import BaseComponent from "../../lib/BaseComponent.js";
import { whenData } from "../store.js";
import { tierByCity } from "../data.js";

export default class TierList extends BaseComponent {
  constructor() {
    super();
    this.template = "tier-list.html";
    this.state = { data: null, activeYears: null };
  }

  static props = {
    "tier": String,
    "active-years": Array, // null/absent = no filter (all years)
  };

  connectedCallback() {
    super.connectedCallback();
    whenData((data) => this.setState({ data }));
  }

  getTemplateContext() {
    const d = this.state.data;
    const years = this.state.activeYears; // Array or null
    const filter = Array.isArray(years) ? new Set(years) : null;
    return { cities: d ? tierByCity(d, this.state.tier || "top50", filter) : [] };
  }
}

customElements.define("tier-list", TierList);
