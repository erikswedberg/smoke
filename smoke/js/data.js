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

// Approximate TX city populations for ordering the tier grid (spec: cities
// by population descending). Joints in unlisted towns sort after these,
// alphabetically. Only a ranking is needed, not exact figures.
const CITY_POP = {
    "Houston": 2300000, "San Antonio": 1470000, "Dallas": 1300000,
    "Austin": 970000, "Fort Worth": 960000, "El Paso": 680000,
    "Arlington": 395000, "Corpus Christi": 320000, "Plano": 290000,
    "Lubbock": 260000, "Garland": 245000, "Irving": 240000,
    "Amarillo": 200000, "Grand Prairie": 195000, "McKinney": 195000,
    "Brownsville": 190000, "Pasadena": 150000, "Mesquite": 145000,
    "Killeen": 155000, "Waco": 140000, "Pearland": 125000,
    "Beaumont": 115000, "Bellaire": 17000, "Spring": 62000,
    "Pflugerville": 65000, "Katy": 22000, "Tyler": 105000,
    "Longview": 82000, "Bryan": 85000, "College Station": 120000,
    "Cedar Hill": 48000, "Farmers Branch": 36000, "North Richland Hills": 70000,
    "DeSoto": 56000, "Mission": 85000, "Pharr": 80000, "Harlingen": 71000,
    "Weslaco": 41000, "San Marcos": 67000, "Temple": 82000, "Belton": 23000,
    "Sulphur Springs": 16000, "Royse City": 16000, "Seguin": 30000,
    "Port Lavaca": 12000, "Port Neches": 13000, "San Juan": 36000,
    "Aledo": 5000, "Wolfforth": 6000, "Lexington": 1200, "Taylor": 17000,
    "Tomball": 12000, "Brenham": 17000, "Crockett": 6000, "Decatur": 7000,
};

function cityRank(name) {
    return CITY_POP[name] ?? -1; // unknown towns sort to the bottom
}

/**
 * All joints in a tier ("top50" or "honorable"), grouped by city.
 * Cities ordered by population descending, then alphabetically; within a
 * city, joints alphabetical. Each joint carries the list of years it sat in
 * that tier. Returns [{ name, joints: [{ ...restaurant, years: [..] }] }].
 */
export function tierByCity(data, tier, activeYears = null) {
    const perJoint = new Map(); // id -> { years:Set }
    for (const r of data.rankings) {
        if (r.tier !== tier) continue;
        if (activeYears && !activeYears.has(r.year)) continue;
        if (!perJoint.has(r.id)) perJoint.set(r.id, new Set());
        perJoint.get(r.id).add(r.year);
    }

    const byCity = new Map(); // city -> joints[]
    for (const [id, yearSet] of perJoint) {
        const rec = restaurant(data, id);
        if (!rec) continue;
        const joint = { ...rec, years: [...yearSet].sort((a, b) => a - b) };
        if (!byCity.has(rec.city)) byCity.set(rec.city, []);
        byCity.get(rec.city).push(joint);
    }

    return [...byCity.entries()]
        .map(([name, joints]) => ({
            name,
            joints: joints.sort((a, b) => a.name.localeCompare(b.name)),
        }))
        .sort((a, b) => cityRank(b.name) - cityRank(a.name) || a.name.localeCompare(b.name));
}

/**
 * Flow between two tiers (e.g. "top50" -> "honorable"): the joints in each
 * tier and the links for joints that appear in BOTH across editions (i.e.
 * crossed between the two lists over time). Used by <tier-flow>.
 *
 * Within a single edition the two tiers are disjoint, so links only exist
 * when multiple years are in play. `activeYears` (a Set or null) filters which
 * editions count.
 *
 * Returns { left:[joint...], right:[joint...], links:[{id,dir}] } where dir is
 * "fell" (was in tierA earlier, tierB later) or "rose" (the reverse). Columns
 * are ordered to keep linked joints near the same height (light de-tangling):
 * linked joints first (right column follows left's order), then the rest.
 */
export function tierFlow(data, tierA, tierB, activeYears = null) {
    const inYears = (y) => !activeYears || activeYears.has(y);

    const collect = (tier) => {
        const m = new Map(); // id -> Set(years)
        for (const r of data.rankings) {
            if (r.tier !== tier || !inYears(r.year)) continue;
            if (!m.has(r.id)) m.set(r.id, new Set());
            m.get(r.id).add(r.year);
        }
        return m;
    };
    const A = collect(tierA);
    const B = collect(tierB);

    const joint = (id, yearSet) => ({
        ...restaurant(data, id),
        years: [...yearSet].sort((a, b) => a - b),
    });

    // links: joints present in both columns. Direction reflects the MOST
    // RECENT crossing between the two lists: build the joint's tierA/tierB
    // timeline and look at the last A->B or B->A step. (Earliest-year logic
    // would mislabel joints like Stiles Switch that bounced both ways.)
    const links = [];
    for (const id of A.keys()) {
        if (!B.has(id)) continue;
        // merge this joint's appearances in the two tiers, in time order
        const seq = [];
        for (const y of A.get(id)) seq.push({ y, t: "A" });
        for (const y of B.get(id)) seq.push({ y, t: "B" });
        seq.sort((a, b) => a.y - b.y);
        // find the last step where the tier changed
        let dir = "fell";
        for (let i = seq.length - 1; i > 0; i--) {
            if (seq[i].t !== seq[i - 1].t) {
                dir = seq[i - 1].t === "A" ? "fell" : "rose"; // A->B fell, B->A rose
                break;
            }
        }
        links.push({ id, dir });
    }
    const linkedIds = new Set(links.map((l) => l.id));

    const byName = (a, b) => a.name.localeCompare(b.name);
    // "rose" links (climbed back up) sort to the very top so the rare escapees
    // lead the list; then "fell", each alphabetical within its group.
    const dirOf = new Map(links.map((l) => [l.id, l.dir]));
    const byDirThenName = (a, b) => {
        const da = dirOf.get(a.id) === "rose" ? 0 : 1;
        const db = dirOf.get(b.id) === "rose" ? 0 : 1;
        return da - db || byName(a, b);
    };
    const linkedFirst = (m) => {
        const all = [...m.keys()].map((id) => joint(id, m.get(id)));
        const linked = all.filter((j) => linkedIds.has(j.id)).sort(byDirThenName);
        const rest = all.filter((j) => !linkedIds.has(j.id)).sort(byName);
        return { linked, rest };
    };

    const L = linkedFirst(A);
    const R = linkedFirst(B);
    // right column: linked joints in the SAME order as the left column so the
    // connector lines run roughly parallel; then the unlinked remainder.
    const leftOrder = L.linked.map((j) => j.id);
    R.linked.sort((a, b) => leftOrder.indexOf(a.id) - leftOrder.indexOf(b.id));

    return {
        left: [...L.linked, ...L.rest],
        right: [...R.linked, ...R.rest],
        links,
    };
}
