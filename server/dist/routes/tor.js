import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { dbQuery } from '../db/index.js';
import { AIService } from '../services/ai.js';
import { StorageService, STORAGE_ROOT } from '../services/storage.js';
import { getCurrentUser } from './auth.js';
export const torRouter = Router();
// Multer storage for temporary TOR file upload
const upload = multer({
    dest: path.join(STORAGE_ROOT, 'temp'),
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
// POST Upload TOR file and extract text / analyze
torRouter.post('/projects/:id/tor-upload', upload.single('tor_file'), async (req, res) => {
    const projectId = String(req.params.id);
    const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project)
        return res.status(404).json({ error: 'Project not found' });
    if (!req.file) {
        return res.status(400).json({ error: 'กรุณาเลือกไฟล์ TOR' });
    }
    try {
        let originalName = req.file.originalname;
        try {
            const candidate = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
            if (!candidate.includes('\uFFFD')) {
                originalName = candidate;
            }
        }
        catch { }
        const tempPath = req.file.path;
        // Save immutable original
        const saved = StorageService.saveTorDocument(projectId, tempPath, originalName);
        // Extract text from PDF, DOCX, TXT, MD, JSON
        const extractedText = req.body.raw_text || (await AIService.extractTextFromFile(tempPath, originalName));
        const docId = uuidv4();
        dbQuery.run(`INSERT INTO tor_documents (id, project_id, filename, original_path, mime_type, file_size, raw_extracted_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`, [docId, projectId, originalName, saved.relativePath, req.file.mimetype, saved.fileSize, extractedText]);
        // AI Analysis
        const analysis = await AIService.analyzeTorText(extractedText, originalName);
        if (req.body.applyDirectly === 'true' || req.body.applyDirectly === true) {
            let sortOrder = 1;
            for (const sec of analysis.sections) {
                const secId = uuidv4();
                dbQuery.run(`INSERT INTO tor_sections (id, project_id, section_number, title, sort_order) VALUES (?, ?, ?, ?, ?)`, [secId, projectId, sec.section_number, sec.title, sortOrder++]);
                for (const item of sec.items) {
                    const itemId = uuidv4();
                    dbQuery.run(`INSERT INTO tor_items (
              id, project_id, section_id, item_number, title, requirement,
              quantity, unit, dimensions, deliverable, evidence_required,
              minimum_images, capture_instructions, capture_types, installment_number, installment_title, sort_order, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`, [
                        itemId,
                        projectId,
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
                        JSON.stringify(item.capture_instructions || []),
                        JSON.stringify(item.capture_types || ['overview', 'detail']),
                        item.installment_number || 1,
                        item.installment_title || `งวดที่ ${item.installment_number || 1}`,
                        sortOrder++
                    ]);
                }
            }
        }
        // Clean up temporary file
        if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
        }
        res.json({
            success: true,
            documentId: docId,
            analysis
        });
    }
    catch (err) {
        console.error('Error uploading TOR:', err);
        res.status(500).json({ error: err.message || 'Failed to process TOR' });
    }
});
// POST Analyze raw TOR text or run AI parser
torRouter.post('/projects/:id/tor-analyze', async (req, res) => {
    const { id: projectId } = req.params;
    const { rawText, applyDirectly } = req.body;
    if (!rawText || !rawText.trim()) {
        return res.status(400).json({ error: 'กรุณากรอกหรือวางข้อความ TOR' });
    }
    try {
        const analysis = await AIService.analyzeTorText(rawText);
        // If applyDirectly is true, populate tor_sections and tor_items
        if (applyDirectly) {
            let sortOrder = 1;
            for (const sec of analysis.sections) {
                const secId = uuidv4();
                dbQuery.run(`INSERT INTO tor_sections (id, project_id, section_number, title, sort_order) VALUES (?, ?, ?, ?, ?)`, [secId, projectId, sec.section_number, sec.title, sortOrder++]);
                for (const item of sec.items) {
                    const itemId = uuidv4();
                    dbQuery.run(`INSERT INTO tor_items (
              id, project_id, section_id, item_number, title, requirement,
              quantity, unit, dimensions, deliverable, evidence_required,
              minimum_images, capture_instructions, capture_types, installment_number, installment_title, sort_order, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`, [
                        itemId,
                        projectId,
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
                        JSON.stringify(item.capture_instructions || []),
                        JSON.stringify(item.capture_types || ['overview', 'detail']),
                        item.installment_number || 1,
                        item.installment_title || `งวดที่ ${item.installment_number || 1}`,
                        sortOrder++
                    ]);
                }
            }
        }
        res.json({ success: true, analysis });
    }
    catch (err) {
        console.error('Error analyzing TOR text:', err);
        res.status(500).json({ error: err.message || 'Analysis failed' });
    }
});
// GET Project TOR Structure (Sections and items)
torRouter.get('/projects/:id/tor-structure', (req, res) => {
    const { id: projectId } = req.params;
    const sections = dbQuery.all(`SELECT * FROM tor_sections WHERE project_id = ? ORDER BY sort_order ASC`, [projectId]);
    const items = dbQuery.all(`SELECT * FROM tor_items WHERE project_id = ? AND deleted_at IS NULL ORDER BY sort_order ASC`, [projectId]);
    const itemsWithParsedJSON = items.map(item => ({
        ...item,
        capture_instructions: item.capture_instructions ? JSON.parse(item.capture_instructions) : [],
        capture_types: item.capture_types ? JSON.parse(item.capture_types) : []
    }));
    res.json({ sections, items: itemsWithParsedJSON });
});
// POST Create new manual TOR item
torRouter.post('/projects/:id/tor-items', (req, res) => {
    const { id: projectId } = req.params;
    const { section_id, item_number, title, requirement, quantity, unit, dimensions, deliverable, evidence_required, minimum_images, capture_instructions, capture_types, installment_number, installment_title } = req.body;
    const itemId = uuidv4();
    const maxSort = dbQuery.get(`SELECT MAX(sort_order) as max FROM tor_items WHERE project_id = ?`, [projectId])?.max || 0;
    dbQuery.run(`INSERT INTO tor_items (
      id, project_id, section_id, item_number, title, requirement,
      quantity, unit, dimensions, deliverable, evidence_required,
      minimum_images, capture_instructions, capture_types, installment_number, installment_title, sort_order, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'DRAFT')`, [
        itemId,
        projectId,
        section_id || null,
        item_number,
        title,
        requirement,
        quantity || 1,
        unit || 'งาน',
        dimensions || null,
        deliverable || null,
        evidence_required ? 1 : 0,
        minimum_images || 4,
        JSON.stringify(capture_instructions || []),
        JSON.stringify(capture_types || ['overview', 'detail']),
        installment_number || 1,
        installment_title || `งวดที่ ${installment_number || 1}`,
        maxSort + 1
    ]);
    res.status(201).json({ success: true, itemId });
});
// PATCH Update TOR item
torRouter.patch('/tor-items/:id', (req, res) => {
    const { id } = req.params;
    const item = dbQuery.get('SELECT * FROM tor_items WHERE id = ?', [id]);
    if (!item)
        return res.status(404).json({ error: 'TOR Item not found' });
    const allowed = [
        'title', 'requirement', 'quantity', 'unit', 'dimensions',
        'deliverable', 'evidence_required', 'minimum_images', 'sort_order',
        'installment_number', 'installment_title'
    ];
    const updates = [];
    const params = [];
    for (const key of allowed) {
        if (req.body[key] !== undefined) {
            updates.push(`${key} = ?`);
            params.push(req.body[key]);
        }
    }
    if (req.body.capture_instructions !== undefined) {
        updates.push('capture_instructions = ?');
        params.push(JSON.stringify(req.body.capture_instructions));
    }
    if (req.body.capture_types !== undefined) {
        updates.push('capture_types = ?');
        params.push(JSON.stringify(req.body.capture_types));
    }
    if (updates.length > 0) {
        updates.push('updated_at = CURRENT_TIMESTAMP');
        params.push(id);
        dbQuery.run(`UPDATE tor_items SET ${updates.join(', ')} WHERE id = ?`, params);
    }
    res.json({ success: true });
});
// DELETE Soft-delete TOR item
torRouter.delete('/tor-items/:id', (req, res) => {
    const { id } = req.params;
    dbQuery.run(`UPDATE tor_items SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?`, [id]);
    res.json({ success: true });
});
// POST Approve TOR Structure -> Generates Checklist
torRouter.post('/projects/:id/tor-approve', (req, res) => {
    const { id: projectId } = req.params;
    const user = getCurrentUser();
    // Mark all items as APPROVED
    dbQuery.run(`UPDATE tor_items SET status = 'APPROVED' WHERE project_id = ? AND deleted_at IS NULL`, [projectId]);
    // Find all items needing evidence
    const items = dbQuery.all(`SELECT * FROM tor_items WHERE project_id = ? AND deleted_at IS NULL`, [projectId]);
    for (const item of items) {
        // Check if evidence_item already exists
        const existing = dbQuery.get(`SELECT id FROM evidence_items WHERE tor_item_id = ?`, [item.id]);
        if (!existing) {
            const evId = `ev-${item.id}`;
            const status = item.evidence_required ? 'MISSING' : 'NOT_REQUIRED';
            dbQuery.run(`INSERT INTO evidence_items (
          id, project_id, tor_item_id, status, notes, qr_code_token
        ) VALUES (?, ?, ?, ?, ?, ?)`, [
                evId,
                projectId,
                item.id,
                status,
                `หลักฐานสำหรับ ${item.item_number} ${item.title}`,
                `QR-${item.id}`
            ]);
        }
    }
    // Update project status to IN_PROGRESS
    dbQuery.run(`UPDATE projects SET status = 'IN_PROGRESS' WHERE id = ?`, [projectId]);
    // Audit log
    dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
     VALUES (?, ?, ?, ?, 'TOR_STRUCTURE_APPROVED', 'TOR_STRUCTURE', ?, ?)`, [uuidv4(), projectId, user.id, user.name, projectId, JSON.stringify({ approved_count: items.length })]);
    res.json({
        success: true,
        message: 'อนุมัติโครงสร้าง TOR และสร้างรายการ Checklist สำเร็จแล้ว',
        totalChecklistItems: items.length
    });
});
