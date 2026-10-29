import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, '../storage/tor_evidence.sqlite');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF;'); // Turn off FKs for bulk clean

const testProjects = db.prepare("SELECT id, code, name FROM projects WHERE code LIKE 'PRJ-TEST-%'").all();
console.log('Found test projects to clean:', testProjects.length);

for (const p of testProjects) {
  console.log(`Deleting test project: ${p.code} (${p.id})`);
  db.prepare("DELETE FROM evidence_files WHERE evidence_item_id IN (SELECT id FROM evidence_items WHERE project_id = ?)").run(p.id);
  db.prepare("DELETE FROM reviews WHERE evidence_item_id IN (SELECT id FROM evidence_items WHERE project_id = ?)").run(p.id);
  db.prepare("DELETE FROM evidence_items WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM tor_items WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM tor_sections WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM tor_documents WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM project_members WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM generated_reports WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM audit_logs WHERE project_id = ?").run(p.id);
  db.prepare("DELETE FROM projects WHERE id = ?").run(p.id);

  // Clean folder if exists
  const projectStorage = path.resolve(__dirname, '../storage/projects', p.id);
  if (fs.existsSync(projectStorage)) {
    try {
      fs.rmSync(projectStorage, { recursive: true, force: true });
    } catch (e) {
      console.warn('Storage cleanup warning:', e.message);
    }
  }
}

db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
db.exec('VACUUM;');

const remaining = db.prepare('SELECT id, code, name, created_at FROM projects').all();
console.log('Clean up complete. Remaining projects:');
console.log(JSON.stringify(remaining, null, 2));
