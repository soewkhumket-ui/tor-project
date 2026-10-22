import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import dotenv from 'dotenv';
import { initDatabase } from './db/index.js';
import { runSeed } from './db/seed.js';
import { authRouter } from './routes/auth.js';
import { projectsRouter } from './routes/projects.js';
import { torRouter } from './routes/tor.js';
import { evidenceRouter } from './routes/evidence.js';
import { reportsRouter } from './routes/reports.js';
import { auditRouter } from './routes/audit.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
// Static file serving for evidence images, original docs, and exports
const storageDir = path.resolve(process.cwd(), 'storage');
if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
}
app.use('/storage', express.static(storageDir));
// Initialize Database & Seed
initDatabase();
runSeed();
// Health check
app.get('/api/v1/health', (_req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'TOR Evidence & Handover Report System'
    });
});
// API Routes
app.use('/api/v1/auth', authRouter);
app.use('/api/v1/projects', projectsRouter);
app.use('/api/v1', torRouter);
app.use('/api/v1', evidenceRouter);
app.use('/api/v1', reportsRouter);
app.use('/api/v1', auditRouter);
// Serve frontend production build if available
const clientDist = path.resolve(process.cwd(), '../client/dist');
if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
        if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/storage')) {
            const indexPath = path.join(clientDist, 'index.html');
            if (fs.existsSync(indexPath)) {
                return res.sendFile(indexPath);
            }
        }
        next();
    });
}
// Start server
app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🚀 TOR Evidence & Handover Report Server is running!`);
    console.log(`🌐 Local API: http://localhost:${PORT}/api/v1/health`);
    console.log(`📁 Storage directory: ${storageDir}`);
    console.log(`=======================================================`);
});
export default app;
