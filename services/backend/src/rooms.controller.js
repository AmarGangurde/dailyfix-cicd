import Database from "better-sqlite3";

import { DB_PATH } from "../../dbpath.js";
const db = new Database(DB_PATH);


export function listRooms(req, res) {
  const rows = db.prepare(`
    SELECT DISTINCT room FROM messages ORDER BY ts DESC
  `).all();
  res.json(rows.map(r => r.room));
}

export function getRoomMessages(req, res) {
  const rows = db.prepare(`
    SELECT * FROM messages WHERE room = ?
    ORDER BY ts ASC LIMIT 500
  `).all(req.params.roomId);

  res.json(rows);
}
