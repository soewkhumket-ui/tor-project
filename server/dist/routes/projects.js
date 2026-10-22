import { Router } from 'express';
import { dbQuery } from '../db/index.js';
import { v4 as uuidv4 } from 'uuid';
import { StorageService } from '../services/storage.js';
import { getCurrentUser } from './auth.js';
export const projectsRouter = Router();
// GET all projects with statistics
projectsRouter.get('/', (_req, res) => {
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
projectsRouter.get('/:id', (req, res) => {
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
    const unapprovedCount = dbQuery.get(`SELECT COUNT(*) as count FROM tor_items WHERE project_id = ? AND status = 'DRAFT' AND deleted_at IS NULL`, [id])?.count || 0;
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
// POST create project
projectsRouter.post('/', (req, res) => {
    const { name, code, contract_number, tor_number, government_agency, client, contractor, project_manager, start_date, end_date, inspection_date, location, description, export_policy } = req.body;
    if (!name || !code) {
        return res.status(400).json({ error: 'ชื่อโครงการและรหัสโครงการจำเป็นต้องระบุ' });
    }
    const existing = dbQuery.get('SELECT id FROM projects WHERE code = ?', [code]);
    if (existing) {
        return res.status(400).json({ error: 'รหัสโครงการนี้มีอยู่ในระบบแล้ว' });
    }
    const user = getCurrentUser();
    const projectId = `prj-${Date.now()}`;
    dbQuery.run(`INSERT INTO projects (
      id, name, code, contract_number, tor_number,
      government_agency, client, contractor, project_manager,
      start_date, end_date, inspection_date, location, description,
      export_policy, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'PLANNING')`, [
        projectId,
        name,
        code,
        contract_number || null,
        tor_number || null,
        government_agency || null,
        client || null,
        contractor || null,
        project_manager || user.name,
        start_date || null,
        end_date || null,
        inspection_date || null,
        location || null,
        description || null,
        export_policy || 'warning'
    ]);
    // Initialize storage folder structure for project
    StorageService.initProjectStorage(projectId);
    // Create default report template
    const templateId = uuidv4();
    dbQuery.run(`INSERT INTO report_templates (
      id, project_id, name, page_size, orientation, font_family, items_per_page, is_default
    ) VALUES (?, ?, ?, 'A4', 'portrait', 'TH Sarabun New', 2, 1)`, [templateId, projectId, 'รายงานส่งมอบงานมาตรฐาน (2 รายการ/หน้า)']);
    // Audit log
    dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, after_state)
     VALUES (?, ?, ?, ?, 'PROJECT_CREATED', 'PROJECT', ?, ?)`, [uuidv4(), projectId, user.id, user.name, projectId, JSON.stringify({ name, code })]);
    res.status(201).json({ success: true, projectId });
});
// PATCH update project
projectsRouter.patch('/:id', (req, res) => {
    const { id } = req.params;
    const project = dbQuery.get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project)
        return res.status(404).json({ error: 'Project not found' });
    const allowedFields = [
        'name', 'contract_number', 'tor_number', 'government_agency', 'client',
        'contractor', 'project_manager', 'start_date', 'end_date', 'inspection_date',
        'location', 'description', 'export_policy', 'allow_location_metadata', 'status'
    ];
    const updates = [];
    const params = [];
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
        dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, before_state, after_state)
       VALUES (?, ?, ?, ?, 'PROJECT_UPDATED', 'PROJECT', ?, ?, ?)`, [uuidv4(), id, user.id, user.name, id, JSON.stringify(project), JSON.stringify(req.body)]);
    }
    res.json({ success: true });
});
