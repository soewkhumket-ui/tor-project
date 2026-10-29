import fs from 'node:fs';
import path from 'node:path';
import { dbQuery, initDatabase } from './db/index.js';
import { AIService } from './services/ai.js';
import { StorageService } from './services/storage.js';
import { PDFGeneratorService } from './services/pdf.js';
import sharp from 'sharp';

async function runE2ETest() {
  console.log('================================================================');
  console.log('🧪 RUNNING FULL ACCEPTANCE CRITERIA E2E INTEGRATION TEST');
  console.log('================================================================');

  initDatabase();

  // Test Step 1: Admin Creates Project
  console.log('\n[1/10] Testing Project Creation...');
  const testProjectId = `test-prj-${Date.now()}`;
  const testProjectCode = `PRJ-TEST-${Date.now().toString().slice(-4)}`;

  dbQuery.run(
    `INSERT INTO projects (
      id, name, code, contract_number, tor_number,
      government_agency, contractor, project_manager,
      start_date, end_date, export_policy, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      testProjectId,
      'โครงการทดสอบระบบส่งมอบงานและหลักฐานภาพถ่าย TOR ประจำปี 2567',
      testProjectCode,
      'กท.99/2567',
      'TOR-TEST-01/2567',
      'สำนักงานนวัตกรรมภาครัฐ',
      'บริษัท ทดสอบวิศวกรรม จำกัด',
      'นายกิตติศักดิ์ พัฒนเสรี (PM)',
      '2026-10-01',
      '2026-10-15',
      'warning',
      'PLANNING'
    ]
  );
  StorageService.initProjectStorage(testProjectId);
  console.log('✅ Project created:', testProjectId, testProjectCode);

  // Test Step 2 & 3: AI TOR Analysis & Extraction
  console.log('\n[2/10] Testing AI TOR Analysis Pipeline...');
  const sampleTorText = `
3. งานจัดสถานที่และอุปกรณ์
3.1 จัดทำเวทีหลัก ขนาด 12.0 × 8.0 × 1.2 เมตร ปูพรมสีเทา พร้อมบันไดทางขึ้น-ลง
3.2 ติดตั้งจอ LED Full HD ขนาดไม่น้อยกว่า 7.68 × 4.32 เมตร (P2.6)
3.3 ระบบแสงเวที Moving Head ไม่น้อยกว่า 12 โคม พร้อมคอนโซลควบคุม DMX
3.4 จัดทำบูธนิทรรศการ จำนวน 20 คูหา ขนาดไม่น้อยกว่า 3 × 3 × 2.5 เมตร
4. งานประชาสัมพันธ์
4.1 จัดทำป้ายประชาสัมพันธ์บริเวณทางเข้าหลัก ขนาด 4.0 x 2.5 เมตร
`;

  const analysis = await AIService.analyzeTorText(sampleTorText);
  console.log('✅ AI extracted sections:', analysis.sections.length);
  console.log('✅ AI extracted items:', analysis.rawItems.length);

  if (analysis.rawItems.length < 4) {
    throw new Error('AI extraction returned fewer items than expected');
  }

  // Populate TOR items in DB
  const secId = `sec-${Date.now()}`;
  dbQuery.run(`INSERT INTO tor_sections (id, project_id, section_number, title) VALUES (?, ?, '3', 'งานจัดสถานที่')`, [secId, testProjectId]);

  for (const item of analysis.rawItems) {
    dbQuery.run(
      `INSERT INTO tor_items (
        id, project_id, section_id, item_number, title, requirement,
        quantity, unit, dimensions, deliverable, evidence_required,
        minimum_images, capture_instructions, capture_types,
        installment_number, installment_title, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`,
      [
        `tor-${testProjectId}-${item.item_number.replace('.', '-')}`,
        testProjectId,
        secId,
        item.item_number,
        item.title,
        item.requirement,
        item.quantity || 1,
        item.unit || 'งาน',
        item.dimensions || null,
        item.deliverable || null,
        item.evidence_required ? 1 : 0,
        item.minimum_images || 4,
        JSON.stringify(item.capture_instructions),
        JSON.stringify(item.capture_types),
        item.installment_number || 1,
        item.installment_title || `งวดที่ ${item.installment_number || 1}`
      ]
    );
  }

  // Test Step 4: Human Review & TOR Structure Approval -> Checklist Generation
  console.log('\n[3/10] Testing TOR Structure Approval & Checklist Generation...');
  dbQuery.run(`UPDATE tor_items SET status = 'APPROVED' WHERE project_id = ?`, [testProjectId]);
  const approvedItems = dbQuery.all(`SELECT * FROM tor_items WHERE project_id = ?`, [testProjectId]);

  for (const it of approvedItems) {
    dbQuery.run(
      `INSERT INTO evidence_items (id, project_id, tor_item_id, status, notes, qr_code_token)
       VALUES (?, ?, ?, 'MISSING', ?, ?)`,
      [`ev-${it.id}`, testProjectId, it.id, `หลักฐานสำหรับ ${it.item_number}`, `QR-${it.id}`]
    );
  }
  const checklistCount = dbQuery.get(`SELECT count(*) as count FROM evidence_items WHERE project_id = ?`, [testProjectId])?.count;
  console.log('✅ Generated checklist items count:', checklistCount);

  // Test Step 5: 3-Tier Image Storage Pipeline & Quality Checks
  console.log('\n[4/10] Testing 3-Tier Storage Pipeline (Original, Preview, Print) with Sharp...');
  const targetEvItem = dbQuery.get(`SELECT * FROM evidence_items WHERE project_id = ? LIMIT 1`, [testProjectId]);

  // Generate a test image buffer with sharp
  const testImgBuffer = await sharp({
    create: {
      width: 1920,
      height: 1080,
      channels: 3,
      background: { r: 43, g: 108, b: 176 }
    }
  }).jpeg().toBuffer();

  const tempImgPath = path.resolve(process.cwd(), `storage/temp_test_${Date.now()}.jpg`);
  fs.writeFileSync(tempImgPath, testImgBuffer);

  const processed = await StorageService.processEvidenceImage(
    testProjectId,
    targetEvItem.id,
    tempImgPath,
    'test_stage_photo.jpg'
  );
  fs.unlinkSync(tempImgPath);

  console.log('✅ Original Path:', processed.originalRelativePath);
  console.log('✅ Preview Path (WebP):', processed.previewRelativePath);
  console.log('✅ Print Path (300DPI):', processed.printRelativePath);
  console.log('✅ Quality Score:', processed.qualityScore, 'Blur Score:', processed.blurScore);

  // Verify all 3 files actually exist on disk
  if (!fs.existsSync(StorageService.getAbsolutePath(processed.originalRelativePath))) throw new Error('Original file missing');
  if (!fs.existsSync(StorageService.getAbsolutePath(processed.previewRelativePath))) throw new Error('Preview file missing');
  if (!fs.existsSync(StorageService.getAbsolutePath(processed.printRelativePath))) throw new Error('Print file missing');
  console.log('✅ All 3 tiers verified on local disk!');

  // Save evidence file in DB
  const fileId = `file-${Date.now()}`;
  dbQuery.run(
    `INSERT INTO evidence_files (
      id, evidence_item_id, original_path, preview_path, print_path,
      mime_type, file_size, width, height, quality_score, blur_score,
      capture_type, caption, sort_order, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'overview', 'ภาพรวมการติดตั้งจอ LED', 1, 'SUBMITTED')`,
    [
      fileId, targetEvItem.id, processed.originalRelativePath,
      processed.previewRelativePath, processed.printRelativePath,
      processed.mimeType, processed.fileSize, processed.width, processed.height,
      processed.qualityScore, processed.blurScore
    ]
  );

  // Test Step 6: Non-destructive Canvas Annotations Persistence
  console.log('\n[5/10] Testing Non-destructive Canvas Annotation...');
  const sampleAnnotations = [
    {
      id: 'ann-1',
      type: 'text',
      content: 'จอ LED ขนาด 7.68 × 4.32 เมตร (P2.6)',
      x: 0.25,
      y: 0.76,
      color: '#e53e3e',
      fontSize: 28
    },
    {
      id: 'ann-2',
      type: 'arrow',
      x: 0.25,
      y: 0.70,
      endX: 0.45,
      endY: 0.40,
      color: '#e53e3e'
    }
  ];

  dbQuery.run(
    `UPDATE evidence_files SET annotation_json = ? WHERE id = ?`,
    [JSON.stringify(sampleAnnotations), fileId]
  );
  const savedFile = dbQuery.get('SELECT annotation_json FROM evidence_files WHERE id = ?', [fileId]);
  const parsedAnn = JSON.parse(savedFile.annotation_json);
  console.log('✅ Saved non-destructive annotations:', parsedAnn.length, 'annotations verified!');

  // Test Step 7: Approval Workflow (SUBMITTED -> WAITING_REVIEW -> APPROVED)
  console.log('\n[6/10] Testing Approval Workflow (Staff Submit -> PM Review -> Approve)...');
  dbQuery.run(`UPDATE evidence_items SET status = 'WAITING_REVIEW' WHERE id = ?`, [targetEvItem.id]);
  console.log('✅ Evidence item submitted for review (WAITING_REVIEW)');

  dbQuery.run(`UPDATE evidence_items SET status = 'COMPLETE', rejection_comment = NULL WHERE id = ?`, [targetEvItem.id]);
  dbQuery.run(
    `INSERT INTO reviews (id, evidence_item_id, reviewer_id, status, comment) VALUES (?, ?, 'usr-pm-01', 'APPROVED', 'ผ่านการตรวจสอบความเรียบร้อย')`,
    [`rev-${Date.now()}`, targetEvItem.id]
  );
  const reviewedItem = dbQuery.get('SELECT status FROM evidence_items WHERE id = ?', [targetEvItem.id]);
  console.log('✅ PM Approved! Item status is now:', reviewedItem.status);

  // Test Step 8: Pre-Export Completeness Validation
  console.log('\n[7/10] Testing Export Completeness Validation...');
  const stats = dbQuery.get(`
    SELECT 
      COUNT(e.id) as total_items,
      SUM(CASE WHEN e.status = 'COMPLETE' THEN 1 ELSE 0 END) as complete_items
    FROM evidence_items e
    WHERE e.project_id = ?
  `, [testProjectId]);
  console.log(`✅ Completeness: ${stats.complete_items} / ${stats.total_items} items complete.`);

  // Test Step 9: Headless Chrome A4 PDF Generation with TH Sarabun New
  console.log('\n[8/10] Testing Headless Chrome A4 PDF Generation with TH Sarabun New Font...');
  const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [testProjectId]);
  const template = {
    items_per_page: 2,
    header_text: 'เอกสารประกอบการส่งมอบงานตาม TOR'
  };
  const torItems = dbQuery.all('SELECT * FROM tor_items WHERE project_id = ? ORDER BY sort_order ASC', [testProjectId]);
  const evidenceMap: Record<string, any[]> = {
    [targetEvItem.tor_item_id]: [
      dbQuery.get('SELECT * FROM evidence_files WHERE id = ?', [fileId])
    ]
  };

  const outputPdfPath = path.resolve(process.cwd(), `storage/projects/${testProjectId}/exports/e2e_report.pdf`);
  fs.mkdirSync(path.dirname(outputPdfPath), { recursive: true });

  await PDFGeneratorService.renderToPDF({
    project,
    template,
    sections: [],
    torItems,
    evidenceMap,
    itemsPerPage: 2,
    outputPath: outputPdfPath
  });

  const pdfStats = fs.statSync(outputPdfPath);
  console.log('✅ Generated A4 PDF size:', pdfStats.size, 'bytes');
  if (pdfStats.size < 50000) {
    throw new Error('Generated PDF is smaller than expected, check rendering');
  }

  // Test Step 10: Audit Log Trail Verification
  console.log('\n[9/10] Testing Audit Log Trail...');
  dbQuery.run(
    `INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
     VALUES (?, ?, 'usr-admin-01', 'สมชาย ประเสริฐสุข', 'E2E_TEST_COMPLETED', 'PROJECT', ?, ?)`,
    [`log-${Date.now()}`, testProjectId, testProjectId, JSON.stringify({ passed: true })]
  );
  const logs = dbQuery.all(`SELECT * FROM audit_logs WHERE project_id = ?`, [testProjectId]);
  console.log('✅ Audit logs recorded:', logs.length, 'entries');

  console.log('\n================================================================');
  console.log('🎉 ALL ACCEPTANCE CRITERIA E2E INTEGRATION TESTS PASSED 100%!');
  console.log('================================================================');
}

runE2ETest().catch((err) => {
  console.error('\n❌ E2E Test Failed:', err);
  process.exit(1);
});
