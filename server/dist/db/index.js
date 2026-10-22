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
// Enable WAL mode and foreign keys for high concurrency and relational safety
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
export function initDatabase() {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
    db.exec(schemaSql);
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
