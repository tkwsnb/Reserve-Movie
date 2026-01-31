import { write } from "bun";

const url = "https://moviewalker.jp/theater/";
const headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

console.log(`Fetching ${url}...`);
try {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const html = await response.text();
    await write("mwp_top.html", html);
    console.log("Saved to mwp_top.html");
} catch (e) {
    console.error(e);
}
