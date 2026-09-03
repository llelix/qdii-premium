const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.QDII_DB_PATH || path.join(__dirname, '..', 'data', 'qdii.db');

function openDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) reject(err);
      else resolve(db);
    });
  });
}

function initDb(db) {
  return new Promise((resolve, reject) => {
    db.run(
      `CREATE TABLE IF NOT EXISTS fund_snapshots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL,
        name TEXT,
        idx TEXT,
        price REAL,
        nav REAL,
        premium REAL,
        nav_date TEXT,
        index_change REAL,
        raw TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )`,
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function saveFunds(db, funds) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `INSERT INTO fund_snapshots (code, name, idx, price, nav, premium, nav_date, index_change, raw)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    let completed = 0;
    const total = funds.length;

    if (total === 0) {
      stmt.finalize();
      resolve();
      return;
    }

    funds.forEach((f) => {
      stmt.run(
        f.code,
        f.name || null,
        f.index || null,
        f.price || null,
        f.nav || null,
        f.realTimePremium || f.latestPremium || f.premium || null,
        f.navDate || null,
        f.indexChange || null,
        f.raw ? JSON.stringify(f.raw) : null,
        (err) => {
          if (err) console.error(`Failed to save fund ${f.code}:`, err.message);
          completed++;
          if (completed === total) {
            stmt.finalize((finalizeErr) => {
              if (finalizeErr) reject(finalizeErr);
              else resolve();
            });
          }
        }
      );
    });
  });
}

async function ensureDb() {
  const db = await openDb();
  await initDb(db);
  return db;
}

async function saveSnapshot(funds) {
  const db = await ensureDb();
  await saveFunds(db, funds);
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

function getLatestSnapshot(db) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT s.code, s.name, s.idx, s.price, s.nav, s.premium, s.nav_date, s.index_change, s.raw, s.created_at
       FROM fund_snapshots s
       INNER JOIN (
         SELECT code, MAX(datetime(created_at)) AS max_created
         FROM fund_snapshots
         GROUP BY code
       ) latest ON s.code = latest.code AND datetime(s.created_at) = latest.max_created`,
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function parseSnapshotRow(row) {
  let raw = null;
  if (row.raw) {
    try {
      raw = JSON.parse(row.raw);
    } catch (e) {
      raw = null;
    }
  }

  let indexChange = null;
  if (row.index_change !== null && row.index_change !== undefined) {
    indexChange = Number(row.index_change);
  }

  return {
    code: row.code,
    name: row.name,
    index: row.idx,
    realTimePremium: row.premium,
    latestPremium: row.premium,
    navDate: row.nav_date,
    indexChange,
    price: row.price,
    nav: row.nav,
    raw
  };
}

async function loadLatestFunds() {
  const db = await ensureDb();
  const rows = await getLatestSnapshot(db);
  const funds = rows.map(parseSnapshotRow);
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve(funds);
    });
  });
}

async function getFundHistory(code, limit = 50) {
  const db = await ensureDb();
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT code, name, idx, price, nav, premium, nav_date, index_change, created_at
       FROM fund_snapshots
       WHERE code = ?
       ORDER BY datetime(created_at) DESC
       LIMIT ?`,
      [code, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });
}

function parseHistoryRow(row) {
  let indexChange = null;
  if (row.index_change !== null && row.index_change !== undefined) {
    indexChange = Number(row.index_change);
  }

  return {
    code: row.code,
    name: row.name,
    index: row.idx,
    realTimePremium: row.premium,
    latestPremium: row.premium,
    navDate: row.nav_date,
    indexChange,
    price: row.price,
    nav: row.nav,
    createdAt: row.created_at
  };
}

async function loadFundHistory(code, limit = 50) {
  const db = await ensureDb();
  const rows = await getFundHistory(code, limit);
  const funds = rows.map(parseHistoryRow);
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) reject(err);
      else resolve(funds);
    });
  });
}

module.exports = {
  ensureDb,
  saveSnapshot,
  loadLatestFunds,
  loadFundHistory,
};
