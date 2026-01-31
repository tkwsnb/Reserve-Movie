import { parseHTML } from "linkedom";
import { Database } from "bun:sqlite";

const BASE_URL = "https://moviewalker.jp";
const USER_AGENT = "MovieReserveApp/1.0";
const GSI_API = "https://msearch.gsi.go.jp/address-search/AddressSearch";

const db = new Database("movie_reserve.sqlite");

// Prepare DB
db.run(`CREATE TABLE IF NOT EXISTS theaters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT UNIQUE NOT NULL,
  latitude REAL,
  longitude REAL
)`);

const insertStmt = db.prepare(`
    INSERT INTO theaters (name, url, latitude, longitude)
    VALUES ($name, $url, $lat, $lon)
    ON CONFLICT(url) DO UPDATE SET
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        name = excluded.name
`);

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url: string) {
    try {
        const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
        if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
        return await res.text();
    } catch (e) {
        console.error(e);
        return null;
    }
}

async function geocode(address: string): Promise<{ lat: number, lon: number } | null> {
    try {
        const url = `${GSI_API}?q=${encodeURIComponent(address)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json() as any[];
        if (data && data.length > 0 && data[0].geometry && data[0].geometry.coordinates) {
            const [lon, lat] = data[0].geometry.coordinates; // GeoJSON is [lon, lat]
            return { lat, lon };
        }
    } catch (e) {
        console.error(`Geocode error for ${address}:`, e);
    }
    return null;
}

async function run() {
    console.log("Starting nationwide theater population...");

    // 1. Get Prefectures
    const topHtml = await fetchHtml(`${BASE_URL}/theater/`);
    if (!topHtml) return;
    const { document: topDoc } = parseHTML(topHtml);

    // Find all links to /theater/xxx/ (avoid duplicates)
    // Heuristic: link text contains a count like （\d+）
    const prefLinks = Array.from(topDoc.querySelectorAll("a"))
        .filter(a => a.href.match(/\/theater\/[a-z]+\/$/) && a.textContent?.match(/（\d+）/))
        .map(a => ({
            name: a.textContent?.trim(),
            url: BASE_URL + a.getAttribute("href") // href might be relative or absolute
        }));

    console.log(`Found ${prefLinks.length} prefectures.`);

    // 2. Loop Prefectures
    console.log(`Processing ${prefLinks.length} prefectures.`);

    for (const pref of prefLinks) {
        console.log(`Processing ${pref.name}...`);

        await sleep(1500); // Polite delay
        const prefHtml = await fetchHtml(pref.url);
        if (!prefHtml) continue;
        const { document: prefDoc } = parseHTML(prefHtml);

        // Find all theater IDs in this prefecture page
        const allLinks = prefDoc.querySelectorAll("a"); // Use prefDoc
        const theaterIds = new Set<string>();

        Array.from(allLinks).forEach(a => {
            const href = a.href;
            if (!href) return;
            const match = href.match(/\/th(\d+)\//);
            if (match) {
                theaterIds.add(match[1]);
            }
        });

        console.log(`  Found ${theaterIds.size} unique theaters.`);

        for (const id of theaterIds) {
            const detailUrl = `${BASE_URL}/th${id}/schedule/`;

            // Deduplication check in DB (optimization)
            // But we have ON CONFLICT UPDATE, so just fetch.
            // Maybe check if exists? No, always update is better to ensure freshness.

            await sleep(1000); // Polite delay
            const detailHtml = await fetchHtml(detailUrl);
            if (!detailHtml) {
                console.log(`    Failed to fetch ${detailUrl}`);
                continue;
            }
            const { document: detailDoc } = parseHTML(detailHtml);

            // Extract Name and Address
            // Name: h1.el_lv1Heading
            // Address: li.un_theaderSchedule_address

            let name = detailDoc.querySelector("h1.el_lv1Heading")?.textContent?.trim();
            const address = detailDoc.querySelector("li.un_theaderSchedule_address")?.textContent?.trim();

            if (!name || !address) {
                console.log(`    Skipping th${id}: Name or Address not found.`);
                continue;
            }

            console.log(`    Processing ${name}...`);

            // Geocode
            // Check if lat/lon already exists in DB? 
            // For now, simple cache logic or just re-geocode.
            // GSI API limit is high enough for ~500 requests if spaced out.

            const coords = await geocode(address);

            insertStmt.run({
                $name: name,
                $url: detailUrl,
                $lat: coords ? coords.lat : null,
                $lon: coords ? coords.lon : null
            });

            if (coords) {
                console.log(`      -> Inserted/Updated: (${coords.lat}, ${coords.lon})`);
            } else {
                console.log(`      -> Inserted (No Coords)`);
            }
        }
    }

    console.log("Done!");
}

run();
