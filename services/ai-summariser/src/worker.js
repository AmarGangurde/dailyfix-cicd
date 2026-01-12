import dotenv from "dotenv";
dotenv.config({ path: new URL("../.env", import.meta.url) });

import Database from "better-sqlite3";
import fetch from "node-fetch";
import { DB_PATH } from "../../dbpath.js";

const [, , b64, room] = process.argv;
if (!b64 || !room) process.exit(0);

const text = Buffer.from(b64, "base64").toString().slice(0, 4000);

console.log("Worker started for", room);
console.log("Text length:", text.length);

const response = await fetch(
  "https://router.huggingface.co/hf-inference/models/facebook/bart-large-cnn",
  {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.HF_TOKEN.trim()}`,
      "Content-Type": "application/json",
      "User-Agent": "matrix-ai-dashboard"
    },
    body: JSON.stringify({
      inputs: text,
      parameters: {
        max_length: 160,
        min_length: 60,
        do_sample: false
      }
    })
  }
);

const raw = await response.json();
console.log("HF RAW:", raw);

const summary = raw[0]?.summary_text;
if (!summary) {
  console.error("HF did not return a summary. Check your HF token.");
  process.exit(1);
}

const db = new Database(DB_PATH);
db.prepare(`
  INSERT OR REPLACE INTO summaries (room, summary, ts)
  VALUES (?, ?, ?)
`).run(room, summary, Date.now());

console.log("Summary stored successfully.");
