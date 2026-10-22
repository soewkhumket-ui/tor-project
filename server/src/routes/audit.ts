import { Router, Request, Response } from 'express';
import { dbQuery } from '../db/index.js';

export const auditRouter = Router();

// GET audit logs for a project
auditRouter.get('/projects/:id/audit', (req: Request, res: Response) => {
  const { id: projectId } = req.params;

  const logs = dbQuery.all(`
    SELECT * FROM audit_logs
    WHERE project_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `, [projectId]);

  res.json({ logs });
});
