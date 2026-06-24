# Zeldman (Client-Only)

The "frameworkless framework" from Flora, stripped to its client-side core for
this project. No server, no build step, no preprocessor. You can open every file
and read exactly what a tag does.

This doc is the whole convention. If you need to know more than what's here,
something has gone wrong.

---

## The Stack

Four small pieces in `lib/`:

| Piece | What | Size |
|-------|------|------|
| **Web Components** | platform primitive — a tag is a class | native |
| **Nunjucks** (`nunjucks.min.js`) | HTML templating, runs in the browser | ~90KB |
| **Idiomorph** (`idiomorph.min.js`) | surgical DOM diffing (htmx team) | ~8KB |
| **BaseComponent** (`BaseComponent.js`) | ~230 lines of glue | tiny |
| **template-env** (`template-env.js`) | the one shared Nunjucks environment | ~30 lines |

**Data flow:** props **down** (HTML attributes), events **up** (CustomEvent),
state **local** (each component owns its own).

### What we dropped from Flora's version

Flora runs the *same* Nunjucks templates on a Fastify server AND in the browser.
That dual life is the source of most of its complexity: a component-loader
preprocessor that parses attributes, SSR/CSR kebab-camel symmetry, JSON
hydration to reconcile server HTML with client re-renders, content-only template
wrappers, a registry. **We are client-only, so all of that is gone.**

- No `component-loader.js` preprocessor / attribute parser.
- No `component-registry.js`. `customElements.define()` IS the registry.
- No SSR. The page ships an empty shell; components build their own DOM.
- JSON hydration (`<script type="application/json">`) still exists in
  BaseComponent and works, but you rarely need it — data comes from `fetch`,
  not from server-rendered HTML. DOM is not your source of truth here; your
  loaded data is.

---

## The Three Rules

1. **Templates are HTML with light Nunjucks.** `{{ var }}` and
   `{% if %}…{% endif %}` / `{% for %}`. Nothing else. No special syntax between
   attributes (that was an SSR-preprocessor thing we deleted).

2. **A component is a tag → template + JS class.** Define it with
   `customElements.define('bump-chart', BumpChart)`. The JS class extends
   `BaseComponent`, points `this.template` at a `.html` file, and declares
   `static props = { name: Type }`. Templates render *content only* (see Inner
   Container, below).

3. **State lives in the component.** Set it in the constructor, change it with
   `setState()`. Every visual change goes state → template → idiomorph. There is
   one render path. No manual DOM poking after render.

---

## Anatomy of a Component

A component is up to three files that share a hyphenated name:

```
templates/tier-list.html     ← Nunjucks template (content only)
css/tier-list.css            ← styles (namespaced, see below)
js/components/tier-list.js    ← behavior (extends BaseComponent)
```

### The JS class

```js
import BaseComponent from "../../lib/BaseComponent.js";

export default class TierList extends BaseComponent {
    constructor() {
        super();
        this.template = "tier-list.html";   // path under /templates
        this.state = {
            restaurants: [],
            highlightedId: null,
        };
    }

    static props = {
        "restaurants":    Array,
        "highlighted-id": String,   // becomes state.highlightedId
    };

    // Optional: shape state into template variables.
    getTemplateContext() {
        return {
            byCity: groupByCity(this.state.restaurants),
            highlightedId: this.state.highlightedId,
        };
    }

    // Wire events ONCE, here. Use delegation. Never in afterRender().
    connectedCallback() {
        super.connectedCallback();
        this.addEventListener("pointerover", (e) => {
            const el = e.target.closest("[data-id]");
            if (el) this.emit("restaurant-hover", { id: el.dataset.id });
        });
    }
}

customElements.define("tier-list", TierList);
```

### The template (content only)

```html
{% for city in byCity %}
<section class="tier-list-city">
  <h3>{{ city.name }}</h3>
  {% for r in city.restaurants %}
  <span class="tier-chip{% if r.id == highlightedId %} active{% endif %}"
        data-id="{{ r.id }}" style="--chip: {{ r.color }}">
    {{ r.shortCode }}
  </span>
  {% endfor %}
</section>
{% endfor %}
```

Note: the template does NOT wrap itself in `<tier-list>`. BaseComponent renders
into the element's innerHTML. (If a template *does* emit its own wrapper tag,
BaseComponent strips it — but just don't.)

---

## Props (parent → child)

Declare props as `name: Type`. BaseComponent auto-generates
`observedAttributes`, parses the attribute into the right JS type, converts
kebab→camel for the state key, and re-renders on change.

| Type | Attribute behavior |
|------|--------------------|
| `Boolean` | **presence** = true. `<x foo>` → true, absent → false. Value ignored. |
| `String`  | the attribute value, or the constructor default if absent. |
| `Number`  | `Number(value)`, or default if absent/NaN. |
| `Array`   | `JSON.parse(value)`, or default if absent/unparseable. |
| `Object`  | `JSON.parse(value)`, or default if absent/unparseable. |

**Boolean footgun:** because presence = true, never write
`disabled="{{ x }}"` — `disabled="false"` still disables. In a *client-only*
template you control the tag in JS, so prefer toggling the attribute from the
parent component: `child.toggleAttribute('disabled', !!x)`, or omit it. (Flora
solved this in templates with a preprocessor we removed.)

