
import { parseHTML } from "linkedom";

const url = "https://moviewalker.jp/theater/tokyo/";
console.log(`Fetching ${url}...`);

const res = await fetch(url, { headers: { "User-Agent": "MovieReserveApp/1.0" } });
const html = await res.text();
const { document } = parseHTML(html);

// Try to find a theater row. 
// Based on typical MWP structure, look for links containing "schedule"
const links = document.querySelectorAll("a");
for (const link of links) {
    if (link.href.includes("/schedule/th")) {
        console.log("Found theater link container:");
        console.log(link.outerHTML.substring(0, 500)); // First 500 chars
        console.log("Parent:");
        console.log(link.parentElement?.outerHTML.substring(0, 500));
        break;
    }
}
