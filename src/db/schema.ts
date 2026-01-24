import { Database } from "bun:sqlite";

export interface Theater {
  id?: number;
  name: string;
  url: string;
  latitude?: number;
  longitude?: number;
}

export interface Schedule {
  id?: number;
  theater_id: number;
  movie_title: string;
  start_time: string; // ISO8601 string
  end_time?: string; // ISO8601 string
  duration?: number; // minutes
  booking_url: string;
}

export interface Candidate {
  id?: number;
  movie_title: string;
  theater_name: string;
  visit_date: string; // ISO8601 string
  status: 'pending' | 'watched' | 'cancelled';
  obsidian_path?: string;
  created_at: string;
}

export function createTables(db: Database) {
  // Theaters Table
  db.run(`
    CREATE TABLE IF NOT EXISTS theaters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      latitude REAL,
      longitude REAL
    );
  `);

  // Schedules Table
  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theater_id INTEGER NOT NULL,
      movie_title TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration INTEGER,
      booking_url TEXT,
      FOREIGN KEY (theater_id) REFERENCES theaters(id)
    );
  `);

  // Candidates Table
  db.run(`
    CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      movie_title TEXT NOT NULL,
      theater_name TEXT NOT NULL,
      visit_date TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'watched', 'cancelled')) NOT NULL DEFAULT 'pending',
      obsidian_path TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);
}
