import { html } from "hono/html";
import { Layout } from "./layout";
import { Candidate } from "../db/schema";

interface CandidatesProps {
    candidates: Candidate[];
}

export const Candidates = (props: CandidatesProps) => {
    return (
        <Layout title="気になるリスト">
            <h2 class="text-2xl font-bold mb-6">気になるリスト</h2>

            <div class="candidate-list">
                {props.candidates.map((candidate) => (
                    <div class="candidate-item">
                        <div>
                            <h3 class="font-bold text-lg">{candidate.movie_title}</h3>
                            <p class="text-sm text-gray-400">
                                {candidate.theater_name} | {new Date(candidate.visit_date).toLocaleDateString()}
                            </p>
                            <span class={`status-badge status-${candidate.status} mt-1 inline-block`}>
                                {candidate.status}
                            </span>
                        </div>

                        {candidate.status === 'pending' && (
                            <form action="/api/log" method="post" class="flex gap-2">
                                <input type="hidden" name="id" value={candidate.id} />
                                <input type="text" name="comment" placeholder="Short comment..." class="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:border-violet-500" />
                                <input type="number" name="rating" min="1" max="5" value="3" class="w-12 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-center" />
                                <button type="submit" class="action-btn text-sm">
                                    Write Log
                                </button>
                            </form>
                        )}

                        {candidate.status === 'watched' && (
                            <div class="text-right">
                                <p class="text-xs text-green-400">Saved to Obsidian</p>
                                <p class="text-xs text-gray-500 truncate max-w-[200px]">{candidate.obsidian_path}</p>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {props.candidates.length === 0 && (
                <div class="text-center py-10 text-gray-500">
                    No candidates yet. Go reserve some movies!
                </div>
            )}
        </Layout>
    );
};
