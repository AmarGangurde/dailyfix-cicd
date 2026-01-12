import { fileURLToPath } from "url";
import Database from "better-sqlite3";
import { spawn } from "child_process";
import path from "path";
import { DB_PATH } from "../../dbpath.js";


const db = new Database(DB_PATH);

export function generateSummary(req, res) {
  const room = decodeURIComponent(req.params.roomId);

  const msgs = db.prepare(`
    SELECT body FROM messages
    WHERE room = ?
    ORDER BY ts DESC LIMIT 100
  `).all(room).reverse();

  const text = msgs.map(m => m.body).join("\n").slice(0, 4000);
  const b64 = Buffer.from(text).toString("base64");

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const workerPath = path.resolve(__dirname, "..", "..", "ai-summariser", "src", "worker.js");

  console.log("Launching AI worker:", workerPath);

  const p = spawn("node", [workerPath, b64, room]);

  p.stdout.on("data", d => console.log("AI:", d.toString()));
  p.stderr.on("data", d => console.error("AI ERR:", d.toString()));

  res.json({ status: "started" });
}


export function getSummary(req, res) {
  const room = decodeURIComponent(req.params.roomId);
  const row = db.prepare(`SELECT summary FROM summaries WHERE room = ?`).get(room);
  res.json(row || { summary: "" });
}
