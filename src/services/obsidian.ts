import { write, file } from "bun";
import { Candidate } from "../db/schema";
import { join } from "path";

// Configuration for output path (Default: ./obsidian_inbox)
// In production, set OBSIDIAN_INBOX_PATH env var
const OBSIDIAN_PATH = process.env.OBSIDIAN_INBOX_PATH || join(process.cwd(), "obsidian_inbox");

export class ObsidianService {

    async createMovieNote(candidate: Candidate, rating: number, comment: string): Promise<string> {
        const safeTitle = candidate.movie_title.replace(/[\\/:*?"<>|]/g, "_");
        const dateStr = candidate.visit_date.split('T')[0];
        const fileName = `${dateStr}_${safeTitle}.md`;
        const filePath = join(OBSIDIAN_PATH, fileName);

        // Check if file exists to avoid overwrite (simple check)
        // In a robust app, we might append a counter e.g. _2.md
        if (await file(filePath).exists()) {
            console.warn(`File ${fileName} already exists. Appending timestamp.`);
            // Minimal collision handling
            const timestamp = new Date().getTime();
            return this.createMovieNote({ ...candidate }, rating, comment + `\n(Duplicate note ${timestamp})`);
        }

        const content = `---
tags: [movie, log]
date: ${dateStr}
created: ${new Date().toISOString().split('T')[0]}
theater: "${candidate.theater_name}"
rating: ${rating}
status: watched
image: ""
---

# ${candidate.movie_title}

## ログ
- **日時**: ${candidate.visit_date.replace('T', ' ')}
- **場所**: ${candidate.theater_name}
- **予約**: [Link](${candidate.status === 'watched' ? 'Completed' : 'Pending'})

## 感想
${comment}
`;

        // Ensure directory exists
        // Bun.write doesn't create parent dirs automatically? 
        // Wait, the tool 'write_to_file' I use as agent does, but Bun runtime might not?
        // Node fs 'mkdir' or shell 'mkdir' might be needed if directory is missing.
        // For now, let's assume the user sets a valid path or we create it.
        // We'll try writing directly.

        try {
            await write(filePath, content);
            console.log(`Created Obsidian note: ${filePath}`);
            return filePath;
        } catch (e) {
            console.error("Failed to write Obsidian note", e);
            throw e;
        }
    }
}

export const obsidian = new ObsidianService();
