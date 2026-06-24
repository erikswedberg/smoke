// <tier-flow> — B (11–50) on the left, a D3 spline channel in the middle,
// C (honorable) on the right. A spline connects each joint that crossed
// between the two lists across editions. Splines are drawn in the joint's
// dot color (light), darkening on hover.
//
// Two render paths coexist here, deliberately:
//   - The two LISTS are template-driven (nunjucks -> idiomorph), like every
//     other Zeldman component. State (active years) drives re-render.
//   - The SPLINE CHANNEL is a measured SVG overlay: after each render we read
//     the rendered rows' geometry and draw paths with D3. It's recomputed on
//     resize / font swap / filter change via a ResizeObserver. (Same "D3 owns
//     its SVG" exception as the bump chart, but coordinates come from the DOM,
//     not a data scale.)

import BaseComponent from "../../lib/BaseComponent.js";
import { whenData } from "../store.js";
import { tierFlow, years } from "../data.js";

export default class TierFlow extends BaseComponent {
  constructor() {
    super();
    this.template = "tier-flow.html";
    this.state = { data: null, allYears: [], activeYears: [], activeMoves: ["fell", "rose"], hovered: null };
    this._ro = null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener("filter-toggle", (e) => this.onToggle(e.detail));

    // Hover a row -> isolate its link (delegated).
    this.addEventListener("pointerover", (e) => {
      const row = e.target.closest(".flow-row.is-linked");
      this.setHover(row ? row.dataset.id : null);
    });
    this.addEventListener("pointerleave", () => this.setHover(null));

    whenData((data) => {
      const all = years(data);
      this.setState({ data, allYears: all, activeYears: all });
    });

    // Redraw splines whenever the columns' geometry changes (resize, zoom,
    // font swap, filter re-render, late-loading logos).
    this._ro = new ResizeObserver(() => this.scheduleDraw());
    // Belt-and-suspenders: redraw once fonts settle.
    if (document.fonts?.ready) document.fonts.ready.then(() => this.scheduleDraw());
  }

  onDisconnected() { this._ro?.disconnect(); }

  onToggle({ group, value, action }) {
    if (group === "years") {
      let active = new Set(this.state.activeYears);
      if (action === "all") active = new Set(this.state.allYears);
      else {
        active.has(value) ? active.delete(value) : active.add(value);
        if (active.size === 0) active = new Set(this.state.allYears);
      }
      this.setState({ activeYears: this.state.allYears.filter((y) => active.has(y)) });
    } else if (group === "moves") {
      const ALL = ["fell", "rose"];
      let active = new Set(this.state.activeMoves);
      if (action === "all") active = new Set(ALL);
      else {
        active.has(value) ? active.delete(value) : active.add(value);
        if (active.size === 0) active = new Set(ALL);
      }
      this.setState({ activeMoves: ALL.filter((m) => active.has(m)) });
    }
  }

  setHover(id) {
    if (this.state.hovered === id) return;
    this.state.hovered = id;
    this.applyHover();
  }

  // --- template context ---

  flow() {
    const d = this.state.data;
    if (!d) return { left: [], right: [], links: [] };
    return tierFlow(d, "top50", "honorable",
      new Set(this.state.activeYears), new Set(this.state.activeMoves));
  }

  getTemplateContext() {
    const f = (this._flow = this.flow());
    const linkedIds = new Set(f.links.map((l) => l.id));
    const tag = (j) => ({ ...j, linked: linkedIds.has(j.id) });
    return {
      left: f.left.map(tag),
      right: f.right.map(tag),
      // only fallers selected -> the downward offset reads truthfully
      slidersOnly: this.state.activeMoves.length === 1 && this.state.activeMoves[0] === "fell",
      groups: [
        {
          key: "moves",
          label: "Move",
          options: [
            { value: "rose", label: "Risers", on: this.state.activeMoves.includes("rose") },
            { value: "fell", label: "Sliders", on: this.state.activeMoves.includes("fell") },
          ],
        },
        {
          key: "years",
          label: "Year",
          options: this.state.allYears.map((y) => ({
            value: y, label: String(y), on: this.state.activeYears.includes(y),
          })),
        },
      ],
    };
  }

