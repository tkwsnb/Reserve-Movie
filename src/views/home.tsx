import { html } from "hono/html";
import { Layout } from "./layout";
import type { Schedule } from "../db/schema";

interface HomeProps {
    schedules: Schedule[];
    sort?: string;
}

export const Home = (props: HomeProps) => {
    const { schedules, sort } = props;

    // Simple sorting logic
    const sortedSchedules = [...schedules].sort((a, b) => {
        if (sort === 'duration') {
            return (a.duration || 0) - (b.duration || 0);
        }
        return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
    });

    // Group by Date for SSR
    const groupedSchedules: { date: string; items: Schedule[] }[] = [];
    sortedSchedules.forEach(s => {
        const dateObj = new Date(s.start_time);
        const dateStr = dateObj.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });

        // Fix: Use Japanese date string or consistent key
        let lastGroup = groupedSchedules[groupedSchedules.length - 1];
        if (!lastGroup || lastGroup.date !== dateStr) {
            lastGroup = { date: dateStr, items: [] };
            groupedSchedules.push(lastGroup);
        }
        lastGroup.items.push(s);
    });

    // Determine initial last date for client-side hydration
    const initialLastDate = groupedSchedules.length > 0 ? groupedSchedules[groupedSchedules.length - 1].date : "";

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
            <div id="schedule-container" class="flex flex-col gap-8">
                {groupedSchedules.map((group) => (
                    <div class="date-section">
                        <div class="sticky top-[80px] z-10 bg-slate-900/95 backdrop-blur-sm py-2 px-4 mb-4 border-l-4 border-violet-500 shadow-xl rounded-r-lg">
                            <h3 class="text-lg font-bold text-violet-300">{group.date}</h3>
                        </div>
                        <div class="card-grid">
                            {group.items.map((schedule) => (
                                <div class="movie-card">
                                    <div class="movie-title">{schedule.movie_title}</div>
                                    <div class="movie-info">
                                        <p>🕒 {new Date(schedule.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ~</p>
                                        <p>⏳ {schedule.duration ? `${schedule.duration} min` : 'N/A'}</p>
                                        <p>📍 {schedule.theater_name || `Theater ${schedule.theater_id}`}</p>
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
                let currentOffset = 20; // Start after SSR items
                let isLoading = false;
                let hasMore = true;
                let isGeoMode = false;
                let lastRenderedDate = "${initialLastDate || ''}"; 

                radiusInput.addEventListener('input', (e) => {
                    radiusValue.textContent = e.target.value + ' km';
                });
                
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
                        container.innerHTML = ''; 
                        lastRenderedDate = ""; 
                        if (emptyMsg) emptyMsg.style.display = 'none';
                    }
                    if (!hasMore) return;

                    isLoading = true;
                    loading.classList.remove('hidden');

                    const radius = radiusInput.value;
                    let url = \`/api/schedules?radius=\${radius}&offset=\${currentOffset}\`;
                    if (currentLat && currentLon) {
                        url += \`&lat=\${currentLat}&lon=\${currentLon}\`;
                    }

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
                                const dateObj = new Date(s.start_time);
                                const dateStr = dateObj.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' });
                                
                                let currentGrid;

                                // If date changed or first item (in a non-reset scenario where lastRenderedDate is set), create new section
                                if (dateStr !== lastRenderedDate) {
                                    const section = document.createElement('div');
                                    section.className = "date-section";
                                    
                                    // Sticky Header
                                    section.innerHTML = \`
                                        <div class="sticky top-[80px] z-10 bg-slate-900/95 backdrop-blur-sm py-2 px-4 mb-4 border-l-4 border-violet-500 shadow-xl rounded-r-lg">
                                            <h3 class="text-lg font-bold text-violet-300">\${dateStr}</h3>
                                        </div>
                                        <div class="card-grid"></div>
                                    \`;
                                    container.appendChild(section);
                                    
                                    lastRenderedDate = dateStr;
                                    currentGrid = section.querySelector('.card-grid');
                                } else {
                                    // Append to existing last section's grid
                                    // Ensure we have a wrapper if initial SSR didn't have one (edge case) or just use last child
                                    let lastSection = container.lastElementChild;
                                    if (!lastSection || !lastSection.classList.contains('date-section')) {
                                         // Should not happen with new structure, but safe fallback
                                         const section = document.createElement('div');
                                         section.className = "date-section";
                                         section.innerHTML = '<div class="card-grid"></div>';
                                         container.appendChild(section);
                                         lastSection = section;
                                    }
                                    currentGrid = lastSection.querySelector('.card-grid');
                                }

                                const card = createMovieCard(s);
                                currentGrid.appendChild(card);
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
                    // Removed !isGeoMode check to allow infinite scroll on default view
                    if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 500) {
                        loadSchedules();
                    }
                });
            ` }} />
        </Layout>
    );
};
