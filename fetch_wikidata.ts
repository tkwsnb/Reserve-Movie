import { Database } from "bun:sqlite";

const db = new Database("movie_reserve.sqlite");

const query = `
SELECT DISTINCT ?item ?itemLabel ?lat ?lon WHERE {
  { ?item wdt:P31/wdt:P279* wd:Q41298 } UNION { ?item wdt:P31/wdt:P279* wd:Q285659 } .
  ?item wdt:P17 wd:Q17 .
  ?item p:P625 ?coordinate .
  ?coordinate psv:P625 ?coordinate_node .
  ?coordinate_node wikibase:geoLatitude ?lat .
  ?coordinate_node wikibase:geoLongitude ?lon .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ja,en". }
}
LIMIT 1000
`;

const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`;

console.log("Fetching from Wikidata...");

try {
    const res = await fetch(url, { headers: { "User-Agent": "MovieReserveApp/1.0" } });
    if (!res.ok) throw new Error(res.statusText);
    const data = await res.json();
    const results = data.results.bindings;

    console.log(`Found ${results.length} theaters from Wikidata.`);

    const insert = db.prepare(`
        INSERT OR IGNORE INTO theaters (name, url, latitude, longitude)
        VALUES ($name, $url, $lat, $lon)
    `);

    let count = 0;
    db.transaction(() => {
        for (const r of results) {
            const name = r.itemLabel.value;
            const link = r.item.value; // Wikidata URL as ID/URL
            const lat = parseFloat(r.lat.value);
            const lon = parseFloat(r.lon.value);

            // Skip if name is Q-id (no label)
            if (name.startsWith("Q") && /\d/.test(name)) continue;

            insert.run({
                $name: name,
                $url: link,
                $lat: lat,
                $lon: lon
            });
            count++;
        }
    })();

    console.log(`inserted ${count} theaters.`);

} catch (e) {
    console.error(e);
}
