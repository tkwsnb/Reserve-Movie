import { Database } from "bun:sqlite";

const db = new Database("movie_reserve.sqlite");

console.log("--- Fixing Data ---");

// 1. Update Sample Theater with Coordinates (Shinjuku)
const result = db.run(`
    UPDATE theaters 
    SET latitude = 35.6905, longitude = 139.7005 
    WHERE name = 'Sample Theater' AND latitude IS NULL
`);

if (result.changes > 0) {
    console.log(`Updated ${result.changes} theaters with coordinates.`);
} else {
    console.log("Theaters already have coordinates or Sample Theater not found.");
}

// 2. Ensure Future Schedules exist (if not, extend them)
const now = new Date().toISOString();
const schedules = db.query("SELECT * FROM schedules WHERE start_time > $now").all({ $now: now });

if (schedules.length === 0) {
    console.log("No future schedules found. Adding some...");
    const theater = db.query("SELECT * FROM theaters LIMIT 1").get() as any;
    if (theater) {
        const futureTime = new Date(Date.now() + 3600 * 1000).toISOString(); // 1 hour later
        db.run(`INSERT INTO schedules (theater_id, movie_title, start_time, duration, booking_url) 
                VALUES ($tid, 'Fixed Future Movie', $time, 120, 'http://example.com')`, {
            $tid: theater.id,
            $time: futureTime
        });
        console.log("Added logic schedule.");
    }
} else {
    console.log(`Found ${schedules.length} future schedules.`);
}

console.log("--- Fix Complete ---");
