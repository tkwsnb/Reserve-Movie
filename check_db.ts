import { Database } from "bun:sqlite";

const db = new Database("movie_reserve.sqlite");

const theaters = db.query("SELECT count(*) as c FROM theaters").get() as any;
const schedules = db.query("SELECT count(*) as c FROM schedules").get() as any;

console.log(`Theaters: ${theaters.c}`);
console.log(`Schedules: ${schedules.c}`);


const theater = db.query("SELECT * FROM theaters LIMIT 1").get();
console.log("Sample Theater:", theater);

if (theater) {
    const schedules = db.query("SELECT * FROM schedules WHERE theater_id = $id LIMIT 1").get({ $id: theater.id });
    console.log("Sample Schedule:", schedules);
}
