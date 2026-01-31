import { write } from "bun";
const url = "https://moviewalker.jp/theater/tokyo/";
const res = await fetch(url, { headers: { "User-Agent": "MovieReserveApp/1.0" } });
const html = await res.text();
await write("tokyo.html", html);
console.log("Saved to tokyo.html");