**Arrays/objects as attributes** are JSON strings:
```html
<bump-chart rankings="{{ rankings | json }}"></bump-chart>
```
For large data, prefer setting a JS property directly
(`chart.state.rankings = data; chart.render()`) or fetching inside the child —
don't stuff 60KB into an attribute.

To add derived props, override and call super first:
```js
getPropsFromAttributes() {
    const props = super.getPropsFromAttributes();
    props.open = props.items?.length > 0;
    return props;
}
```

---

## Events (child → parent)

```js
// child emits
this.emit("restaurant-hover", { id });   // CustomEvent, bubbles + composed

// parent listens (delegated, set up in connectedCallback)
this.addEventListener("restaurant-hover", (e) => {
    this.setState({ highlightedId: e.detail.id });
});
```

Never call methods on a child to push data in, never read a child's DOM.
Attributes in, events out. That's the whole contract.

---

## The Render Path (one path, always)

```
setState({ highlightedId: "snows-bbq" })
   → getTemplateContext()                 // shape state → template vars
   → nunjucks.render(this.template, ctx)   // HTML string
   → strip self-wrapper tag if present
   → preserve child custom-element innerHTML  // children re-render themselves
   → Idiomorph.morph(this, html, innerHTML)   // surgical diff
   → afterRender()
```

Idiomorph morphs **innerHTML**, not the element itself, so listeners attached to
the component survive. Child custom elements are left alone (their innerHTML is
copied forward before morphing) — they re-render from their own changed
attributes. Parents can't clobber children's state.

---

## Inner Container Pattern

State-driven classes go on an inner `{name}-container` div, NOT on hypothetical
wrapper tags. CSS targets `tag .container`, not `tag.container`:

```html
<div class="bump-chart-container{% if loading %} is-loading{% endif %}">
  ...
</div>
```
```css
bump-chart .bump-chart-container { ... }
bump-chart .bump-chart-container.is-loading { opacity: .5; }
```

---

## CSS Namespacing

Only prefix **ambiguous** root classes (e.g. `.smoke-header`). Unique components
(`.bump-chart-container`, `.tier-chip`) don't need a prefix. Child elements are
naturally scoped: `.bump-chart-container .axis-label`. All CSS in `.css` files,
never inline, never set via JS style manipulation — toggle classes, let CSS do
the rest.

---

## The D3 Exception (important for this project)

The bump chart is **D3/SVG-driven**. D3's enter/update/exit *is* its own diffing
engine, and idiomorph morphing an SVG subtree that D3 also mutates will fight.

So `<bump-chart>` uses BaseComponent only for the **shell**: lifecycle, props
(data + `highlighted-id`), state, and `emit()`. It does **not** route its SVG
through the nunjucks→idiomorph path. Let D3 own everything under the `<svg>`:

```js
class BumpChart extends BaseComponent {
    constructor() {
        super();
        this.template = null;          // no nunjucks render — D3 owns the DOM
        this.state = { rankings: [], highlightedId: null };
    }
    static props = { "highlighted-id": String };

    onConnected() { this.draw(); }      // build the svg with d3 once
    afterRender() {}                    // never called (template is null)

    // React to highlight changes without re-running render()
    attributeChangedCallback(name, oldV, newV) {
        if (name === "highlighted-id") this.highlight(newV);
    }

    draw()      { /* d3.select(this).append('svg')… */ }
    highlight() { /* d3 transitions on existing selection */ }
}
```

Template-driven components (`<tier-list>`, `<restaurant-card>`) use the normal
nunjucks→idiomorph path. SVG-driven ones opt out by leaving `this.template`
null and driving D3 directly. Both still speak the same props-down/events-up
contract, so the rest of the app doesn't care which kind a component is.

---

## Bootstrapping (index.html)

Load the globals first (plain scripts), then the module that wires everything:

```html
<!-- globals: define `nunjucks` and `Idiomorph` -->
<script src="/lib/nunjucks.min.js"></script>
<script src="/lib/idiomorph.min.js"></script>
<!-- d3 for the bump chart -->
<script src="https://cdn.jsdelivr.net/npm/d3@7"></script>

<!-- the shared template env (sets window.Smoke.templateEnv) -->
<script type="module" src="/lib/template-env.js"></script>
<!-- app entry: imports/defines all components -->
<script type="module" src="/js/app.js"></script>
```

`app.js` imports each component module (each calls `customElements.define`),
fetches `data/rankings.json`, and hands data down to the top-level components.

---

## Quick Reference

```
Define a component:  customElements.define('tier-list', TierList)
Template:            content only, HTML + {{ }} / {% %}; lives in /templates
Props:               static props = { 'restaurants': Array, 'highlighted-id': String }
Update state:        this.setState({ highlightedId: id })
Shape template vars: getTemplateContext() { return {...} }
Emit up:             this.emit('restaurant-hover', { id })
Listen (delegated):  addEventListener in connectedCallback, NOT afterRender
State classes:       on .{name}-container, CSS uses `tag .container`
D3 components:        this.template = null; let D3 own the SVG subtree
```
