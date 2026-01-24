import { Database } from "bun:sqlite";
import { createTables } from "./schema";

const db = new Database("movie_reserve.sqlite", { create: true });

// Initialize tables
createTables(db);

export default db;
