const queries = [
    "TOHOシネマズ 新宿",
    "東京都新宿区歌舞伎町1-19-1",
    "新宿東宝ビル"
];

for (const q of queries) {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json`;
    console.log(`Fetching ${q}...`);
    try {
        const res = await fetch(url, { headers: { "User-Agent": "MovieReserveApp/1.0" } });
        const data = await res.json();
        console.log(`Result for ${q}:`, data.length > 0 ? `${data[0].lat}, ${data[0].lon}` : "Not Found");
        await new Promise(r => setTimeout(r, 1500)); // Respect rate limit
    } catch (e) {
        console.error(e);
    }
}
