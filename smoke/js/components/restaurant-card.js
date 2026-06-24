// <restaurant-card restaurant-id="franklin-barbecue"> — one joint's identity
// and rank history. Template-driven. Reads the ambient dataset from
// window.Smoke.data, or accepts a restaurant object via the `record` property.

import BaseComponent from "../../lib/BaseComponent.js";
import { restaurant, historyOf } from "../data.js";

export default class RestaurantCard extends BaseComponent {
  constructor() {
    super();
    this.template = "restaurant-card.html";
    this.state = { record: null };
  }

  static props = { "restaurant-id": String };

  set record(r) { this.setState({ record: r }); }
  get record() { return this.state.record; }

  resolve() {
    if (this.state.record) return this.state.record;
    const id = this.state.restaurantId || this.getAttribute("restaurant-id");
    const data = window.Smoke?.data;
    if (!id || !data) return null;
    const r = restaurant(data, id);
    return r ? { ...r, history: historyOf(data, id) } : null;
  }

  getTemplateContext() { return { r: this.resolve() }; }
}

customElements.define("restaurant-card", RestaurantCard);
