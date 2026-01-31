import app from "./src/index";
import db from "./src/db";

console.log("--- Setup Mock Data ---");
// 1. Ensure we have theaters with coordinates
const count = db.query("SELECT count(*) as c FROM theaters").get() as any;
if (count.c === 0) {
    db.run(`INSERT INTO theaters (name, url, latitude, longitude) VALUES 
        ('Available Theater', 'http://test1.com', 35.6895, 139.6917), -- Tokyo
        ('Far Away Theater', 'http://test2.com', 34.6937, 135.5023)   -- Osaka
    `);
} else {
    // Update existing for test if needed, or insert if not exists
    // For simplicity, let's insert a test theater if ID 999 doesn't exist
    db.run(`INSERT OR IGNORE INTO theaters (id, name, url, latitude, longitude) VALUES 
        (999, 'Test Near Theater', 'http://test999.com', 35.6895, 139.6917)
    `);
    db.run(`INSERT OR IGNORE INTO theaters (id, name, url, latitude, longitude) VALUES 
        (998, 'Test Far Theater', 'http://test998.com', 34.6937, 135.5023)
    `);
}

// 2. Insert schedules 
const now = new Date();
const future1 = new Date(now.getTime() + 1000 * 60 * 60).toISOString(); // 1 hour later
const future2 = new Date(now.getTime() + 1000 * 60 * 120).toISOString(); // 2 hours later

db.run(`INSERT INTO schedules (theater_id, movie_title, start_time, booking_url) VALUES 
    (999, 'Near Movie', '${future1}', 'http://book.com/1'),
    (998, 'Far Movie', '${future2}', 'http://book.com/2')
`);

console.log("--- Testing /api/schedules ---");

// Test 1: Near Tokyo (should return Near Movie)
const req1 = new Request("http://localhost/api/schedules?lat=35.6890&lon=139.6910&radius=5");
const res1 = await app.request(req1);
const data1 = await res1.json();
console.log("Test 1 (Near):", data1.schedules.length > 0 ? "PASS" : "FAIL", `Found ${data1.schedules.length} items`);
if (data1.schedules.length > 0) {
    console.log("First item:", data1.schedules[0].movie_title, "@", data1.schedules[0].theater_name);
}

// Test 2: Small Radius (should filter out)
const req2 = new Request("http://localhost/api/schedules?lat=35.6890&lon=139.6910&radius=0.001"); // Very small
const res2 = await app.request(req2);
const data2 = await res2.json();
console.log("Test 2 (Small Radius):", data2.schedules.length === 0 ? "PASS" : "FAIL", `Found ${data2.schedules.length} items`);

// Test 3: Pagination
const req3 = new Request("http://localhost/api/schedules?lat=35.6890&lon=139.6910&radius=1000&limit=1");
const res3 = await app.request(req3);
const data3 = await res3.json();
console.log("Test 3 (Pagination):", data3.schedules.length === 1 ? "PASS" : "FAIL", "Has More:", data3.hasMore);

console.log("--- Done ---");
