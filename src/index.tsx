import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import apiRoutes from "./routes/api";
import viewRoutes from "./routes/views";

const app = new Hono();

// Static files
app.use("/static/*", serveStatic({
    root: "./src/public",
    rewriteRequestPath: (path) => path.replace(/^\/static/, "")
}));

// Mount Routes
app.route("/", viewRoutes);
app.route("/api", apiRoutes);

export default app;
