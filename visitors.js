const { DatabaseSync } = require('node:sqlite');
const { createHash } = require('node:crypto');
const dayInSeoul = (now = Date.now()) => new Date(Number(now) + 9 * 3600000).toISOString().slice(0, 10);

function openCounter(file, clock = Date.now) {
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS seen(day TEXT NOT NULL, token TEXT NOT NULL, PRIMARY KEY(day,token));
    CREATE TABLE IF NOT EXISTS totals(day TEXT PRIMARY KEY, visitors INTEGER NOT NULL);
  `);
  const purge = db.prepare('DELETE FROM seen WHERE day < ?');
  const insert = db.prepare('INSERT OR IGNORE INTO seen(day,token) VALUES(?,?)');
  const increment = db.prepare('INSERT INTO totals(day,visitors) VALUES(?,1) ON CONFLICT(day) DO UPDATE SET visitors=visitors+1');
  const read = db.prepare('SELECT visitors FROM totals WHERE day=?');
  function snapshot(visit) {
    const day = dayInSeoul(clock());
    db.exec('BEGIN IMMEDIATE');
    try {
      purge.run(day);
      if (visit?.day === day) {
        const hash = createHash('sha256').update(day + ':' + visit.token).digest('hex');
        if (insert.run(day, hash).changes) increment.run(day);
      }
      const count = read.get(day)?.visitors ?? 0;
      db.exec('COMMIT');
      return { day, count };
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return { snapshot, close: () => db.close() };
}
module.exports = { openCounter, dayInSeoul };
