import { html } from "hono/html";
import { Layout } from "./layout";
import { Schedule } from "../db/schema";

interface HomeProps {
    schedules: Schedule[];
    sort?: string;
}

export const Home = (props: HomeProps) => {
    const { schedules, sort } = props;

    // Simple sorting logic (can be moved to DB query)
    const sortedSchedules = [...schedules].sort((a, b) => {
        if (sort === 'duration') {
            return (a.duration || 0) - (b.duration || 0);
        }
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

    return (
        <Layout title="Schedules">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold">Upcoming Schedules</h2>
                <div>
                    <a href="/?sort=time" class={`px-4 py-2 rounded mr-2 ${sort !== 'duration' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                        Time
                    </a>
                    <a href="/?sort=duration" class={`px-4 py-2 rounded ${sort === 'duration' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                        Shortest First
                    </a>
                </div>
            </div>

            <div class="card-grid">
                {sortedSchedules.map((schedule) => (
                    <div class="movie-card">
                        <div class="movie-title">{schedule.movie_title}</div>
                        <div class="movie-info">
                            <p>🕒 {new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~</p>
                            <p>⏳ {schedule.duration ? `${schedule.duration} min` : 'N/A'}</p>
                            <p>📍 Theater ID: {schedule.theater_id}</p>
                        </div>

                        <form action="/api/track" method="post" class="mt-auto">
                            <input type="hidden" name="movie_title" value={schedule.movie_title} />
                            <input type="hidden" name="theater_name" value="Sample Theater" /> {/* Todo: Fetch real name */}
                            <input type="hidden" name="start_time" value={schedule.start_time} />
                            <input type="hidden" name="redirect_url" value={schedule.booking_url} />
                            <button type="submit" class="action-btn w-full">
                                Reserve & Track
                            </button>
                        </form>
                    </div>
                ))}
            </div>

            {schedules.length === 0 && (
                <div class="text-center py-10 text-gray-500">
                    <p>No schedules found.</p>
                    <a href="/api/scrape" class="text-violet-400 underline">Trigger Manual Scrape (Test)</a>
                </div>
            )}
        </Layout>
    );
};
