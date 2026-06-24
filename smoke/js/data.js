// Data layer for the Texas Monthly BBQ bump chart.
//
// Loads data/rankings.json once and exposes small, predictable query
// helpers. Following the Zeldman principle: shape data here so components
// consume flat, ready-to-render fields and never walk the raw JSON.

let _cache = null;

/** Load and cache the normalized rankings data. */
export async function loadData() {
    if (_cache) return _cache;
    const res = await fetch("/data/rankings.json");
    if (!res.ok) throw new Error(`Failed to load rankings.json: ${res.status}`);
    _cache = await res.json();
    return _cache;
}

/** All editions, ascending by year. */
export function editions(data) {
    return [...data.editions].sort((a, b) => a.year - b.year);
}

/** Just the list of years, ascending. */
export function years(data) {
    return editions(data).map((e) => e.year);
}

/** Look up a restaurant record by id, with the id folded in. */
export function restaurant(data, id) {
    const r = data.restaurants[id];
    return r ? { id, ...r } : null;
}

/**
 * One restaurant's full ranking history, ascending by year.
 * Each entry: { year, rank?, tier, uncertain? }.
 */
export function historyOf(data, id) {
    return data.rankings
        .filter((r) => r.id === id)
        .map((r) => ({ year: r.year, rank: r.rank ?? null, tier: r.tier, uncertain: !!r.uncertain }))
        .sort((a, b) => a.year - b.year);
}

/**
 * Snapshot of a single edition: every restaurant that appeared that year,
 * merged with its restaurant record. Sorted with ranked top10 first (by
 * rank), then unranked entries alphabetically by name.
 */
export function snapshot(data, year) {
    return data.rankings
        .filter((r) => r.year === year)
        .map((r) => ({ ...restaurant(data, r.id), rank: r.rank ?? null, tier: r.tier, uncertain: !!r.uncertain }))
        .sort((a, b) => {
            if (a.rank && b.rank) return a.rank - b.rank;
            if (a.rank) return -1;
            if (b.rank) return 1;
            return a.name.localeCompare(b.name);
        });
}

/**
 * The set of restaurants that have ever appeared in a ranked top 10,
 * each with its full cross-edition history. These are the lines the bump
 * chart draws. Returns [{ ...restaurant, history: [...] }].
 */
export function top10Restaurants(data) {
    const ids = new Set(
        data.rankings.filter((r) => r.tier === "top10").map((r) => r.id)
    );
    return [...ids]
        .map((id) => ({ ...restaurant(data, id), history: historyOf(data, id) }))
        .sort((a, b) => a.name.localeCompare(b.name));
}
