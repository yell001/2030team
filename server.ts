import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// -----------------------------
// PostgreSQL (free plan friendly)
// -----------------------------
if (!process.env.DATABASE_URL) {
  console.warn(
    "[WARN] DATABASE_URL is not set. Set it in Render Environment variables.",
  );
}

const shouldUseSSL = (() => {
  // Many hosted Postgres providers require SSL in production.
  // Render internal Postgres may work without SSL, but this setting is safe.
  if (process.env.PGSSLMODE === "disable") return false;
  if (process.env.PGSSLMODE === "require") return true;

  const url = process.env.DATABASE_URL || "";
  const isLocal = url.includes("localhost") || url.includes("127.0.0.1");
  return process.env.NODE_ENV === "production" && !isLocal;
})();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSSL ? { rejectUnauthorized: false } : undefined,
});

async function initDb() {
  const schema = `
    CREATE TABLE IF NOT EXISTS memos (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      person_name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS likes (
      content_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (content_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS comments (
      id TEXT PRIMARY KEY,
      content_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `;

  await pool.query(schema);

  // Seed quotes if empty
  const countRes = await pool.query<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM quotes",
  );
  const count = Number(countRes.rows?.[0]?.count ?? "0");

  if (count === 0) {
    try {
      const seedData = JSON.parse(
        fs.readFileSync(path.resolve("quotes_seed.json"), "utf-8"),
      );

      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        for (const person of seedData) {
          for (const text of person.quotes) {
            await client.query(
              "INSERT INTO quotes (id, person_name, text) VALUES ($1, $2, $3)",
              [uuidv4(), person.personName, text],
            );
          }
        }

        await client.query("COMMIT");
        console.log("Seeded quotes from quotes_seed.json");
      } catch (e) {
        await client.query("ROLLBACK");
        console.error("Failed to seed quotes (rolled back):", e);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Failed to seed quotes:", err);
    }
  }
}

// -----------------------------
// API Routes
// -----------------------------

// 1. Get Google Drive Files
app.get("/api/drive", async (req, res) => {
  try {
    const apiKey =
      process.env.GOOGLE_API_KEY || "AIzaSyB0OJVgWzssF45BsO1lsc1fWPe-Pm6-aeA";
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "GOOGLE_API_KEY is not configured on the server." });
    }

    const folderId = "19oxO4tG6kaNh66cC18Lq8N2QetjYDjD4";
    const query = `'${folderId}' in parents and trashed = false`;
    const fields =
      "files(id, name, mimeType, thumbnailLink, webContentLink, createdTime)";

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(
      query,
    )}&key=${apiKey}&fields=${encodeURIComponent(fields)}&pageSize=1000`;

    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Drive API Error:", errorText);
      return res
        .status(response.status)
        .json({ error: "Failed to fetch from Google Drive" });
    }

    const data = await response.json();

    // Filter only images and videos
    const allowedMimeTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/quicktime",
    ];
    const filteredFiles = (data.files || []).filter((f: any) =>
      allowedMimeTypes.includes(f.mimeType),
    );

    res.json(filteredFiles);
  } catch (error) {
    console.error("Drive API Exception:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 2. Memos
app.get("/api/memos", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM memos ORDER BY created_at DESC");
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/memos error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/memos", async (req, res) => {
  try {
    const { title, body } = req.body;
    if (!title || !body)
      return res.status(400).json({ error: "Title and body are required" });

    const id = uuidv4();
    const result = await pool.query(
      "INSERT INTO memos (id, title, body) VALUES ($1, $2, $3) RETURNING *",
      [id, title, body],
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error("POST /api/memos error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 3. Quotes
app.get("/api/quotes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM quotes ORDER BY created_at DESC",
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/quotes error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 4. Likes
app.get("/api/likes", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT content_id, COUNT(*)::int AS count FROM likes GROUP BY content_id",
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/likes error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/likes/:contentId", async (req, res) => {
  try {
    const { contentId } = req.params;
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: "userId is required" });

    const existing = await pool.query(
      "SELECT 1 FROM likes WHERE content_id = $1 AND user_id = $2",
      [contentId, userId],
    );

    if (existing.rowCount && existing.rowCount > 0) {
      await pool.query("DELETE FROM likes WHERE content_id = $1 AND user_id = $2", [
        contentId,
        userId,
      ]);
      res.json({ liked: false });
    } else {
      await pool.query("INSERT INTO likes (content_id, user_id) VALUES ($1, $2)", [
        contentId,
        userId,
      ]);
      res.json({ liked: true });
    }
  } catch (e) {
    console.error("POST /api/likes/:contentId error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// 5. Comments
app.get("/api/comments/:contentId", async (req, res) => {
  try {
    const { contentId } = req.params;
    const result = await pool.query(
      "SELECT * FROM comments WHERE content_id = $1 ORDER BY created_at ASC",
      [contentId],
    );
    res.json(result.rows);
  } catch (e) {
    console.error("GET /api/comments/:contentId error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/comments/:contentId", async (req, res) => {
  try {
    const { contentId } = req.params;
    const { nickname, text } = req.body;

    if (!nickname || !text)
      return res.status(400).json({ error: "Nickname and text are required" });

    const id = uuidv4();
    const result = await pool.query(
      "INSERT INTO comments (id, content_id, nickname, text) VALUES ($1, $2, $3, $4) RETURNING *",
      [id, contentId, nickname, text],
    );

    res.status(201).json(result.rows[0]);
  } catch (e) {
    console.error("POST /api/comments/:contentId error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Vite middleware for development
async function startServer() {
  // init DB first
  try {
    await initDb();
  } catch (e) {
    console.error("DB init failed:", e);
    // In production you might want to exit; but keep behavior simple here.
  }

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();