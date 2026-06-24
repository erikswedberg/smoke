// <bump-chart> — ranked top-10 standings across the five editions.
//
// THE D3 EXCEPTION (see ZELDMAN_CLIENT.md): D3 owns the SVG subtree; this
// component is only the BaseComponent shell (lifecycle, props, events).
// `this.template` stays null so the nunjucks->idiomorph render path is a
// no-op and never fights D3's own enter/update/exit.
//
// Layout: X = editions (years). Y = rank 1 (top) .. 10, plus an "off the
// top 10" gutter band below rank 10 where a line dips when a joint falls
// out of the ranked tier (and climbs back if it returns). Lines are each
// joint's brand color. ONE logo coin per line, placed at the last year the
// joint sat in the top 10 (risers climb into it; fallers drop away from it
// down a thin tail into the gutter). Hover isolates a line.

import BaseComponent from "../../lib/BaseComponent.js";
import { whenData } from "../store.js";
import { top10Restaurants, years } from "../data.js";

const RANKS = 10;

export default class BumpChart extends BaseComponent {
  constructor() {
    super();
    this.template = null;
    this.state = { data: null, highlightedId: null };
    this._ro = null;
  }

  static props = { "highlighted-id": String };

  onConnected() {
    // Pull the dataset from the ambient store (immutable, not a prop).
    whenData((data) => { this.state.data = data; this.draw(); });
    // Redraw on resize (debounced via rAF).
    this._ro = new ResizeObserver(() => {
      cancelAnimationFrame(this._raf);
      this._raf = requestAnimationFrame(() => this.draw());
    });
    this._ro.observe(this);
  }

  onDisconnected() { this._ro?.disconnect(); }

  // --- data shaping --------------------------------------------------------

  // Build per-joint trajectories. Each point has a year and a y-"slot":
  // ranks 1..10 map to slots 1..10; any year the joint was on a list but NOT
  // in the top 10 (top50/honorable) maps to the gutter slot. Years the joint
  // wasn't on any list are gaps (line breaks).
  trajectories(data) {
    const yrs = years(data);
    const joints = top10Restaurants(data); // [{id,name,color,logo,shortCode,history}]
    return joints.map((j) => {
      const byYear = new Map(j.history.map((h) => [h.year, h]));
      const points = [];
      for (const y of yrs) {
        const h = byYear.get(y);
        if (!h) { points.push(null); continue; } // not on any list -> gap
        if (h.tier === "top10") {
          // Known rank -> that slot. Unknown rank (2013 unranked top-4) ->
          // a placeholder slot so the point still sits in the ranked zone;
          // it's always marked uncertain (dashed/dimmed).
          const slot = h.rank ?? this._unknownSlot(data, y);
          points.push({ year: y, slot, gutter: false, band: null, uncertain: h.uncertain || h.rank == null, rank: h.rank });
        } else {
          // Below the top 10: route to the "11-50" or "honorable" band so the
          // line shows movement between the three lists.
          const band = h.tier === "honorable" ? "honorable" : "fifty";
          points.push({ year: y, slot: "gutter", gutter: true, band, uncertain: false, rank: null });
        }
      }
      // The coin sits at the joint's LAST year in the ranked top 10 — where
      // it belongs, at its peak. The line still tails on DOWN through the
      // 11-50 and 51-100 bands in later years, so the fall from grace shows
      // as a descending line even though the logo marks the high-water mark.
      let coinIdx = -1;
      for (let i = points.length - 1; i >= 0; i--) {
        if (points[i] && !points[i].gutter) { coinIdx = i; break; }
      }
      return { ...j, points, coinIdx };
    }).filter((t) => t.coinIdx !== -1);
  }

  // Placeholder Y slot for a top-tier joint whose exact rank that edition
  // wasn't published (2013 top-4). Use the midpoint of that edition's ranked
  // depth so the point reads as "high, but unknown."
  _unknownSlot(data, year) {
    const ed = data.editions.find((e) => e.year === year);
    const depth = ed?.rankedDepth || 10;
    return (depth + 1) / 2; // e.g. depth 4 -> slot 2.5
  }

  // --- draw ----------------------------------------------------------------

