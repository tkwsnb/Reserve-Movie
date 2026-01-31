import { write } from "bun";
const url = "https://moviewalker.jp/th705/schedule/";
const res = await fetch(url, { headers: { "User-Agent": "MovieReserveApp/1.0" } });
const html = await res.text();
await write("mwp_detail.html", html);
console.log("Saved to mwp_detail.html");
