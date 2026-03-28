import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { CHAPTERS } from "./src/constants";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Routes
  app.get("/api/chapters", (req, res) => {
    res.json(CHAPTERS);
  });

  app.get("/api/chapters/:id", (req, res) => {
    const chapter = CHAPTERS.find(c => c.chapter_id === req.params.id);
    if (chapter) {
      res.json(chapter);
    } else {
      res.status(404).json({ error: "Chapter not found" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
