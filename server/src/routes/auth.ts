import { Router, Request, Response } from 'express';
import { dbQuery } from '../db/index.js';

export const authRouter = Router();

// In-memory or session-based active user for pair programming and multi-role testing
let currentActiveUserId = 'usr-admin-01';

authRouter.get('/users', (_req: Request, res: Response) => {
  const users = dbQuery.all('SELECT id, name, email, role, avatar_url FROM users ORDER BY role ASC');
  res.json({ users, currentUserId: currentActiveUserId });
});

authRouter.get('/current', (_req: Request, res: Response) => {
  const user = dbQuery.get('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?', [currentActiveUserId]);
  res.json({ user: user || null });
});

authRouter.post('/switch-user', (req: Request, res: Response) => {
  const { userId } = req.body;
  const user = dbQuery.get('SELECT id, name, email, role, avatar_url FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  currentActiveUserId = userId;
  res.json({ success: true, user });
});

export function getCurrentUser() {
  return dbQuery.get('SELECT id, name, email, role FROM users WHERE id = ?', [currentActiveUserId]) || {
    id: 'usr-admin-01',
    name: 'สมชาย ประเสริฐสุข (Admin)',
    role: 'admin'
  };
}
