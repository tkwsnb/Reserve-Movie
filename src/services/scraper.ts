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
            const response = await fetch(theater.url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch ${theater.url}: ${response.statusText}`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const decoder = new TextDecoder('utf-8'); // MovieWalker uses UTF-8 usually
            const html = decoder.decode(arrayBuffer);
            const { document } = parseHTML(html);

            const schedules: Schedule[] = [];

            // --- Heuristic Parser for MovieWalker / Generic Sites ---
            // Strategy: Find time strings, then look for the closest preceding movie title.

            // 1. Get all elements that look like a schedule block
            // MovieWalker typically uses tables or list items.
            // Let's grab all elements containing time patterns "HH:MM"
            const allElements = document.querySelectorAll('*');
            let currentMovieTitle = "Unknown Movie";
            const processedTimes = new Set<string>();

            // Simple state machine: Scan document order.
            // When we hit a Title-like element (H3, H4, or specific class), update currentMovieTitle.
            // When we hit a Time-like element, add schedule.

            for (const el of allElements) {
                // Check if title
                // MovieWalker specific: .m-movie-title or similar
                if (el.tagName === 'H2' || el.tagName === 'H3' || el.className?.includes('title')) {
                    const text = el.textContent?.trim();
                    if (text && text.length > 2 && !text.match(/^\d/)) { // filtering out "10:00" as title
                        currentMovieTitle = text;
                    }
                }

                // Check if time
                const text = el.textContent?.trim() || "";
                const timeMatch = text.match(/(\d{1,2}):(\d{2})/);

                // Heuristic: Must be short (not a long sentence) and contain time
                if (timeMatch && text.length < 10) {
                    const timeKey = `${currentMovieTitle}_${text}`;
                    if (processedTimes.has(timeKey)) continue;

                    const hour = parseInt(timeMatch[1]);
                    const minute = parseInt(timeMatch[2]);

                    // Basic validation
                    if (hour < 0 || hour > 30 || minute < 0 || minute > 59) continue;

                    const today = new Date().toLocaleDateString('en-CA');
                    const startTime = `${today}T${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}:00`;

                    schedules.push({
                        theater_id: theater.id!,
                        movie_title: currentMovieTitle,
                        start_time: startTime,
                        duration: 120, // Dummy duration
                        booking_url: theater.url
                    });
                    processedTimes.add(timeKey);
                }
            }

            // Fallback: If heuristic failed (0 schedules), inject Mock Data for demo
            if (schedules.length === 0) {
                console.log("Heuristic parser found 0 schedules. Falling back to Mock Data.");
                const today = new Date().toISOString().split('T')[0];
                schedules.push(
                    {
                        theater_id: theater.id!,
                        movie_title: "Heuristic Failed: Fallback Data",
                        start_time: `${today}T12:00:00`,
                        duration: 90,
                        booking_url: theater.url
                    }
                );
            } else {
                console.log(`Heuristic parser found ${schedules.length} schedules.`);
                // Filter out likely junk titles (e.g. "Schedule", "Access")
                // In a real app, we'd have a blacklist.
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
