/**
 * Convert a kebab-case string to camelCase.
 * 'has-more' -> 'hasMore', 'short-code' -> 'shortCode'.
 * Inlined (no external deps) for the client-only Zeldman build.
 */
function kebabToCamel(str) {
    return str.replace(/-(.)/g, (_, c) => c.toUpperCase());
}

/**
 * BaseComponent - State-driven rendering with DOM diffing.
 *
 * Props flow via attributes (parent → child)
 * Events flow via CustomEvents (child → parent)
 * State is internal to each component
 *
 * Lifecycle:
 *   1. connectedCallback: hydrate from JSON, sync props from attributes, render
 *   2. attributeChangedCallback: sync props, re-render if changed
 *   3. setState: update internal state, re-render
 *   4. render: nunjucks template → idiomorph diff → DOM
 *
 * Props API:
 *   static props = {
 *       'items':    Array,
 *       'loading':  Boolean,
 *       'disabled': Boolean,
 *       'value':    String,
 *       'offset':   Number,
 *   };
 *
 *   Type tags:
 *     Boolean → presence-of-attribute (HTML rule). Absent = false.
 *     String  → attribute value, or state default if absent. Empty 'attr=""' is preserved.
 *     Number  → Number(value), or state default if absent or NaN.
 *     Array   → JSON.parse(value), or state default if absent or unparseable.
 *     Object  → JSON.parse(value), or state default if absent or unparseable.
 *
 * Kebab attribute names auto-convert to camelCase state keys:
 *   'has-more' → hasMore
 */
export default class BaseComponent extends HTMLElement {
    constructor() {
        super();
        this.state = {};
        this.template = '';
        this._connected = false;
        this._pendingPropsSync = false;
    }

    /**
     * Declare props to auto-observe and auto-parse from attributes.
     *   static props = { 'items': Array, 'loading': Boolean, ... }
     */
    static props = {};

    /**
     * Auto-generate observedAttributes from static props.
     */
    static get observedAttributes() {
        return Object.keys(this.props || {});
    }

    /**
     * Auto-parse props from attributes based on static props array.
     * Subclasses can override for custom parsing (call super first).
     *
     * Absent attributes fall back to the value captured as the initial
     * state default in connectedCallback. This lets attribute removal
     * (e.g. {{ 'loading' | bool(false) }} emits nothing) restore state
     * to its declared default, instead of silently persisting stale values.
     */
    getPropsFromAttributes() {
        const result = {};
        const defaults = this._propDefaults || {};
        const propsDecl = this.constructor.props || {};

        for (const [name, type] of Object.entries(propsDecl)) {
            const key = kebabToCamel(name);
            const hasAttr = this.hasAttribute(name);
            const value = hasAttr ? this.getAttribute(name) : null;
            const defaultVal = defaults[key];

            if (type === Boolean) {
                // HTML boolean rule: presence-of-attribute = true, absence
                // = false. Value is irrelevant. Templates toggling a
                // boolean for falsy state must emit no attribute at all
                // — use {{ 'disabled' if disabled }} (the preprocessor
                // handles bare expressions between attributes), never
                // disabled="{{ disabled }}".
                result[key] = hasAttr;
            } else if (type === String) {
                result[key] = hasAttr ? value : defaultVal;
            } else if (type === Number) {
                if (!hasAttr) { result[key] = defaultVal; continue; }
                const n = Number(value);
                result[key] = Number.isFinite(n) ? n : defaultVal;
            } else if (type === Array || type === Object) {
                if (!hasAttr) { result[key] = defaultVal; continue; }
                try { result[key] = JSON.parse(value); }
                catch { result[key] = defaultVal; }
            } else {
                // Unknown type tag — treat as String.
                result[key] = hasAttr ? value : defaultVal;
            }
        }
        return result;
    }

    attributeChangedCallback(name, oldVal, newVal) {
        if (!this._connected) return;
        if (oldVal === newVal) return;

        // Batch multiple attribute changes into single sync
        if (!this._pendingPropsSync) {
            this._pendingPropsSync = true;
            queueMicrotask(() => {
                this._pendingPropsSync = false;
                this.syncPropsFromAttributes();
            });
        }
    }

