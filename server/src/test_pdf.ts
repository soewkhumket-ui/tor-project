import { PDFGeneratorService } from './services/pdf.js';
import { dbQuery, initDatabase } from './db/index.js';
import path from 'node:path';
import fs from 'node:fs';

initDatabase();

const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', ['prj-event-2567-001']);
const template = dbQuery.get('SELECT * FROM report_templates WHERE project_id = ?', ['prj-event-2567-001']);
const torItems = dbQuery.all('SELECT * FROM tor_items WHERE project_id = ? ORDER BY sort_order ASC', ['prj-event-2567-001']);

const outputPath = path.resolve(process.cwd(), 'storage/test_output.pdf');

console.log('Testing PDF generation for project:', project.name);
PDFGeneratorService.renderToPDF({
  project,
  template,
  sections: [],
  torItems,
  evidenceMap: {},
  outputPath
}).then((resultPath) => {
  const stat = fs.statSync(resultPath);
  console.log('✅ Generated PDF successfully:', resultPath, 'Size:', stat.size, 'bytes');
}).catch(err => {
  console.error('❌ PDF generation failed:', err);
});