  draw() {
    const data = this.state.data;
    const d3 = window.d3;
    if (!data || !d3) return;

    const yrs = years(data);
    const trajs = this.trajectories(data);

    const width = this.clientWidth || 900;
    const M = { top: 32, right: 180, bottom: 30, left: 40 };
    const rowH = 44;                 // vertical space per rank
    const bandH = 80;                // each below-the-fold band
    const bandGap = 14;              // gap between the two bands
    const plotH = RANKS * rowH;
    // two stacked "below the top 10" bands: 11-50, then 51-100
    const fiftyTop = M.top + plotH + 12;
    const fiftyBot = fiftyTop + bandH;
    const hundredTop = fiftyBot + bandGap;
    const hundredBot = hundredTop + bandH;
    const height = hundredBot + M.bottom;

    const x = d3.scalePoint().domain(yrs).range([M.left, width - M.right]).padding(0.5);
    const yRank = (r) => M.top + (r - 0.5) * rowH;

    // jitter assigns each charted joint a stable lane within a band so the
    // many lines that share a band don't perfectly overlap.
    const jitter = new Map(trajs.map((t, i) => [t.id, i]));
    const laneY = (top, bot, id) => {
      const n = trajs.length || 1;
      const f = ((jitter.get(id) ?? 0) + 0.5) / n;
      return top + f * (bot - top);
    };
    // Route a point to its Y: ranked -> rank row; band 'fifty' -> 11-50 band;
    // band 'honorable' -> 51-100 band.
    const slotY = (p, id) => {
      if (!p.gutter) return yRank(p.slot);
      return p.band === "honorable"
        ? laneY(hundredTop, hundredBot, id)
        : laneY(fiftyTop, fiftyBot, id);
    };

    // (re)build the SVG root
    this.innerHTML = "";
    const root = d3.select(this).append("div").attr("class", "bump-chart-container");
    const svg = root.append("svg")
      .attr("class", "bump-svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", height)
      .attr("role", "img")
      .attr("aria-label", "Top 10 BBQ rankings across editions");

    // --- below-the-fold bands: 11-50 and 51-100 ---
    const bandX = M.left - 8;
    const bandW = width - M.right - M.left + 16;
    [[fiftyTop, fiftyBot, "11–50"], [hundredTop, hundredBot, "Honorable 51–100"]].forEach(([top, bot, label]) => {
      svg.append("rect")
        .attr("class", "bump-gutter")
        .attr("x", bandX).attr("y", top)
        .attr("width", bandW).attr("height", bot - top)
        .attr("rx", 4);
      svg.append("text")
        .attr("class", "bump-gutter-label")
        .attr("x", M.left).attr("y", top + 12)
        .text(label);
    });

    // --- gridlines + rank labels ---
    const grid = svg.append("g").attr("class", "bump-grid");
    d3.range(1, RANKS + 1).forEach((r) => {
      grid.append("line")
        .attr("x1", M.left).attr("x2", width - M.right)
        .attr("y1", yRank(r)).attr("y2", yRank(r));
      grid.append("text")
        .attr("class", "bump-rank-label")
        .attr("x", M.left - 10).attr("y", yRank(r)).attr("dy", "0.32em")
        .text(r);
    });

    // --- year (column) labels ---
    const cols = svg.append("g").attr("class", "bump-cols");
    yrs.forEach((y) => {
      cols.append("text")
        .attr("class", "bump-year-label")
        .attr("x", x(y)).attr("y", M.top - 12)
        .text(y);
    });

    // --- lines ---
    const lineFor = (id) => d3.line()
      .x((p) => x(p.year))
      .y((p) => slotY(p, id))
      .curve(d3.curveMonotoneX);

    const seriesG = svg.append("g").attr("class", "bump-series");

    const series = seriesG.selectAll("g.bump-line")
      .data(trajs, (t) => t.id)
      .join("g")
      .attr("class", "bump-line")
      .attr("data-id", (t) => t.id);

    // split each trajectory into contiguous (non-null) segments so gaps break
    series.each(function (t) {
      const g = d3.select(this);
      const segs = [];
      let cur = [];
      t.points.forEach((p) => {
        if (p) cur.push(p);
        else if (cur.length) { segs.push(cur); cur = []; }
      });
      if (cur.length) segs.push(cur);

      const line = lineFor(t.id);
      g.selectAll("path.seg")
        .data(segs)
        .join("path")
        .attr("class", "seg")
        .attr("fill", "none")
        .attr("stroke", t.color)
        .attr("d", (s) => line(s));

      // dashed overlay on uncertain points' incoming segment edges:
      // mark whole line dashed if ALL ranked points are uncertain (2008/2013).
      const ranked = t.points.filter((p) => p && !p.gutter);
      const allUncertain = ranked.length && ranked.every((p) => p.uncertain);
      if (allUncertain) g.classed("is-uncertain", true);

      // node dots at each real point
      g.selectAll("circle.node")
        .data(t.points.filter(Boolean))
        .join("circle")
        .attr("class", (p) => "node" + (p.gutter ? " is-gutter" : "") + (p.uncertain ? " is-uncertain" : ""))
        .attr("cx", (p) => x(p.year))
        .attr("cy", (p) => slotY(p, t.id))
        .attr("r", 3)
        .attr("fill", t.color);
    });

    // --- coins (one per line, at last top-10 year) ---
    const R = 16;
    const coins = series.append("g")
      .attr("class", "bump-coin")
      .attr("transform", (t) => {
        const p = t.points[t.coinIdx];
        return `translate(${x(p.year)},${slotY(p, t.id)})`;
      });

    // Each coin: an outer <g> positions it (translate); an inner <g.coin-scale>
    // holds the visuals so CSS can scale it on hover (clip, bg, logo, ring all
    // grow together). clip-path is in the inner group's local coords, so the
    // clipped logo scales with it.
    const defs = svg.append("defs");
    coins.each(function (t) {
      const id = `clip-${t.id}`;
      defs.append("clipPath").attr("id", id)
        .append("circle").attr("r", R);
      const scale = d3.select(this).append("g").attr("class", "coin-scale");
      scale.append("circle").attr("class", "coin-bg").attr("r", R).attr("fill", t.color);
      if (t.logo) {
        scale.append("image")
          .attr("href", "/" + t.logo)
          .attr("x", -R).attr("y", -R).attr("width", 2 * R).attr("height", 2 * R)
          .attr("preserveAspectRatio", "xMidYMid slice")
          .attr("clip-path", `url(#${id})`);
      } else {
        scale.append("text").attr("class", "coin-code")
          .attr("dy", "0.34em").text(t.shortCode);
      }
      scale.append("circle").attr("class", "coin-ring").attr("r", R).attr("fill", "none");
    });

    // --- name tags: one per line, beside its coin ---
    // Final-year coins (right edge) label to the right. Mid-chart coins,
    // i.e. joints that fell out of the top 10, label to the LEFT of the coin
    // so the tag doesn't collide with the line continuing down to the gutter.
    const lastIdx = yrs.length - 1;
    series.append("text")
      .attr("class", (t) => "bump-name" + (t.coinIdx === lastIdx ? " is-final" : " is-fallen"))
      .attr("x", (t) => {
        const p = t.points[t.coinIdx];
        return t.coinIdx === lastIdx ? x(p.year) + R + 8 : x(p.year) - R - 8;
      })
      .attr("y", (t) => slotY(t.points[t.coinIdx], t.id))
      .attr("dy", "0.32em")
      .attr("text-anchor", (t) => (t.coinIdx === lastIdx ? "start" : "end"))
      .text((t) => t.name);

    // --- interaction: hover isolates ---
    // Track at the SVG level rather than per-line enter/leave: moving onto a
    // line (path/coin/dot) highlights it; moving to empty space or off the
    // chart clears it. This avoids the "sticky hover" you get from per-element
    // enter/leave when the coin scales up and the active line is re-parented.
    svg
      .on("pointermove", (e) => {
        const el = e.target.closest(".bump-line");
        this.highlight(el ? el.__data__.id : null);
      })
      .on("pointerleave", () => this.highlight(null));

    this._svg = svg;
    this.applyHighlight();
  }

  highlight(id) {
    if (this.state.highlightedId === id) return; // no-op on re-entry
    this.state.highlightedId = id;
    this.applyHighlight();
    this.emit("joint-hover", { id });
  }

  applyHighlight() {
    if (!this._svg) return;
    const id = this.state.highlightedId;
    this._svg.classed("has-highlight", !!id);
    this._svg.selectAll("g.bump-line")
      .classed("is-active", (t) => id && t.id === id)
      .classed("is-dimmed", (t) => id && t.id !== id);
    // Raise the active line (and its enlarged coin) above the others —
    // SVG paint order is DOM order, so move it to the end of its group.
    if (id) {
      this._svg.selectAll("g.bump-line").filter((t) => t.id === id)
        .each(function () { this.parentNode.appendChild(this); });
    }
  }

  attributeChangedCallback(name) {
    if (name === "highlighted-id") {
      this.state.highlightedId = this.getAttribute("highlighted-id") || null;
      this.applyHighlight();
    }
  }
}

customElements.define("bump-chart", BumpChart);
