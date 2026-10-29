import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { dbQuery } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { StorageService, STORAGE_ROOT } from '../services/storage.js';
import { AIService } from '../services/ai.js';
import { getCurrentUser } from './auth.js';

export const projectsRouter = Router();

const tempDir = path.join(STORAGE_ROOT, 'temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const upload = multer({
  dest: tempDir,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// POST Extract Project Metadata + TOR Structure from uploaded file or raw text (Hybrid Pre-fill)
projectsRouter.post('/extract-metadata', upload.single('project_file'), async (req: Request, res: Response) => {
  try {
    let extractedText = '';
    let originalName = 'TOR_Document.txt';
    let mimeType = 'text/plain';
    let tempFileToken: string | null = null;

    if (req.file) {
      let decoded = req.body?.filename || req.file.originalname;
      if (!req.body?.filename) {
        try {
          const candidate = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
          if (!candidate.includes('\uFFFD')) {
            decoded = candidate;
          }
        } catch {}
      }
      originalName = decoded;
      mimeType = req.file.mimetype;
      tempFileToken = path.basename(req.file.path);
      extractedText = await AIService.extractTextFromFile(req.file.path, originalName);
    } else if (req.body.raw_text && String(req.body.raw_text).trim()) {
      extractedText = String(req.body.raw_text);
      originalName = req.body.filename || 'Pasted_TOR.txt';
    } else {
      return res.status(400).json({ error: 'กรุณาอัปโหลดไฟล์โครงการ/TOR หรือวางข้อความเพื่อสกัดข้อมูล' });
    }

    const analysis = await AIService.analyzeTorText(extractedText, originalName);

    // Ensure project code does not collide with an existing project in DB
    let candidateCode = analysis.projectMetadata.code;
    const existing = dbQuery.get('SELECT id FROM projects WHERE code = ?', [candidateCode]);
    if (existing) {
      candidateCode = `${candidateCode}-${Math.floor(10 + Math.random() * 89)}`;
      analysis.projectMetadata.code = candidateCode;
    }

    res.json({
      success: true,
      filename: originalName,
      mimeType,
      tempFileToken,
      projectMetadata: analysis.projectMetadata,
      sections: analysis.sections,
      rawItems: analysis.rawItems,
      extractedTextPreview: extractedText.slice(0, 1000)
    });
  } catch (err: any) {
    console.error('Error extracting project metadata:', err);
    res.status(500).json({ error: err.message || 'ไม่สามารถสกัดข้อมูลจากไฟล์ได้' });
  }
});

// GET all projects with statistics
projectsRouter.get('/', (_req: Request, res: Response) => {
  const projects = dbQuery.all(`SELECT * FROM projects WHERE deleted_at IS NULL ORDER BY created_at DESC`);

  const enrichedProjects = projects.map(p => {
    // Calculate evidence statistics
    const stats = dbQuery.get(`
      SELECT 
        COUNT(e.id) as total_evidence_items,
        SUM(CASE WHEN e.status = 'COMPLETE' THEN 1 ELSE 0 END) as complete,
        SUM(CASE WHEN e.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN e.status = 'MISSING' THEN 1 ELSE 0 END) as missing,
        SUM(CASE WHEN e.status = 'WAITING_REVIEW' THEN 1 ELSE 0 END) as waiting_review,
        SUM(CASE WHEN e.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
      FROM evidence_items e
      WHERE e.project_id = ?
    `, [p.id]);

    const total = stats?.total_evidence_items || 0;
    const complete = stats?.complete || 0;
    const progress = total > 0 ? Math.round((complete / total) * 100) : 0;

    return {
      ...p,
      stats: {
        total,
        complete,
        in_progress: stats?.in_progress || 0,
        missing: stats?.missing || 0,
        waiting_review: stats?.waiting_review || 0,
        rejected: stats?.rejected || 0,
        progress_percent: progress
      }
    };
  });

  res.json({ projects: enrichedProjects });
});

// GET single project details with deep statistics
projectsRouter.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = dbQuery.get(`SELECT * FROM projects WHERE id = ? AND deleted_at IS NULL`, [id]);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const stats = dbQuery.get(`
    SELECT 
      COUNT(e.id) as total_evidence_items,
      SUM(CASE WHEN e.status = 'COMPLETE' THEN 1 ELSE 0 END) as complete,
      SUM(CASE WHEN e.status = 'IN_PROGRESS' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN e.status = 'MISSING' THEN 1 ELSE 0 END) as missing,
      SUM(CASE WHEN e.status = 'WAITING_REVIEW' THEN 1 ELSE 0 END) as waiting_review,
      SUM(CASE WHEN e.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected
    FROM evidence_items e
    WHERE e.project_id = ?
  `, [id]);

  const totalImages = dbQuery.get(`
    SELECT COUNT(f.id) as count
    FROM evidence_files f
    JOIN evidence_items e ON f.evidence_item_id = e.id
    WHERE e.project_id = ? AND f.deleted_at IS NULL
  `, [id])?.count || 0;

  const total = stats?.total_evidence_items || 0;
  const complete = stats?.complete || 0;
  const progress = total > 0 ? Math.round((complete / total) * 100) : 0;

  // Check if TOR structure is approved
  const unapprovedCount = dbQuery.get(
    `SELECT COUNT(*) as count FROM tor_items WHERE project_id = ? AND status = 'DRAFT' AND deleted_at IS NULL`,
    [id]
  )?.count || 0;

  res.json({
    project,
    stats: {
      total,
      complete,
      in_progress: stats?.in_progress || 0,
      missing: stats?.missing || 0,
      waiting_review: stats?.waiting_review || 0,
      rejected: stats?.rejected || 0,
      total_images: totalImages,
      progress_percent: progress,
      is_tor_approved: unapprovedCount === 0 && total > 0
    }
  });
});

