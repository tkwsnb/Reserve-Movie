import { Database } from "bun:sqlite";

const db = new Database("movie_reserve.sqlite");

console.log("Theaters count:", db.query("SELECT count(*) as c FROM theaters").get().c);
console.log("Schedules count:", db.query("SELECT count(*) as c FROM schedules").get().c);

const theater = db.query("SELECT * FROM theaters LIMIT 1").get();
console.log("Sample Theater:", theater);

if (theater) {
    const schedules = db.query("SELECT * FROM schedules WHERE theater_id = $id LIMIT 1").get({ $id: theater.id });
    console.log("Sample Schedule:", schedules);
}
