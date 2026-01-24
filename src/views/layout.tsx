import { html } from "hono/html";

interface LayoutProps {
    title: string;
    children: any;
}

export const Layout = (props: LayoutProps) => {
    return html`
    <!DOCTYPE html>
    <html lang="ja">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${props.title} - Movie Reserve</title>
        <script src="https://cdn.tailwindcss.com"></script> <!-- Optional for layout helpers -->
        <link rel="stylesheet" href="/static/styles.css" />
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;800&display=swap" rel="stylesheet">
      </head>
      <body>
        <header>
          <h1>Movie Reserve</h1>
          <nav>
            <a href="/">Schedules</a>
            <a href="/candidates">Candidates</a>
          </nav>
        </header>
        <main>
          ${props.children}
        </main>
      </body>
    </html>
  `;
};
