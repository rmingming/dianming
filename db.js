const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'dianming.db');

let db = null;
let SQL = null;

async function init() {
  SQL = await initSqlJs();

  // Ensure data directory exists
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Enable WAL mode for better concurrent access
  db.run('PRAGMA journal_mode=WAL');
  db.run('PRAGMA foreign_keys=ON');

  // ── Create tables ──

  db.run(`
    CREATE TABLE IF NOT EXISTS teachers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      teacher_id INTEGER NOT NULL REFERENCES teachers(id),
      name TEXT NOT NULL,
      password TEXT NOT NULL,
      max_row INTEGER NOT NULL DEFAULT 10,
      max_col INTEGER NOT NULL DEFAULT 10,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      ended_at TEXT
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id),
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      UNIQUE(course_id, student_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS checkins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL REFERENCES courses(id),
      student_id TEXT NOT NULL,
      name TEXT NOT NULL,
      row INTEGER NOT NULL,
      col INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      reset_at TEXT
    )
  `);

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_checkins_course ON checkins(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_checkins_active ON checkins(course_id, student_id) WHERE reset_at IS NULL`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_courses_teacher ON courses(teacher_id)`);

  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** Execute a write query (INSERT/UPDATE/DELETE). Auto-saves. */
function run(sql, params = []) {
  try {
    db.run(sql, params);
    save();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** Insert and return the last insert rowid */
function insert(sql, params = []) {
  try {
    db.run(sql, params);
    // Use exec to get last_insert_rowid (more reliable than stmt.getAsObject in sql.js)
    const result = db.exec('SELECT last_insert_rowid()');
    const id = (result.length > 0 && result[0].values.length > 0)
      ? result[0].values[0][0]
      : 0;
    save();
    return { success: true, id };
  } catch (err) {
    return { success: false, error: err.message, id: 0 };
  }
}

/** Get a single row as an object */
function get(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const result = stmt.step() ? stmt.getAsObject() : null;
    stmt.free();
    return result;
  } catch (err) {
    // For UNIQUE constraint violations etc, re-throw
    if (err.message && err.message.includes('UNIQUE constraint failed')) {
      return null;
    }
    return null;
  }
}

/** Get all matching rows as an array of objects */
function all(sql, params = []) {
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  } catch (err) {
    return [];
  }
}

/** Run inside a transaction. Callback receives {run, get, all}. Auto-saves. */
function transaction(fn) {
  db.run('BEGIN');
  try {
    fn({ run, get, all });
    db.run('COMMIT');
    save();
    return true;
  } catch (err) {
    db.run('ROLLBACK');
    return false;
  }
}

/** Get raw db instance (for special cases) */
function getDb() {
  return db;
}

module.exports = { init, save, run, insert, get, all, transaction, getDb };
