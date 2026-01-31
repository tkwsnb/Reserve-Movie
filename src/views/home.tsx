import { html } from "hono/html";
import { Layout } from "./layout";
import type { Schedule } from "../db/schema";

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
            <div class="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h2 class="text-2xl font-bold">Upcoming Schedules</h2>

                <div class="flex flex-col md:flex-row items-center gap-4">
                    {/* Location Controls */}
                    <div class="flex items-center bg-slate-800 p-2 rounded-lg">
                        <span class="text-sm mr-2 text-slate-400">Radius:</span>
                        <input type="range" id="radiusInput" min="1" max="50" value="5" class="w-24 mr-2" />
                        <span id="radiusValue" class="text-sm w-12 text-slate-300">5 km</span>
                        <button id="geoBtn" class="bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1 rounded transition ml-2">
                            📍 Near Me
                        </button>
                    </div>

                    {/* Sort Controls */}
                    <div>
                        <a href="/?sort=time" class={`px-4 py-2 rounded mr-2 ${sort !== 'duration' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                            Time
                        </a>
                        <a href="/?sort=duration" class={`px-4 py-2 rounded ${sort === 'duration' ? 'bg-violet-600 text-white' : 'bg-slate-700 text-slate-300'}`}>
                            Shortest
                        </a>
                    </div>
                </div>
            </div>

            {/* Container for Client-Side Injection */}
            <div id="schedule-container" class="card-grid">
                {sortedSchedules.map((schedule) => (
                    <div class="movie-card">
                        <div class="movie-title">{schedule.movie_title}</div>
                        <div class="movie-info">
                            <p>🕒 {new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~</p>
                            <p>⏳ {schedule.duration ? `${schedule.duration} min` : 'N/A'}</p>
                            <p>📍 Theater ID: {schedule.theater_id}</p> {/* Todo: Fetch real name via join in initial query */}
                        </div>

                        <form action="/api/track" method="post" class="mt-auto">
                            <input type="hidden" name="movie_title" value={schedule.movie_title} />
                            <input type="hidden" name="theater_name" value={schedule.theater_name || `Theater ${schedule.theater_id}`} />
                            <input type="hidden" name="start_time" value={schedule.start_time} />
                            <input type="hidden" name="redirect_url" value={schedule.booking_url} />
                            <button type="submit" class="action-btn w-full">
                                Reserve & Track
                            </button>
                        </form>
                    </div>
                ))}
            </div>

            <div id="loading" class="hidden text-center py-4">
                <span class="animate-pulse text-slate-400">Loading more schedules...</span>
            </div>

            {schedules.length === 0 && (
                <div id="empty-msg" class="text-center py-10 text-gray-500">
                    <p>スケジュールが見つかりません。</p>
                </div>
            )}

            <div class="text-center mt-8 mb-12">
                <a href="/api/scrape" class="inline-block bg-slate-700 hover:bg-slate-600 text-white px-6 py-2 rounded transition">
                    🔄 手動スクレイピング実行 (再取得)
                </a>
            </div>

            {/* Client-Side Script for Geolocation & Infinite Scroll */}
            <script dangerouslySetInnerHTML={{
                __html: `
                const radiusInput = document.getElementById('radiusInput');
                const radiusValue = document.getElementById('radiusValue');
                const geoBtn = document.getElementById('geoBtn');
                const container = document.getElementById('schedule-container');
                const loading = document.getElementById('loading');
                const emptyMsg = document.getElementById('empty-msg');
                
                let currentLat = null;
                let currentLon = null;
                let currentOffset = 0;
                let isLoading = false;
                let hasMore = true;
                let isGeoMode = false;

                // Update radius label
                radiusInput.addEventListener('input', (e) => {
                    radiusValue.textContent = e.target.value + ' km';
                });
                
                // Radius change triggers reload if in geo mode
                radiusInput.addEventListener('change', () => {
                   if (isGeoMode && currentLat) {
                       loadSchedules(true);
                   } 
                });

                geoBtn.addEventListener('click', () => {
                    if (!navigator.geolocation) {
                        alert("Geolocation is not supported by your browser");
                        return;
                    }

                    geoBtn.textContent = "Getting Location...";
                    geoBtn.disabled = true;

                    navigator.geolocation.getCurrentPosition(
                        (position) => {
                            currentLat = position.coords.latitude;
                            currentLon = position.coords.longitude;
                            isGeoMode = true;
                            geoBtn.textContent = "📍 Near Me (Active)";
                            geoBtn.classList.add('bg-green-600');
                            geoBtn.classList.remove('bg-blue-600');
                            geoBtn.disabled = false;
                            
                            // Clear current static list and load new data
                            loadSchedules(true);
                        },
                        (error) => {
                            alert("Unable to retrieve your location");
                            geoBtn.textContent = "📍 Near Me";
                            geoBtn.disabled = false;
                        }
                    );
                });

                async function loadSchedules(reset = false) {
                    if (isLoading) return;
                    if (reset) {
                        currentOffset = 0;
                        hasMore = true;
                        container.innerHTML = ''; // Clear server-rendered content
                        if (emptyMsg) emptyMsg.style.display = 'none';
                    }
                    if (!hasMore) return;

                    isLoading = true;
                    loading.classList.remove('hidden');

                    const radius = radiusInput.value;
                    const url = \`/api/schedules?lat=\${currentLat}&lon=\${currentLon}&radius=\${radius}&offset=\${currentOffset}\`;

                    try {
                        const res = await fetch(url);
                        const data = await res.json();
                        
                        if (data.error) {
                            console.error(data.error);
                            return;
                        }

                        if (data.schedules.length === 0 && reset) {
                             container.innerHTML = '<div class="text-center py-10 text-gray-500 w-full col-span-full">No schedules found nearby. Try increasing the radius.</div>';
                        } else {
                            data.schedules.forEach(s => {
                                const card = createMovieCard(s);
                                container.appendChild(card);
                            });
                        }

                        currentOffset += data.schedules.length;
                        hasMore = data.hasMore;

                    } catch (err) {
                        console.error(err);
                    } finally {
                        isLoading = false;
                        loading.classList.add('hidden');
                    }
                }

                function createMovieCard(schedule) {
                    const div = document.createElement('div');
                    div.className = 'movie-card';
                    
                    const startTime = new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    const theaterName = schedule.theater_name || ('Theater ' + schedule.theater_id);

                    div.innerHTML = \`
                        <div class="movie-title">\${schedule.movie_title}</div>
                        <div class="movie-info">
                            <p>🕒 \${startTime} ~</p>
                            <p>⏳ \${schedule.duration ? schedule.duration + ' min' : 'N/A'}</p>
                            <p>📍 \${theaterName}</p>
                        </div>
                        <form action="/api/track" method="post" class="mt-auto">
                            <input type="hidden" name="movie_title" value="\${schedule.movie_title}" />
                            <input type="hidden" name="theater_name" value="\${theaterName}" />
                            <input type="hidden" name="start_time" value="\${schedule.start_time}" />
                            <input type="hidden" name="redirect_url" value="\${schedule.booking_url || ''}" />
                            <button type="submit" class="action-btn w-full">
                                Reserve & Track
                            </button>
                        </form>
                    \`;
                    return div;
                }

                // Infinite Scroll
                window.addEventListener('scroll', () => {
                    if (!isGeoMode) return;
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                        loadSchedules();
                    }
                });
            ` }} />
        </Layout>
    );
};
