
import { parseHTML } from "linkedom";
import { readFileSync } from "fs";

const html = readFileSync("mwp_detail.html", "utf-8");
const { document } = parseHTML(html);

// Select all movie articles
const articles = document.querySelectorAll("article");
console.log(`Found ${articles.length} movie articles.`);

const DEBUG_LIMIT = 5;
let count = 0;

for (const art of articles) {
    if (count++ > DEBUG_LIMIT) break;

    const titleEl = art.querySelector("h2");
    const title = titleEl?.textContent?.trim();
    if (!title) continue;

    console.log(`Movie: ${title}`);

    // Schedule list
    // .bl_screen_timeTable ul > li
    const dayLis = art.querySelectorAll(".bl_screen_timeTable > ul > li");

    for (const li of dayLis) {
        // Date: .date (e.g. "1/31\n土")
        const dateEl = li.querySelector(".date");
        const dateText = dateEl?.textContent?.trim() || "";
        // parse month/day
        const dateMatch = dateText.match(/(\d{1,2})\/(\d{1,2})/);
        if (!dateMatch) continue;

        const month = parseInt(dateMatch[1]);
        const day = parseInt(dateMatch[2]);

        // Determine year (basic heuristic: if month is < current month - 1, it's next year. 
        // But for "Now Showing", assuming current year or next year is safe. 
        // Better: assume finding schedule implies near future.
        const now = new Date();
        let year = now.getFullYear();
        // If current is Dec and month is Jan, Year+1
        if (now.getMonth() === 11 && month === 1) year++;

        // Times: dd > a.startTime
        const timeLinks = li.querySelectorAll("dd a.startTime");
        for (const link of timeLinks) {
            const timeText = link.textContent?.trim() || "";
            const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
            if (!timeMatch) continue;

            const hour = parseInt(timeMatch[1]);
            const min = parseInt(timeMatch[2]);

            // Format ISO: YYYY-MM-DDTHH:MM:SS
            const iso = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}T${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}:00`;

            console.log(`  -> ${iso}`);
        }
    }
}
