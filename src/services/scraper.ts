import { parseHTML } from "linkedom";
import { Database } from "bun:sqlite";
import db from "../db";
import { Schedule, Theater } from "../db/schema";

// Wait function to avoid overloading servers
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class ScraperService {
    private db: Database;

    constructor(database: Database) {
        this.db = database;
    }

    async scrapeTheater(theater: Theater): Promise<void> {
        console.log(`Starting scrape for: ${theater.name}`);

        // Politeness wait (randomize slightly)
        await wait(2000 + Math.random() * 1000);

        try {
            const response = await fetch(theater.url);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${theater.url}: ${response.statusText}`);
            }
            const html = await response.text();
            const { document } = parseHTML(html);

            // NOTE: Logic here depends heavily on the target site structure.
            // This is a placeholder/template for a generic structured site or specific parser.
            // For this implementation, we will assume a generic "Movie Walker" style or similar
            // or implement a mock parser if the URL is a test URL.

            /* 
             * TODO: Implement specific parsing logic based on the target site.
             * For now, I'll demonstrate how to parse a list of movies and times
             * assuming a hypothetical standard structure.
             * 
             * Example structure:
             * .movie-block
             *   .title -> innerText
             *   .schedule-item
             *      .time -> innerText (e.g. "10:00")
             *      a.booking-link -> href
             */

            // -- DUMMY PARSER for demonstration (replace with real logic) --
            // In a real scenario, we would switch logic based on theater.url domain

            const schedules: Schedule[] = [];
            const today = new Date().toISOString().split('T')[0];

            // Hypothetical parsing logic (commented out to avoid errors on random URLs)
            /*
            const movieBlocks = document.querySelectorAll('.movie-block');
            for (const block of movieBlocks) {
              const title = block.querySelector('.title')?.textContent?.trim() || "Unknown";
              const times = block.querySelectorAll('.schedule-item');
              
              for (const timeItem of times) {
                 const startTimeStr = timeItem.querySelector('.time')?.textContent?.trim() || "";
                 // Convert "10:00" to ISO string "YYYY-MM-DDTHH:MM:00"
                 const startTime = `${today}T${startTimeStr}:00`; 
                 
                 schedules.push({
                   theater_id: theater.id!,
                   movie_title: title,
                   start_time: startTime,
                   booking_url: theater.url, // or specific link
                   duration: 120 // Default or parsed
                 });
              }
            }
            */

            console.log(`Parsed ${schedules.length} schedules.`);

            // Transactional upsert
            const insertStmt = this.db.prepare(`
        INSERT INTO schedules (theater_id, movie_title, start_time, duration, booking_url)
        VALUES ($theaterId, $title, $startTime, $duration, $url)
      `);

            this.db.transaction(() => {
                // First, ideally clear old future schedules for this theater or use conflict resolution
                // For simplicity, we just append here. Real app should handle updates.
                for (const s of schedules) {
                    insertStmt.run({
                        $theaterId: s.theater_id,
                        $title: s.movie_title,
                        $startTime: s.start_time,
                        $duration: s.duration,
                        $url: s.booking_url
                    });
                }
            })();

        } catch (error) {
            console.error(`Error scraping ${theater.name}:`, error);
        }
    }

    // Helper to standardise ISO string from "HH:MM" data
    private formatTime(timeStr: string): string {
        const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD format
        return `${today}T${timeStr}:00`;
    }
}

export const scraper = new ScraperService(db);
