import { Router, Request, Response } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { dbQuery } from '../db/index.js';
import { PDFGeneratorService } from '../services/pdf.js';
import { STORAGE_ROOT } from '../services/storage.js';
import { getCurrentUser } from './auth.js';

export const reportsRouter = Router();

// GET report template and configured sections for a project
reportsRouter.get('/projects/:id/report-templates', (req: Request, res: Response) => {
  const { id: projectId } = req.params;

  let template = dbQuery.get('SELECT * FROM report_templates WHERE project_id = ? ORDER BY is_default DESC LIMIT 1', [projectId]);
  if (!template) {
    // Create default template if none exists
    const tplId = uuidv4();
    dbQuery.run(
      `INSERT INTO report_templates (id, project_id, name, page_size, orientation, font_family, items_per_page, is_default)
       VALUES (?, ?, 'แบบรายงานมาตรฐาน (2 รายการ/หน้า)', 'A4', 'portrait', 'TH Sarabun New', 2, 1)`,
      [tplId, projectId]
    );
    template = dbQuery.get('SELECT * FROM report_templates WHERE id = ?', [tplId]);
  }

  const sections = dbQuery.all('SELECT * FROM report_sections WHERE template_id = ? ORDER BY sort_order ASC', [template.id]);

  res.json({ template, sections });
});

// PATCH update report template (items_per_page, headers, margins)
reportsRouter.patch('/projects/:id/report-template', (req: Request, res: Response) => {
  const { id: projectId } = req.params;
  const template = dbQuery.get('SELECT * FROM report_templates WHERE project_id = ? LIMIT 1', [projectId]);
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const allowed = ['name', 'items_per_page', 'header_text', 'footer_text', 'show_page_number', 'margin_top_mm', 'margin_left_mm'];
  const updates: string[] = [];
  const params: any[] = [];

  for (const k of allowed) {
    if (req.body[k] !== undefined) {
      updates.push(`${k} = ?`);
      params.push(req.body[k]);
    }
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(template.id);
    dbQuery.run(`UPDATE report_templates SET ${updates.join(', ')} WHERE id = ?`, params);
  }

  res.json({ success: true });
});

// POST Validate export completeness
reportsRouter.post('/projects/:id/validate-export', (req: Request, res: Response) => {
  const { id: projectId } = req.params;
  const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const stats = dbQuery.get(`
    SELECT 
      COUNT(e.id) as total_items,
      SUM(CASE WHEN e.status = 'COMPLETE' THEN 1 ELSE 0 END) as complete_items,
      SUM(CASE WHEN e.status != 'COMPLETE' AND e.status != 'NOT_REQUIRED' THEN 1 ELSE 0 END) as missing_items
    FROM evidence_items e
    WHERE e.project_id = ?
  `, [projectId]);

  const total = stats?.total_items || 0;
  const complete = stats?.complete_items || 0;
  const missing = stats?.missing_items || 0;

  const policy = project.export_policy || 'warning'; // 'warning' | 'hard_lock'
  let canExport = true;
  let status: 'PASSED' | 'WARNING' | 'LOCKED' = 'PASSED';
  let message = 'หลักฐานภาพถ่ายครบถ้วนสมบูรณ์ พร้อมส่งมอบงาน';

  if (missing > 0) {
    if (policy === 'hard_lock') {
      canExport = false;
      status = 'LOCKED';
      message = `ยังขาดหลักฐานอีก ${missing} รายการ ระบบเปิดใช้งานนโยบาย Hard Lock (ไม่อนุญาตให้ออกรายงานจนกว่าจะครบ)`;
    } else {
      canExport = true;
      status = 'WARNING';
      message = `แจ้งเตือน: ยังมีหลักฐานไม่สมบูรณ์ ${missing} รายการ ต้องการส่งออกรายงานต่อหรือไม่?`;
    }
  }

  res.json({
    total,
    complete,
    missing,
    policy,
    canExport,
    status,
    message
  });
});

