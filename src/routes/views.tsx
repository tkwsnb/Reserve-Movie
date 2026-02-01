
import { Hono } from "hono";
import db from "../db";
import type { Schedule, Candidate } from "../db/schema";
import { Home } from "../views/home";
import { Candidates } from "../views/candidates";

const views = new Hono();

// 1. Home Page (Schedule List)
views.get("/", (c) => {
    const sort = c.req.query("sort");

    // Fetch schedules (Limit to 20 for initial load performance)
    const query = db.query("SELECT * FROM schedules WHERE start_time > datetime('now') ORDER BY start_time ASC LIMIT 20");
    const schedules = query.all() as Schedule[];

    return c.html(<Home schedules={schedules} sort={sort} />);
});

// 2. Candidates Page
views.get("/candidates", (c) => {
    const query = db.query("SELECT * FROM candidates ORDER BY created_at DESC");
    const candidates = query.all() as Candidate[];

    return c.html(<Candidates candidates={candidates} />);
});

export default views;
