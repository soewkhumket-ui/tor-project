import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import { dbQuery } from '../db/index.js';
import { StorageService, STORAGE_ROOT } from '../services/storage.js';
import { getCurrentUser } from './auth.js';
export const evidenceRouter = Router();
const upload = multer({
    dest: path.join(STORAGE_ROOT, 'temp'),
    limits: { fileSize: 25 * 1024 * 1024 } // 25MB
});
// GET all evidence checklist items for a project
evidenceRouter.get('/projects/:id/evidence', (req, res) => {
    const { id: projectId } = req.params;
    const items = dbQuery.all(`
    SELECT 
      e.id as evidence_id,
      e.status as evidence_status,
      e.notes,
      e.rejection_comment,
      e.assigned_to,
      e.version as evidence_version,
      t.id as tor_item_id,
      t.item_number,
      t.title,
      t.requirement,
      t.quantity,
      t.unit,
      t.dimensions,
      t.minimum_images,
      t.capture_instructions,
      t.capture_types,
      t.is_additional,
      s.title as section_title
    FROM evidence_items e
    JOIN tor_items t ON e.tor_item_id = t.id
    LEFT JOIN tor_sections s ON t.section_id = s.id
    WHERE e.project_id = ? AND t.deleted_at IS NULL
    ORDER BY t.sort_order ASC
  `, [projectId]);
    // Fetch all evidence files for this project
    const files = dbQuery.all(`
    SELECT f.*
    FROM evidence_files f
    JOIN evidence_items e ON f.evidence_item_id = e.id
    WHERE e.project_id = ? AND f.deleted_at IS NULL
    ORDER BY f.sort_order ASC, f.created_at ASC
  `, [projectId]);
    // Group files by evidence_id
    const filesByEvidence = {};
    for (const f of files) {
        if (!filesByEvidence[f.evidence_item_id]) {
            filesByEvidence[f.evidence_item_id] = [];
        }
        filesByEvidence[f.evidence_item_id].push({
            ...f,
            annotation_json: f.annotation_json ? JSON.parse(f.annotation_json) : []
        });
    }
    const enrichedItems = items.map(item => ({
        ...item,
        capture_instructions: item.capture_instructions ? JSON.parse(item.capture_instructions) : [],
        capture_types: item.capture_types ? JSON.parse(item.capture_types) : [],
        files: filesByEvidence[item.evidence_id] || []
    }));
    res.json({ evidence_items: enrichedItems });
});
// GET single evidence item details
evidenceRouter.get('/evidence/:id', (req, res) => {
    const { id } = req.params;
    const item = dbQuery.get(`
    SELECT 
      e.*,
      t.item_number,
      t.title,
      t.requirement,
      t.quantity,
      t.unit,
      t.dimensions,
      t.minimum_images,
      t.capture_instructions,
      t.capture_types,
      s.title as section_title
    FROM evidence_items e
    JOIN tor_items t ON e.tor_item_id = t.id
    LEFT JOIN tor_sections s ON t.section_id = s.id
    WHERE e.id = ?
  `, [id]);
    if (!item)
        return res.status(404).json({ error: 'Evidence item not found' });
    const files = dbQuery.all(`
    SELECT * FROM evidence_files
    WHERE evidence_item_id = ? AND deleted_at IS NULL
    ORDER BY sort_order ASC, created_at ASC
  `, [id]);
    res.json({
        evidence_item: {
            ...item,
            capture_instructions: item.capture_instructions ? JSON.parse(item.capture_instructions) : [],
            capture_types: item.capture_types ? JSON.parse(item.capture_types) : [],
            files: files.map(f => ({
                ...f,
                annotation_json: f.annotation_json ? JSON.parse(f.annotation_json) : []
            }))
        }
    });
});
// POST Upload evidence photo (3-tier storage + quality checks)
evidenceRouter.post('/evidence/:id/upload', upload.single('image'), async (req, res) => {
    const evidenceItemId = String(req.params.id);
    const evItem = dbQuery.get('SELECT * FROM evidence_items WHERE id = ?', [evidenceItemId]);
    if (!evItem)
        return res.status(404).json({ error: 'Evidence item not found' });
    if (!req.file)
        return res.status(400).json({ error: 'กรุณาเลือกไฟล์ภาพถ่าย' });
    try {
        const user = getCurrentUser();
        const tempPath = req.file.path;
        let originalName = req.file.originalname;
        try {
            const candidate = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
            if (!candidate.includes('\uFFFD')) {
                originalName = candidate;
            }
        }
        catch { }
        // Process image through 3-tier pipeline
        const processed = await StorageService.processEvidenceImage(evItem.project_id, evidenceItemId, tempPath, originalName);
        // Clean up temp upload
        if (fs.existsSync(tempPath))
            fs.unlinkSync(tempPath);
        const fileId = uuidv4();
        const maxSort = dbQuery.get(`SELECT MAX(sort_order) as max FROM evidence_files WHERE evidence_item_id = ?`, [evidenceItemId])?.max || 0;
        const captureType = req.body.capture_type || 'overview';
        const caption = req.body.caption || `${req.body.title || 'ภาพหลักฐาน'} (${captureType})`;
        dbQuery.run(`INSERT INTO evidence_files (
        id, evidence_item_id, original_path, preview_path, print_path,
        mime_type, file_size, width, height, quality_score, blur_score,
        quality_warning, uploaded_by, capture_type, caption, sort_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED')`, [
            fileId,
            evidenceItemId,
            processed.originalRelativePath,
            processed.previewRelativePath,
            processed.printRelativePath,
            processed.mimeType,
            processed.fileSize,
            processed.width,
            processed.height,
            processed.qualityScore,
            processed.blurScore,
            processed.qualityWarning || null,
            user.id,
            captureType,
            caption,
            maxSort + 1
        ]);
        // Update evidence item status
        const currentFilesCount = dbQuery.get(`SELECT COUNT(*) as count FROM evidence_files WHERE evidence_item_id = ? AND deleted_at IS NULL`, [evidenceItemId])?.count || 0;
        const torItem = dbQuery.get(`SELECT minimum_images FROM tor_items WHERE id = ?`, [evItem.tor_item_id]);
        const minImgs = torItem?.minimum_images || 4;
        let newStatus = evItem.status;
        if (evItem.status === 'MISSING') {
            newStatus = 'IN_PROGRESS';
        }
        dbQuery.run(`UPDATE evidence_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, evidenceItemId]);
        // Audit log
        dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
       VALUES (?, ?, ?, ?, 'EVIDENCE_FILE_UPLOADED', 'EVIDENCE_FILE', ?, ?)`, [uuidv4(), evItem.project_id, user.id, user.name, fileId, JSON.stringify({ fileId, width: processed.width, height: processed.height })]);
        res.status(201).json({
            success: true,
            file: {
                id: fileId,
                preview_path: processed.previewRelativePath,
                print_path: processed.printRelativePath,
                quality_score: processed.qualityScore,
                blur_score: processed.blurScore,
                quality_warning: processed.qualityWarning,
                total_photos: currentFilesCount,
                min_required: minImgs
            }
        });
    }
    catch (err) {
        console.error('Upload evidence error:', err);
        res.status(500).json({ error: err.message || 'Failed to upload evidence photo' });
    }
});
// POST Save non-destructive annotations on evidence file
evidenceRouter.post('/evidence-files/:fileId/annotations', (req, res) => {
    const { fileId } = req.params;
    const { annotations } = req.body;
    const file = dbQuery.get('SELECT * FROM evidence_files WHERE id = ?', [fileId]);
    if (!file)
        return res.status(404).json({ error: 'Evidence file not found' });
    const annotationJson = typeof annotations === 'string' ? annotations : JSON.stringify(annotations || []);
    dbQuery.run(`UPDATE evidence_files SET annotation_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [annotationJson, fileId]);
    res.json({ success: true, message: 'บันทึกคำอธิบายสัญลักษณ์และข้อความบนภาพสำเร็จ' });
});
// PATCH Update file properties (caption, reorder, cover, hidden)
evidenceRouter.patch('/evidence-files/:fileId', (req, res) => {
    const { fileId } = req.params;
    const file = dbQuery.get('SELECT * FROM evidence_files WHERE id = ?', [fileId]);
    if (!file)
        return res.status(404).json({ error: 'Evidence file not found' });
    const allowed = ['caption', 'capture_type', 'sort_order', 'is_cover', 'is_hidden'];
    const updates = [];
    const params = [];
    for (const k of allowed) {
        if (req.body[k] !== undefined) {
            updates.push(`${k} = ?`);
            params.push(req.body[k]);
        }
    }
    if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(fileId);
        dbQuery.run(`UPDATE evidence_files SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    res.json({ success: true });
});
// POST Submit evidence item for review
evidenceRouter.post('/evidence/:id/submit', (req, res) => {
    const { id } = req.params;
    const evItem = dbQuery.get('SELECT * FROM evidence_items WHERE id = ?', [id]);
    if (!evItem)
        return res.status(404).json({ error: 'Evidence item not found' });
    const user = getCurrentUser();
    dbQuery.run(`UPDATE evidence_items SET status = 'WAITING_REVIEW', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    // Audit log
    dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, before_state, after_state)
     VALUES (?, ?, ?, ?, 'EVIDENCE_SUBMITTED_FOR_REVIEW', 'EVIDENCE_ITEM', ?, ?, ?)`, [uuidv4(), evItem.project_id, user.id, user.name, id, JSON.stringify({ status: evItem.status }), JSON.stringify({ status: 'WAITING_REVIEW' })]);
    res.json({ success: true, message: 'ส่งหลักฐานให้ผู้จัดการโครงการตรวจสอบเรียบร้อยแล้ว' });
});
// POST Review: Approve or Reject
evidenceRouter.post('/evidence/:id/review', (req, res) => {
    const { id } = req.params;
    const { action, comment } = req.body; // action: 'APPROVE' | 'REJECT'
    const evItem = dbQuery.get('SELECT * FROM evidence_items WHERE id = ?', [id]);
    if (!evItem)
        return res.status(404).json({ error: 'Evidence item not found' });
    const user = getCurrentUser();
    const reviewId = uuidv4();
    if (action === 'APPROVE') {
        dbQuery.run(`UPDATE evidence_items SET status = 'COMPLETE', rejection_comment = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
        dbQuery.run(`INSERT INTO reviews (id, evidence_item_id, reviewer_id, status, comment) VALUES (?, ?, ?, 'APPROVED', ?)`, [reviewId, id, user.id, comment || 'อนุมัติหลักฐานภาพถ่ายครบถ้วนตาม TOR']);
        dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
       VALUES (?, ?, ?, ?, 'EVIDENCE_APPROVED', 'EVIDENCE_ITEM', ?, ?)`, [uuidv4(), evItem.project_id, user.id, user.name, id, JSON.stringify({ status: 'COMPLETE', comment })]);
        res.json({ success: true, message: 'อนุมัติหลักฐานสำเร็จ', newStatus: 'COMPLETE' });
    }
    else {
        // REJECT
        dbQuery.run(`UPDATE evidence_items SET status = 'REJECTED', rejection_comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [comment || 'ภาพถ่ายไม่ตรงตามเกณฑ์ กรุณาถ่ายภาพเพิ่มเติม', id]);
        dbQuery.run(`INSERT INTO reviews (id, evidence_item_id, reviewer_id, status, comment) VALUES (?, ?, ?, 'REJECTED', ?)`, [reviewId, id, user.id, comment || 'ภาพถ่ายไม่ชัดเจนหรือไม่ครบถ้วน']);
        dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
       VALUES (?, ?, ?, ?, 'EVIDENCE_REJECTED', 'EVIDENCE_ITEM', ?, ?)`, [uuidv4(), evItem.project_id, user.id, user.name, id, JSON.stringify({ status: 'REJECTED', comment })]);
        res.json({ success: true, message: 'ส่งกลับให้แก้ไขหลักฐานแล้ว', newStatus: 'REJECTED' });
    }
});
// POST Add Extra / Additional Evidence (Not Original TOR Requirement)
evidenceRouter.post('/evidence/extra', (req, res) => {
    const { projectId, title, requirement } = req.body;
    const user = getCurrentUser();
    const torItemId = uuidv4();
    const maxSort = dbQuery.get(`SELECT MAX(sort_order) as max FROM tor_items WHERE project_id = ?`, [projectId])?.max || 0;
    dbQuery.run(`INSERT INTO tor_items (
      id, project_id, item_number, title, requirement,
      deliverable, evidence_required, minimum_images,
      capture_instructions, capture_types, is_additional, sort_order, status
    ) VALUES (?, ?, 'EXTRA', ?, ?, 'หลักฐานงานเพิ่มเติม', 1, 4, ?, ?, 1, ?, 'APPROVED')`, [
        torItemId,
        projectId,
        title,
        requirement || title,
        JSON.stringify(['ถ่ายภาพรวมงานเพิ่มเติม', 'ถ่ายรายละเอียดจุดสำคัญ']),
        JSON.stringify(['overview', 'detail']),
        maxSort + 1
    ]);
    const evId = `ev-${torItemId}`;
    dbQuery.run(`INSERT INTO evidence_items (
      id, project_id, tor_item_id, status, notes
    ) VALUES (?, ?, ?, 'IN_PROGRESS', 'หลักฐานเพิ่มเติม - นอกเหนือจาก TOR เดิม')`, [evId, projectId, torItemId]);
    dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
     VALUES (?, ?, ?, ?, 'EXTRA_EVIDENCE_ADDED', 'EVIDENCE_ITEM', ?, ?)`, [uuidv4(), projectId, user.id, user.name, evId, JSON.stringify({ title })]);
    res.status(201).json({ success: true, evidenceItemId: evId });
});
// GET QR code data URL for mobile field access
evidenceRouter.get('/evidence/:id/qrcode', async (req, res) => {
    const { id } = req.params;
    const evItem = dbQuery.get('SELECT * FROM evidence_items WHERE id = ?', [id]);
    if (!evItem)
        return res.status(404).json({ error: 'Evidence item not found' });
    // Generate mobile capture URL
    const host = req.get('host') || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const targetUrl = `${protocol}://${host}/capture/${id}`;
    try {
        const qrDataUrl = await QRCode.toDataURL(targetUrl, {
            width: 280,
            margin: 2,
            color: {
                dark: '#1a365d',
                light: '#ffffff'
            }
        });
        res.json({
            evidenceId: id,
            targetUrl,
            qrDataUrl
        });
    }
    catch (err) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});