// POST create project (supports Hybrid: Manual fields + Auto-imported TOR sections & items)
projectsRouter.post('/', (req: Request, res: Response) => {
  const {
    name,
    code,
    contract_number,
    tor_number,
    government_agency,
    client,
    contractor,
    project_manager,
    start_date,
    end_date,
    inspection_date,
    location,
    description,
    export_policy,
    // Optional Hybrid TOR import payload
    sections,
    auto_create_checklist,
    temp_file_token,
    original_filename,
    mime_type,
    extracted_text
  } = req.body;

  if (!name || !code) {
    return res.status(400).json({ error: 'ชื่อโครงการและรหัสโครงการจำเป็นต้องระบุ' });
  }

  const existing = dbQuery.get('SELECT id FROM projects WHERE code = ?', [code]);
  if (existing) {
    return res.status(400).json({ error: 'รหัสโครงการนี้มีอยู่ในระบบแล้ว กรุณาเปลี่ยนรหัสโครงการ' });
  }

  const user = getCurrentUser();
  const projectId = `prj-${Date.now()}`;
  const hasImportedSections = Array.isArray(sections) && sections.length > 0;
  const initialProjectStatus = hasImportedSections && auto_create_checklist ? 'IN_PROGRESS' : 'PLANNING';

  dbQuery.run(
    `INSERT INTO projects (
      id, name, code, contract_number, tor_number,
      government_agency, client, contractor, project_manager,
      start_date, end_date, inspection_date, location, description,
      export_policy, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      projectId,
      name,
      code,
      contract_number || null,
      tor_number || null,
      government_agency || null,
      client || government_agency || null,
      contractor || null,
      project_manager || user.name,
      start_date || null,
      end_date || null,
      inspection_date || null,
      location || null,
      description || null,
      export_policy || 'warning',
      initialProjectStatus
    ]
  );

  // Initialize storage folder structure for project
  StorageService.initProjectStorage(projectId);

  // Save uploaded original TOR document if temp_file_token was provided
  if (temp_file_token) {
    const tempFilePath = path.join(STORAGE_ROOT, 'temp', path.basename(temp_file_token));
    if (fs.existsSync(tempFilePath)) {
      try {
        const savedDoc = StorageService.saveTorDocument(
          projectId,
          tempFilePath,
          original_filename || 'TOR_Document.pdf'
        );
        dbQuery.run(
          `INSERT INTO tor_documents (id, project_id, filename, original_path, mime_type, file_size, status, raw_extracted_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            projectId,
            original_filename || 'TOR_Document.pdf',
            savedDoc.relativePath,
            mime_type || 'application/octet-stream',
            savedDoc.fileSize,
            auto_create_checklist ? 'APPROVED' : 'PARSED',
            extracted_text || null
          ]
        );
        fs.unlinkSync(tempFilePath);
      } catch (e) {
        console.warn('Could not move temp TOR file:', e);
      }
    }
  }

  // If TOR sections/items were extracted from the uploaded file, populate them automatically
  let importedItemsCount = 0;
  if (hasImportedSections) {
    let sortOrder = 1;
    const itemStatus = auto_create_checklist ? 'APPROVED' : 'DRAFT';

    for (const sec of sections) {
      const secId = uuidv4();
      dbQuery.run(
        `INSERT INTO tor_sections (id, project_id, section_number, title, sort_order) VALUES (?, ?, ?, ?, ?)`,
        [secId, projectId, sec.section_number || String(sortOrder), sec.title || 'หมวดงาน', sortOrder++]
      );

      if (Array.isArray(sec.items)) {
        for (const item of sec.items) {
          const itemId = uuidv4();
          const evRequired = item.evidence_required !== undefined ? (item.evidence_required ? 1 : 0) : 1;
          const minImages = item.minimum_images || 4;

          dbQuery.run(
            `INSERT INTO tor_items (
              id, project_id, section_id, item_number, title, requirement,
              quantity, unit, dimensions, deliverable, evidence_required,
              minimum_images, capture_instructions, capture_types, sort_order, status,
              installment_number, installment_title
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId,
              projectId,
              secId,
              item.item_number || `${sec.section_number}.1`,
              item.title || 'รายการดำเนินงาน',
              item.requirement || item.title || '',
              item.quantity || 1,
              item.unit || 'งาน',
              item.dimensions || null,
              item.deliverable || null,
              evRequired,
              minImages,
              JSON.stringify(item.capture_instructions || ['ถ่ายภาพรวม', 'ถ่ายรายละเอียด']),
              JSON.stringify(item.capture_types || ['overview', 'detail']),
              sortOrder++,
              itemStatus,
              item.installment_number || 1,
              item.installment_title || `งวดที่ ${item.installment_number || 1}`
            ]
          );

          importedItemsCount++;

          if (auto_create_checklist) {
            const evId = `ev-${itemId}`;
            const evStatus = evRequired ? 'MISSING' : 'NOT_REQUIRED';
            dbQuery.run(
              `INSERT INTO evidence_items (
                id, project_id, tor_item_id, assigned_to, status, notes, qr_code_token
              ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
              [
                evId,
                projectId,
                itemId,
                'usr-staff-01',
                evStatus,
                `หลักฐานสำหรับ ${item.item_number} ${item.title}`,
                `QR-${itemId}`
              ]
            );
          }
        }
      }
    }
  }

  // Create default report template
  const templateId = uuidv4();
  dbQuery.run(
    `INSERT INTO report_templates (
      id, project_id, name, page_size, orientation, font_family, items_per_page, is_default
    ) VALUES (?, ?, ?, 'A4', 'portrait', 'TH Sarabun New', 2, 1)`,
    [templateId, projectId, 'รายงานส่งมอบงานมาตรฐาน (2 รายการ/หน้า)']
  );

  // Audit log
  dbQuery.run(
    `INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
     VALUES (?, ?, ?, ?, 'PROJECT_CREATED', 'PROJECT', ?, ?)`,
    [
      uuidv4(),
      projectId,
      user.id,
      user.name,
      projectId,
      JSON.stringify({ name, code, importedItemsCount, autoChecklist: Boolean(auto_create_checklist) })
    ]
  );

  res.status(201).json({
    success: true,
    projectId,
    importedItemsCount
  });
});

// PATCH update project
projectsRouter.patch('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const allowedFields = [
    'name', 'contract_number', 'tor_number', 'government_agency', 'client',
    'contractor', 'project_manager', 'start_date', 'end_date', 'inspection_date',
    'location', 'description', 'export_policy', 'allow_location_metadata', 'status'
  ];

  const updates: string[] = [];
  const params: any[] = [];

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      params.push(req.body[field]);
    }
  }

  if (updates.length > 0) {
    updates.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);
    dbQuery.run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);

    const user = getCurrentUser();
    dbQuery.run(
      `INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, before_state, after_state)
       VALUES (?, ?, ?, ?, 'PROJECT_UPDATED', 'PROJECT', ?, ?, ?)`,
      [uuidv4(), id, user.id, user.name, id, JSON.stringify(project), JSON.stringify(req.body)]
    );
  }

  res.json({ success: true });
});
