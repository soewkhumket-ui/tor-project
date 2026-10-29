import { PDFGeneratorService } from './services/pdf.js';
import { dbQuery, initDatabase } from './db/index.js';
import path from 'node:path';
import fs from 'node:fs';
initDatabase();
const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', ['prj-event-2567-001']);
const template = dbQuery.get('SELECT * FROM report_templates WHERE project_id = ?', ['prj-event-2567-001']);
const torItems = dbQuery.all('SELECT * FROM tor_items WHERE project_id = ? ORDER BY sort_order ASC', ['prj-event-2567-001']);
const outputPath = path.resolve(process.cwd(), 'storage/test_output.pdf');
// Mock 6 images for the first item to test pagination and "(เพิ่มเติม)"
const firstItemId = torItems[0]?.id;
const mockEvidenceMap = {};
if (firstItemId) {
    mockEvidenceMap[firstItemId] = [
        { original_path: '', caption: 'ภาพรวมมุมกว้างเวทีหลัก', capture_type: 'overview' },
        { original_path: '', caption: 'ภาพรายละเอียดพื้นพรมสีเทา', capture_type: 'detail' },
        { original_path: '', caption: 'ภาพบันไดทางขึ้น-ลงฝั่งซ้าย', capture_type: 'detail' },
        { original_path: '', caption: 'ภาพบันไดทางขึ้น-ลงฝั่งขวา', capture_type: 'detail' },
        { original_path: '', caption: 'ภาพการทดสอบรับน้ำหนักโครงสร้างเวที', capture_type: 'measurement' },
        { original_path: '', caption: 'ภาพการเก็บความเรียบร้อยชายผ้าเวที', capture_type: 'detail' }
    ];
}
console.log('Testing PDF generation for project:', project.name);
console.log('Testing installment summary and pagination with 6 images for item:', firstItemId);
const html = PDFGeneratorService.buildReportHTML({
    project,
    template,
    sections: [],
    torItems,
    evidenceMap: mockEvidenceMap,
    selectedInstallment: 1,
    outputPath
});
if (html.includes('(เพิ่มเติม)')) {
    console.log('✅ HTML correctly contains (เพิ่มเติม) for items exceeding 4 images!');
}
else {
    console.error('❌ (เพิ่มเติม) not found in generated HTML');
}
if (html.includes('สรุปขอบเขตงานและเงื่อนไขการส่งมอบงานประจำงวด')) {
    console.log('✅ HTML correctly contains Installment Summary page!');
}
else {
    console.error('❌ Installment Summary page not found in HTML');
}
if (html.includes('image-grid-borderless')) {
    console.log('✅ HTML correctly uses borderless 2-column image grid!');
}
else {
    console.error('❌ image-grid-borderless not found in HTML');
}
PDFGeneratorService.renderToPDF({
    project,
    template,
    sections: [],
    torItems,
    evidenceMap: mockEvidenceMap,
    selectedInstallment: 1,
    outputPath
}).then((resultPath) => {
    const stat = fs.statSync(resultPath);
    console.log('✅ Generated PDF successfully:', resultPath, 'Size:', stat.size, 'bytes');
}).catch(err => {
    console.error('❌ PDF generation failed:', err);
});
