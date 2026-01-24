import { write } from "bun";

const url = "https://movie.walkerplus.com/th264/"; // Example: TOHO Cinemas Shinjuku on MovieWalker
console.log(`Fetching ${url}...`);

try {
    const response = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
    });
    if (!response.ok) throw new Error(response.statusText);
    const html = await response.text();
    await write("moviewalker.html", html);
    console.log("Saved to moviewalker.html");
} catch (e) {
    console.error(e);
}
