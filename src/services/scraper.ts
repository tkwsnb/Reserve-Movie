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

            // -- MOCK PARSER for demonstration --
            // Generate dummy schedules if scraping "Sample Theater" or as a fallback
            const schedules: Schedule[] = [];

            if (theater.name === "Sample Theater") {
                const today = new Date().toISOString().split('T')[0];
                schedules.push(
                    {
                        theater_id: theater.id!,
                        movie_title: "Int'l Space Odyssey 2026",
                        start_time: `${today}T10:00:00`,
                        duration: 148,
                        booking_url: "https://example.com/reserve/1"
                    },
                    {
                        theater_id: theater.id!,
                        movie_title: "Cyberpunk Runner 2099",
                        start_time: `${today}T13:30:00`,
                        duration: 112,
                        booking_url: "https://example.com/reserve/2"
                    },
                    {
                        theater_id: theater.id!,
                        movie_title: "Quiet Place: Day Zero",
                        start_time: `${today}T16:00:00`,
                        duration: 98,
                        booking_url: "https://example.com/reserve/3"
                    }
                );
            }

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
