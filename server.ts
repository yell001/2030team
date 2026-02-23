import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

// Initialize SQLite Database
let db = new Database("app.db");

const schema = `
  CREATE TABLE IF NOT EXISTS memos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quotes (
    id TEXT PRIMARY KEY,
    person_name TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS likes (
    content_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (content_id, user_id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    content_id TEXT NOT NULL,
    nickname TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

try {
  // Create tables
  db.exec(schema);
} catch (err: any) {
  if (err.message.includes("file is not a database")) {
    console.warn("app.db is corrupted or not a database. Recreating...");
    db.close();
    if (fs.existsSync("app.db")) {
      fs.unlinkSync("app.db");
    }
    db = new Database("app.db");
    db.exec(schema);
  } else {
    throw err;
  }
}

// Seed quotes if empty
const quotesCount = db
  .prepare("SELECT COUNT(*) as count FROM quotes")
  .get() as { count: number };
if (quotesCount.count === 0) {
  try {
    const seedData = JSON.parse(
      fs.readFileSync(path.resolve("quotes_seed.json"), "utf-8"),
    );
    const insertQuote = db.prepare(
      "INSERT INTO quotes (id, person_name, text) VALUES (?, ?, ?)",
    );

    db.transaction(() => {
      for (const person of seedData) {
        for (const text of person.quotes) {
          insertQuote.run(uuidv4(), person.personName, text);
        }
      }
    })();
    console.log("Seeded quotes from quotes_seed.json");
  } catch (err) {
    console.error("Failed to seed quotes:", err);
  }
}

// API Routes

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

    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&key=${apiKey}&fields=${encodeURIComponent(fields)}&pageSize=1000`;

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
app.get("/api/memos", (req, res) => {
  const memos = db
    .prepare("SELECT * FROM memos ORDER BY created_at DESC")
    .all();
  res.json(memos);
});

app.post("/api/memos", (req, res) => {
  const { title, body } = req.body;
  if (!title || !body)
    return res.status(400).json({ error: "Title and body are required" });

  const id = uuidv4();
  db.prepare("INSERT INTO memos (id, title, body) VALUES (?, ?, ?)").run(
    id,
    title,
    body,
  );

  const newMemo = db.prepare("SELECT * FROM memos WHERE id = ?").get(id);
  res.status(201).json(newMemo);
});

// 3. Quotes
app.get("/api/quotes", (req, res) => {
  const quotes = db
    .prepare("SELECT * FROM quotes ORDER BY created_at DESC")
    .all();
  res.json(quotes);
});

// 4. Likes
app.get("/api/likes", (req, res) => {
  // Get all likes grouped by content_id
  const likes = db
    .prepare(
      "SELECT content_id, COUNT(*) as count FROM likes GROUP BY content_id",
    )
    .all();
  res.json(likes);
});

app.post("/api/likes/:contentId", (req, res) => {
  const { contentId } = req.params;
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: "userId is required" });

  // Toggle like
  const existing = db
    .prepare("SELECT * FROM likes WHERE content_id = ? AND user_id = ?")
    .get(contentId, userId);

  if (existing) {
    db.prepare("DELETE FROM likes WHERE content_id = ? AND user_id = ?").run(
      contentId,
      userId,
    );
    res.json({ liked: false });
  } else {
    db.prepare("INSERT INTO likes (content_id, user_id) VALUES (?, ?)").run(
      contentId,
      userId,
    );
    res.json({ liked: true });
  }
});

// 5. Comments
app.get("/api/comments/:contentId", (req, res) => {
  const { contentId } = req.params;
  const comments = db
    .prepare(
      "SELECT * FROM comments WHERE content_id = ? ORDER BY created_at ASC",
    )
    .all(contentId);
  res.json(comments);
});

app.post("/api/comments/:contentId", (req, res) => {
  const { contentId } = req.params;
  const { nickname, text } = req.body;

  if (!nickname || !text)
    return res.status(400).json({ error: "Nickname and text are required" });

  const id = uuidv4();
  db.prepare(
    "INSERT INTO comments (id, content_id, nickname, text) VALUES (?, ?, ?, ?)",
  ).run(id, contentId, nickname, text);

  const newComment = db.prepare("SELECT * FROM comments WHERE id = ?").get(id);
  res.status(201).json(newComment);
});

// Vite middleware for development
async function startServer() {
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
