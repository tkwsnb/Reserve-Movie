import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import db from "./db";
import type { Schedule, Candidate } from "./db/schema";
import { scraper } from "./services/scraper";
import { obsidian } from "./services/obsidian";
import { Home } from "./views/home";
import { Candidates } from "./views/candidates";

const app = new Hono();

// Static files
app.use("/static/*", serveStatic({
    root: "./src/public",
    rewriteRequestPath: (path) => path.replace(/^\/static/, "")
}));

// Routes

// 1. Home Page (Schedule List)
app.get("/", (c) => {
    const sort = c.req.query("sort");

    // Fetch schedules
    // In a real app, join with theaters table
    const query = db.query("SELECT * FROM schedules");
    const schedules = query.all() as Schedule[];

    return c.html(<Home schedules={schedules} sort={sort} />);
});

// 2. Candidates Page
app.get("/candidates", (c) => {
    const query = db.query("SELECT * FROM candidates ORDER BY created_at DESC");
    const candidates = query.all() as Candidate[];

    return c.html(<Candidates candidates={candidates} />);
});

// API: Track a movie (Reserve button clicked)
app.post("/api/track", async (c) => {
    const body = await c.req.parseBody();
    const movie_title = body['movie_title'] as string;
    const theater_name = body['theater_name'] as string;
    const start_time = body['start_time'] as string; // Already ISO string from hidden input
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
app.post("/api/log", async (c) => {
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
app.get("/api/scrape", async (c) => {
    // Ensure we have a theater to scrape
    // Insert a dummy theater if none
    const count = (db.query("SELECT COUNT(*) as count FROM theaters").get() as any).count;
    if (count === 0) {
        db.run("INSERT INTO theaters (name, url) VALUES ('Sample Theater', 'https://example.com')");
    }

    const theaters = db.query("SELECT * FROM theaters").all() as any[];

    for (const t of theaters) {
        await scraper.scrapeTheater(t);
    }

    return c.redirect("/");
});

// API: Search Schedules (Now Showing)
app.get("/api/schedules", (c) => {
    const latStr = c.req.query("lat");
    const lonStr = c.req.query("lon");
    const radiusStr = c.req.query("radius"); // in km
    const offsetStr = c.req.query("offset");
    const limitStr = c.req.query("limit");

    if (!latStr || !lonStr) {
        return c.json({ error: "Latitude and Longitude are required" }, 400);
    }

    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    const radius = parseFloat(radiusStr || "5");
    const offset = parseInt(offsetStr || "0");
    const limit = parseInt(limitStr || "20");

    // 1. Get all theaters
    const theaters = db.query("SELECT * FROM theaters").all() as any[];

    // 2. Filter theaters by distance (Haversine formula approximation)
    const nearbyTheaterIds = theaters.filter(t => {
        if (!t.latitude || !t.longitude) return false;
        const d = getDistanceFromLatLonInKm(lat, lon, t.latitude, t.longitude);
        return d <= radius;
    }).map(t => t.id);

    if (nearbyTheaterIds.length === 0) {
        return c.json({ schedules: [], hasMore: false });
    }

    // 3. Query schedules for these theaters (Future only)
    // Note: handling array in SQL via parameter substitution is tricky in some drivers, 
    // manually constructing string for IN clause is often done in simple SQLite wrappers 
    // but dangerous if not careful. Here IDs are integers so it's safer.
    const idsString = nearbyTheaterIds.join(",");
    const now = new Date().toISOString();

    const query = db.query(`
        SELECT s.*, t.name as theater_name, t.latitude, t.longitude 
        FROM schedules s
        JOIN theaters t ON s.theater_id = t.id
        WHERE s.theater_id IN (${idsString})
        AND s.start_time > $now
        ORDER BY s.start_time ASC
        LIMIT $limit OFFSET $offset
    `);

    const schedules = query.all({
        $now: now,
        $limit: limit + 1, // Fetch one more to check 'hasMore'
        $offset: offset
    }) as any[];

    const hasMore = schedules.length > limit;
    if (hasMore) {
        schedules.pop(); // Remove the extra one
    }

    return c.json({
        schedules,
        hasMore
    });
});

// Helper: Haversine Formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

export default app;
