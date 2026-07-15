// Regenerate the sync token (e.g. after losing the one printed at first
// boot). Plain Node so it runs identically on a dev machine and inside the
// Docker container: docker compose exec neurovim node scripts/token-reset.mjs
import { DatabaseSync } from "node:sqlite";
import { createHash, randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import path from "node:path";

const dir = process.env.NEUROVIM_DATA_DIR ?? "./data";
mkdirSync(dir, { recursive: true });
const dbPath = path.resolve(dir, "neurovim.sqlite");
// Print the absolute path so a host ./data vs container /data mismatch is visible.
console.log(`Rotating token in ${dbPath}`);
const db = new DatabaseSync(dbPath);
db.exec(
  "create table if not exists auth_tokens (id integer primary key autoincrement, token_hash text not null, created_at integer not null)",
);
db.exec("delete from auth_tokens");
const token = randomBytes(32).toString("base64url");
db.prepare("insert into auth_tokens (token_hash, created_at) values (?, ?)").run(
  createHash("sha256").update(token).digest("hex"),
  Date.now(),
);
console.log(`New sync token (the old one no longer works):\n\n  ${token}\n`);
