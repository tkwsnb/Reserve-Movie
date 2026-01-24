import { Database } from "bun:sqlite";
import { createTables } from "./schema";

const db = new Database("movie_reserve.sqlite", { create: true });

// Initialize tables
createTables(db);

// Seed Data
const theaterCount = (db.query("SELECT COUNT(*) as count FROM theaters").get() as any).count;
if (theaterCount === 0) {
    db.run("INSERT INTO theaters (name, url) VALUES ('TOHO Cinemas Shinjuku (MW)', 'https://movie.walkerplus.com/th264/')");
}

export default db;
