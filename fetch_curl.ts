import { spawn } from "bun";
import { write } from "bun";

const url = "https://movie.walkerplus.com/th264/";
console.log(`Fetching ${url} using curl...`);

const proc = spawn([
    "curl.exe",
    "-L", // Follow redirects
    "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    url
]);

const text = await new Response(proc.stdout).text();

if (text.length > 0) {
    console.log(`Fetched ${text.length} bytes.`);
    await write("moviewalker.html", text);
    console.log("Saved to moviewalker.html");
} else {
    console.error("Failed to fetch content (empty response).");
    const err = await new Response(proc.stderr).text();
    console.error(err);
}
