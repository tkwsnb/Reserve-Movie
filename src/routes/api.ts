
import { Hono } from "hono";
import db from "../db";
import type { Schedule, Candidate } from "../db/schema";
import { scraper } from "../services/scraper";
import { obsidian } from "../services/obsidian";
import { getDistanceFromLatLonInKm } from "../utils/geo";

const api = new Hono();

// API: Track a movie (Reserve button clicked)
api.post("/track", async (c) => {
    const body = await c.req.parseBody();
    const movie_title = body['movie_title'] as string;
    const theater_name = body['theater_name'] as string;
    const start_time = body['start_time'] as string;
    const redirect_url = body['redirect_url'] as string;

    try {
        const insert = db.prepare(`
      INSERT INTO candidates (movie_title, theater_name, visit_date, status)
      VALUES ($title, $theater, $date, 'pending')
    `);

        insert.run({
            $title: movie_title,
            $theater: theater_name,
            $date: start_time
        });

        // UX: Redirect to the actual booking page (302)
        return c.redirect(redirect_url || "/");

    } catch (e) {
        console.error(e);
        return c.text("Error tracking movie", 500);
    }
});

// API: Write Log (Obsidian)
api.post("/log", async (c) => {
    const body = await c.req.parseBody();
    const id = body['id'] as string;
    const rating = parseInt(body['rating'] as string || "3");
    const comment = body['comment'] as string || "";

    // Get candidate
    const candidate = db.query("SELECT * FROM candidates WHERE id = $id").get({ $id: id }) as Candidate;

    if (!candidate) return c.text("Candidate not found", 404);

    try {
        // 1. Create Obsidian file
        const filePath = await obsidian.createMovieNote(candidate, rating, comment);

        // 2. Update DB status
        const update = db.prepare(`
      UPDATE candidates 
      SET status = 'watched', obsidian_path = $path 
      WHERE id = $id
    `);

        update.run({
            $path: filePath,
            $id: id
        });

        return c.redirect("/candidates");
    } catch (e) {
        console.error(e);
        return c.text("Failed to create log", 500);
    }
});

// API: Trigger Scrape (Manual)
api.get("/scrape", async (c) => {
    const count = (db.query("SELECT COUNT(*) as count FROM theaters").get() as any).count;
    if (count === 0) {
        db.run("INSERT INTO theaters (name, url) VALUES ('Sample Theater', 'https://example.com')");
    }

    const theaters = db.query("SELECT * FROM theaters").all() as any[];

    // Scrape async (fire and forget for this request, or await if manageable)
    // For manual trigger, let's await to ensure at least some progress is seen, or simple redirect.
    // Given the previous code awaited, we await here.
    for (const t of theaters) {
        await scraper.scrapeTheater(t);
    }

    return c.redirect("/");
});

// API: Search Schedules (Now Showing)
api.get("/schedules", (c) => {
    const latStr = c.req.query("lat");
    const lonStr = c.req.query("lon");
    const radiusStr = c.req.query("radius"); // in km
    const offsetStr = c.req.query("offset");
    const limitStr = c.req.query("limit");

    // if (!latStr || !lonStr) {
    //     return c.json({ error: "Latitude and Longitude are required" }, 400);
    // }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    const radius = parseFloat(radiusStr || "5");
    const offset = parseInt(offsetStr || "0");
    const limit = parseInt(limitStr || "20");

    // 1. Get all theaters
    const theaters = db.query("SELECT * FROM theaters").all() as any[];
    let targetTheaterIds: number[] = [];

    if (latStr && lonStr) {
        // Filter by distance if coordinates provided
        targetTheaterIds = theaters.filter(t => {
            if (!t.latitude || !t.longitude) return false;
            const d = getDistanceFromLatLonInKm(lat, lon, t.latitude, t.longitude);
            return d <= radius;
        }).map(t => t.id);

        if (targetTheaterIds.length === 0) {
            return c.json({ schedules: [], hasMore: false });
        }
    } else {
        // If no coordinates, include all theaters (or maybe limit to major ones? for now all)
        // Check if user wants all. If so, passing empty list to IN requires handling.
        targetTheaterIds = theaters.map(t => t.id);
    }

    // 3. Query schedules
    // If targetTheaterIds is huge, IN (...) might be slow, but for now ok.
    // Optimization: If no geo filter, just query schedules directly without IN clause if we want "all".

    const now = new Date().toISOString();
    let query;
    let params: any = {
        $now: now,
        $limit: limit + 1,
        $offset: offset
    };

    if (latStr && lonStr) {
        const idsString = targetTheaterIds.join(",");
        query = db.query(`
            SELECT s.*, t.name as theater_name, t.latitude, t.longitude 
            FROM schedules s
            JOIN theaters t ON s.theater_id = t.id
            WHERE s.theater_id IN (${idsString})
            AND s.start_time > $now
            ORDER BY s.start_time ASC
            LIMIT $limit OFFSET $offset
        `);
    } else {
        // No Geo Filter -> Global List
        query = db.query(`
            SELECT s.*, t.name as theater_name, t.latitude, t.longitude 
            FROM schedules s
            JOIN theaters t ON s.theater_id = t.id
            WHERE s.start_time > $now
            ORDER BY s.start_time ASC
            LIMIT $limit OFFSET $offset
        `);
    }

    const schedules = query.all(params) as any[];

    const hasMore = schedules.length > limit;
    if (hasMore) {
        schedules.pop();
    }

    return c.json({
        schedules,
        hasMore
    });
});

export default api;
