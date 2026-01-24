import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import db from "./db";
import { Schedule, Candidate } from "./db/schema";
import { scraper } from "./services/scraper";
import { obsidian } from "./services/obsidian";
import { Home } from "./views/home";
import { Candidates } from "./views/candidates";

const app = new Hono();

// Static files
app.use("/static/*", serveStatic({ root: "./src/public" }));

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

export default app;
