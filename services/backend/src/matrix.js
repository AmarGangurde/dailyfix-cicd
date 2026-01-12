import sdk from "matrix-js-sdk";
import Database from "better-sqlite3";


import { DB_PATH } from "../../dbpath.js";
const db = new Database(DB_PATH);


db.exec(`
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  room TEXT,
  sender TEXT,
  body TEXT,
  ts INTEGER
);
`);

const client = sdk.createClient({
  baseUrl: process.env.MATRIX_BASE_URL,
  accessToken: process.env.MATRIX_ACCESS_TOKEN,
  userId: process.env.MATRIX_USER_ID
});

export async function startMatrix() {
  console.log("Starting Matrix sync engine...");
  await client.startClient({ initialSyncLimit: 50 });

  client.on("Room.timeline", (event, room) => {
    if (event.getType() !== "m.room.message") return;
    if (!event.getContent()?.body) return;

    db.prepare(`
      INSERT OR IGNORE INTO messages (id, room, sender, body, ts)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      event.getId(),
      room.roomId,
      event.getSender(),
      event.getContent().body,
      event.getTs()
    );
    db.exec(`
CREATE TABLE IF NOT EXISTS summaries (
  room TEXT PRIMARY KEY,
  summary TEXT,
  ts INTEGER
);
`);

  });
}