    syncPropsFromAttributes() {
        const newProps = this.getPropsFromAttributes();
        let changed = false;

        for (const [key, val] of Object.entries(newProps)) {
            if (this.state[key] !== val) {
                this.state[key] = val;
                changed = true;
            }
        }

        if (changed) {
            this.render();
        }
    }

    setState(newState) {
        this.state = { ...this.state, ...newState };
        this.render();
    }

    render() {
        if (!this.template) return;

        const env = window.Smoke?.templateEnv;
        if (!env) return;

        const context = { ...this.state, ...this.getTemplateContext?.() };
        let html = env.render(this.template, context);

        // If template outputs wrapped in component's own tag, extract innerHTML
        const tagName = this.tagName.toLowerCase();
        const wrapperRegex = new RegExp(`^\\s*<${tagName}[^>]*>([\\s\\S]*)</${tagName}>\\s*$`, 'i');
        const match = html.match(wrapperRegex);
        if (match) {
            html = match[1];
        }

        // Preserve child custom elements' innerHTML
        // Parent template doesn't have child's internal state (open, selectedIndex, etc.)
        // Without this, idiomorph would reset children to parent's stale view
        // Children re-render themselves via attributeChangedCallback with new props
        const temp = document.createElement('template');
        temp.innerHTML = html;
        temp.content.querySelectorAll('*').forEach(newEl => {
            if (newEl.tagName.includes('-')) {
                const oldEl = this.querySelector(this._buildChildSelector(newEl));
                if (oldEl) {
                    newEl.innerHTML = oldEl.innerHTML;
                }
            }
        });

        Idiomorph.morph(this, temp.innerHTML, { morphStyle: 'innerHTML' });
        this.afterRender();
    }

    _buildChildSelector(el) {
        let selector = el.tagName.toLowerCase();
        const role = el.getAttribute('data-role');
        if (role) {
            selector += `[data-role="${role}"]`;
        }
        const filterName = el.getAttribute('data-filter-name');
        if (filterName) {
            selector += `[data-filter-name="${filterName}"]`;
        }
        // Disambiguate multiple same-role children (e.g. every breadcrumb crumb
        // is data-role="siblings"); without this they all match the first one
        // and get its innerHTML copied during re-render.
        const taxonId = el.getAttribute('data-taxon-id');
        if (taxonId) {
            selector += `[data-taxon-id="${taxonId}"]`;
        }
        return selector;
    }

    connectedCallback() {
        this._connected = true;
        // Snapshot initial state values for declared props, to use as
        // fallback when an attribute is absent during a later sync.
        if (!this._propDefaults) {
            this._propDefaults = {};
            for (const name of Object.keys(this.constructor.props || {})) {
                const key = kebabToCamel(name);
                this._propDefaults[key] = this.state[key];
            }
        }
        // Order matters: hydrate first so SSR JSON populates state, then
        // overlay props from attributes (live config wins over snapshot),
        // then render once. Calling syncPropsFromAttributes() before
        // hydrate would render with empty state, which can wipe inline
        // <script type="application/json"> blocks living inside
        // state-conditional template branches (e.g. <taxonomy-tree>).
        this.hydrate();
        Object.assign(this.state, this.getPropsFromAttributes());
        this.render();
        this.onConnected?.();
    }

    hydrate() {
        const script = this.querySelector(':scope > script[type="application/json"]');
        if (!script) return false;

        try {
            const data = JSON.parse(script.textContent);
            this.state = { ...this.state, ...data };
        } catch (e) {
            console.error(`${this.constructor.name}: hydrate failed`, e);
        }
        script.remove();
        return true;
    }

    disconnectedCallback() {
        this._connected = false;
        this.onDisconnected?.();
    }

    emit(name, detail) {
        this.dispatchEvent(new CustomEvent(name, { detail, bubbles: true, composed: true }));
    }

    // Hooks for subclasses
    getTemplateContext() { return {}; }
    afterRender() {}
    onConnected() {}
    onDisconnected() {}
}