  // --- spline channel (measured SVG overlay) ---

  afterRender() {
    // Observe the two columns for any geometry change.
    if (this._ro) {
      this._ro.disconnect();
      this.querySelectorAll(".flow-col").forEach((c) => this._ro.observe(c));
    }
    this.scheduleDraw();
  }

  scheduleDraw() {
    cancelAnimationFrame(this._raf);
    this._raf = requestAnimationFrame(() => this.drawSplines());
  }

  drawSplines() {
    const d3 = window.d3;
    const svg = this.querySelector(".flow-svg");
    const channel = this.querySelector(".flow-channel");
    if (!d3 || !svg || !channel || !this._flow) return;

    const cRect = channel.getBoundingClientRect();
    const w = cRect.width, h = cRect.height;
    if (w === 0) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);

    // measure a row's vertical center in channel-local coords
    const centerY = (col, id) => {
      const row = this.querySelector(`.flow-col--${col} .flow-row[data-id="${id}"]`);
      if (!row) return null;
      const r = row.getBoundingClientRect();
      return r.top + r.height / 2 - cRect.top;
    };

    const links = this._flow.links.map((l) => {
      const y1 = centerY("left", l.id);
      const y2 = centerY("right", l.id);
      if (y1 == null || y2 == null) return null;
      const color = this.state.data.restaurants[l.id]?.color || "#999";
      return { ...l, y1, y2, color };
    }).filter(Boolean);

    const path = (d) => {
      const cx = w / 2;
      return `M0,${d.y1} C${cx},${d.y1} ${cx},${d.y2} ${w},${d.y2}`;
    };

    // arrowhead markers (one per color would be ideal; instead we use
    // currentColor via a per-path marker is overkill — use two neutral
    // markers, right-pointing for 'fell', left-pointing for 'rose', tinted
    // to match each link via marker context isn't supported, so we color the
    // marker to the link by minting one marker per link id).
    let defs = svg.querySelector("defs");
    if (!defs) { defs = document.createElementNS(svg.namespaceURI, "defs"); svg.appendChild(defs); }
    d3.select(defs).selectAll("marker.flow-arrow")
      .data(links, (d) => d.id)
      .join((enter) => {
        const m = enter.append("marker")
          .attr("class", "flow-arrow")
          .attr("id", (d) => `arr-${d.id}`)
          .attr("viewBox", "0 0 8 8")
          .attr("refX", 6).attr("refY", 4)
          .attr("markerWidth", 6).attr("markerHeight", 6)
          .attr("orient", "auto-start-reverse");
        m.append("path").attr("d", "M0,0 L8,4 L0,8")
          .attr("fill", "none").attr("stroke-width", 1.5)
          .attr("stroke-linejoin", "round").attr("stroke-linecap", "round");
        return m;
      })
      .select("path").attr("stroke", (d) => d.color);

    const sel = d3.select(svg).selectAll("path.flow-link")
      .data(links, (d) => d.id);
    sel.join("path")
      .attr("class", (d) => "flow-link is-" + d.dir)
      .attr("data-id", (d) => d.id)
      .attr("fill", "none")
      .attr("stroke", (d) => d.color)
      // 'fell' flows left->right (arrow at end, into C); 'rose' flows the
      // other way, so we draw the marker at the start pointing back to B.
      .attr("marker-end", (d) => (d.dir === "fell" ? `url(#arr-${d.id})` : null))
      .attr("marker-start", (d) => (d.dir === "rose" ? `url(#arr-${d.id})` : null))
      .attr("d", path);

    this.applyHover();
  }

  applyHover() {
    const svg = this.querySelector(".flow-svg");
    const id = this.state.hovered;
    if (svg) {
      svg.classList.toggle("has-hover", !!id);
      svg.querySelectorAll("path.flow-link").forEach((p) => {
        p.classList.toggle("is-active", p.dataset.id === id);
      });
    }
    this.querySelectorAll(".flow-row").forEach((r) => {
      r.classList.toggle("is-active", !!id && r.dataset.id === id);
      r.classList.toggle("is-dimmed", !!id && r.dataset.id !== id && r.classList.contains("is-linked"));
    });
  }
}

customElements.define("tier-flow", TierFlow);
