import { Database } from "bun:sqlite";

const db = new Database("movie_reserve.sqlite");

console.log("Cleaning up test data...");
db.run("DELETE FROM schedules WHERE theater_id IN (998, 999)");
db.run("DELETE FROM theaters WHERE id IN (998, 999)");
console.log("Cleanup done.");
