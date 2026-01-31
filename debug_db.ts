import { Database } from "bun:sqlite";

const db = new Database("movie_reserve.sqlite");

console.log("--- Debugging DB Content ---");

// 1. Check Theaters
const theaters = db.query("SELECT * FROM theaters").all() as any[];
console.log(`Total Theaters: ${theaters.length}`);
if (theaters.length > 0) {
    console.log("Sample Theaters:", theaters.slice(0, 3));
} else {
    console.warn("⚠️ No theaters found!");
}

// 2. Check Schedules
const now = new Date().toISOString();
console.log(`Current Time (ISO): ${now}`);

const schedules = db.query("SELECT * FROM schedules").all() as any[];
console.log(`Total Schedules: ${schedules.length}`);

const futureSchedules = db.query("SELECT * FROM schedules WHERE start_time > $now").all({ $now: now }) as any[];
console.log(`Future Schedules (> NOW): ${futureSchedules.length}`);

if (futureSchedules.length > 0) {
    console.log("Sample Future Schedule:", futureSchedules[0]);
} else {
    console.warn("⚠️ No future schedules found!");
}

console.log("--- End Debug ---");