// GET WYSIWYG Report Preview data
reportsRouter.get('/projects/:id/report-preview', (req: Request, res: Response) => {
  const { id: projectId } = req.params;
  const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const installmentFilter = req.query.installment ? parseInt(req.query.installment as string, 10) : undefined;
  const template = dbQuery.get('SELECT * FROM report_templates WHERE project_id = ? LIMIT 1', [projectId]);

  let sql = 'SELECT * FROM tor_items WHERE project_id = ? AND deleted_at IS NULL';
  const params: any[] = [projectId];
  if (installmentFilter) {
    sql += ' AND installment_number = ?';
    params.push(installmentFilter);
  }
  sql += ' ORDER BY sort_order ASC';
  const torItems = dbQuery.all(sql, params);

  const files = dbQuery.all(`
    SELECT f.*, t.id as tor_item_id
    FROM evidence_files f
    JOIN evidence_items e ON f.evidence_item_id = e.id
    JOIN tor_items t ON e.tor_item_id = t.id
    WHERE e.project_id = ? AND f.deleted_at IS NULL AND f.is_hidden = 0
    ORDER BY f.sort_order ASC
  `, [projectId]);

  const evidenceMap: Record<string, any[]> = {};
  for (const f of files) {
    if (!evidenceMap[f.tor_item_id]) evidenceMap[f.tor_item_id] = [];
    evidenceMap[f.tor_item_id].push({
      ...f,
      annotation_json: f.annotation_json ? JSON.parse(f.annotation_json) : []
    });
  }

  res.json({
    project,
    template,
    torItems,
    evidenceMap
  });
});

// POST Export official A4 PDF report
reportsRouter.post('/projects/:id/export-pdf', async (req: Request, res: Response) => {
  const projectId = String(req.params.id);
  const { overrideReason, itemsPerPage, installment } = req.body;

  const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const user = getCurrentUser();
  const template = dbQuery.get('SELECT * FROM report_templates WHERE project_id = ? LIMIT 1', [projectId]) || {
    items_per_page: 2,
    header_text: 'เอกสารประกอบการส่งมอบงานตาม TOR'
  };

  const installmentNum = installment ? parseInt(installment, 10) : undefined;
  let sql = 'SELECT * FROM tor_items WHERE project_id = ? AND deleted_at IS NULL';
  const params: any[] = [projectId];
  if (installmentNum) {
    sql += ' AND installment_number = ?';
    params.push(installmentNum);
  }
  sql += ' ORDER BY sort_order ASC';
  const torItems = dbQuery.all(sql, params);

  const files = dbQuery.all(`
    SELECT f.*, t.id as tor_item_id
    FROM evidence_files f
    JOIN evidence_items e ON f.evidence_item_id = e.id
    JOIN tor_items t ON e.tor_item_id = t.id
    WHERE e.project_id = ? AND f.deleted_at IS NULL AND f.is_hidden = 0
    ORDER BY f.sort_order ASC
  `, [projectId]);

  const evidenceMap: Record<string, any[]> = {};
  for (const f of files) {
    if (!evidenceMap[f.tor_item_id]) evidenceMap[f.tor_item_id] = [];
    evidenceMap[f.tor_item_id].push(f);
  }

  // Ensure export directory exists
  const exportDir = path.join(STORAGE_ROOT, 'projects', projectId, 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const outputPdfPath = path.join(exportDir, `TOR_Handover_Report_${project.code}_${Date.now()}.pdf`);

  try {
    await PDFGeneratorService.renderToPDF({
      project,
      template,
      sections: [],
      torItems,
      evidenceMap,
      selectedInstallment: installmentNum,
      itemsPerPage: itemsPerPage || template.items_per_page || 2,
      outputPath: outputPdfPath
    });

    const reportId = uuidv4();
    dbQuery.run(
      `INSERT INTO generated_reports (
        id, project_id, template_id, name, pdf_path,
        total_items, complete_items, missing_items,
        validation_status, override_reason, generated_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        reportId,
        projectId,
        template.id || null,
        `รายงานส่งมอบงาน ${project.name}`,
        path.relative(STORAGE_ROOT, outputPdfPath).replace(/\\/g, '/'),
        torItems.length,
        torItems.length,
        0,
        overrideReason ? 'WARNING_OVERRIDDEN' : 'PASSED',
        overrideReason || null,
        user.id
      ]
    );

    // Audit log
    dbQuery.run(
      `INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
       VALUES (?, ?, ?, ?, 'REPORT_PDF_EXPORTED', 'REPORT', ?, ?)`,
      [uuidv4(), projectId, user.id, user.name, reportId, JSON.stringify({ pdf: path.basename(outputPdfPath) })]
    );

    // Stream download PDF file
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="TOR_Handover_Report_${project.code}.pdf"`);
    const fileStream = fs.createReadStream(outputPdfPath);
    fileStream.pipe(res);
  } catch (err: any) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: err.message || 'Failed to generate PDF' });
  }
});
