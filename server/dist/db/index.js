import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Database path in storage or server root
const DB_DIR = path.resolve(__dirname, '../../storage');
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
}
const DB_PATH = path.join(DB_DIR, 'tor_evidence.sqlite');
export const db = new DatabaseSync(DB_PATH);
// Flush any existing WAL data into the main .sqlite file and use DELETE journal mode
// so that tor_evidence.sqlite is always a single, complete, Git-friendly file.
try {
    db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    db.exec('PRAGMA journal_mode = DELETE;');
}
catch {
    // Ignore if locked briefly
}
db.exec('PRAGMA foreign_keys = ON;');
export function initDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
    // Auto-migration for installment columns
    try {
        db.exec('ALTER TABLE tor_items ADD COLUMN installment_number INTEGER DEFAULT 1;');
    }
    catch {
        // Column already exists
    }
    try {
        db.exec("ALTER TABLE tor_items ADD COLUMN installment_title TEXT DEFAULT 'งวดที่ 1';");
    }
    catch {
        // Column already exists
    }
    console.log('✅ SQLite Database initialized successfully at:', DB_PATH);
}
// Database helper utilities for query execution
export const dbQuery = {
    all(sql, params = []) {
        const stmt = db.prepare(sql);
        return stmt.all(...params);
    },
    get(sql, params = []) {
        const stmt = db.prepare(sql);
        return stmt.get(...params);
    },
    run(sql, params = []) {
        const stmt = db.prepare(sql);
        return stmt.run(...params);
    },
    exec(sql) {
        return db.exec(sql);
    }
};
