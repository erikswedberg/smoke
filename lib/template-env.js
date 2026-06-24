// Client-only Nunjucks environment for the Zeldman component system.
//
// One nunjucks Environment, shared by every BaseComponent via
// window.Smoke.templateEnv. Templates live under /templates and are
// fetched over HTTP by the WebLoader on first use (then cached).
//
// No server, no precompile, no build step. Same templates a component
// renders on connect are plain .html files you can open and read.

const TEMPLATE_BASE = "/templates";

const env = new nunjucks.Environment(
    new nunjucks.WebLoader(TEMPLATE_BASE, {
        useCache: true,
        async: false,
    }),
    {
        autoescape: true,
        trimBlocks: true,
        lstripBlocks: true,
    }
);

// A couple of small, generally useful filters. Keep this list short —
// most logic belongs in getTemplateContext(), not in templates.
env.addFilter("json", (value, indent = 0) => JSON.stringify(value, null, indent));

window.Smoke = window.Smoke || {};
window.Smoke.templateEnv = env;

export { env };
