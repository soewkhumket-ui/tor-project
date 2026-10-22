import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import crypto from 'crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const STORAGE_ROOT = path.resolve(__dirname, '../../storage');

export interface ProcessedEvidenceImage {
  originalRelativePath: string;
  previewRelativePath: string;
  printRelativePath: string;
  width: number;
  height: number;
  fileSize: number;
  mimeType: string;
  qualityScore: number;
  blurScore: number;
  qualityWarning?: string;
  fileHash: string;
}

export class StorageService {
  /**
   * Ensure directory exists
   */
  static ensureDir(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  /**
   * Get project storage paths
   */
  static getProjectDirs(projectId: string) {
    const projectRoot = path.join(STORAGE_ROOT, 'projects', projectId);
    return {
      root: projectRoot,
      torOriginal: path.join(projectRoot, 'tor', 'original'),
      torProcessed: path.join(projectRoot, 'tor', 'processed'),
      evidence: path.join(projectRoot, 'evidence'),
      reportsDraft: path.join(projectRoot, 'reports', 'draft'),
      reportsFinal: path.join(projectRoot, 'reports', 'final'),
      exports: path.join(projectRoot, 'exports')
    };
  }

  /**
   * Initialize directory structure for a project
   */
  static initProjectStorage(projectId: string): void {
    const dirs = this.getProjectDirs(projectId);
    Object.values(dirs).forEach(dir => this.ensureDir(dir));
  }

  /**
   * Process and store evidence image in 3 tiers: ORIGINAL, PREVIEW, PRINT
   */
  static async processEvidenceImage(
    projectId: string,
    evidenceItemId: string,
    tempFilePath: string,
    originalFilename: string
  ): Promise<ProcessedEvidenceImage> {
    const dirs = this.getProjectDirs(projectId);
    const itemDir = path.join(dirs.evidence, evidenceItemId);
    const originalDir = path.join(itemDir, 'original');
    const previewDir = path.join(itemDir, 'preview');
    const printDir = path.join(itemDir, 'print');

    this.ensureDir(originalDir);
    this.ensureDir(previewDir);
    this.ensureDir(printDir);

    const fileBuffer = fs.readFileSync(tempFilePath);
    const fileHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const image = sharp(fileBuffer);
    const metadata = await image.metadata();

    const origWidth = metadata.width || 1920;
    const origHeight = metadata.height || 1080;
    const ext = path.extname(originalFilename).toLowerCase() || '.jpg';
    const baseName = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // 1. ORIGINAL (Immutable raw upload)
    const originalFileName = `${baseName}-orig${ext}`;
    const originalFullPath = path.join(originalDir, originalFileName);
    fs.copyFileSync(tempFilePath, originalFullPath);

    // 2. PREVIEW (Web-optimized: max 1200px, 80% quality, webp/jpeg)
    const previewFileName = `${baseName}-preview.webp`;
    const previewFullPath = path.join(previewDir, previewFileName);
    await sharp(fileBuffer)
      .resize({
        width: 1200,
        height: 1200,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 82 })
      .toFile(previewFullPath);

    // 3. PRINT (High-resolution target 200-300 DPI, max 2400px, high quality JPEG maintaining aspect ratio)
    const printFileName = `${baseName}-print.jpg`;
    const printFullPath = path.join(printDir, printFileName);
    await sharp(fileBuffer)
      .resize({
        width: 2400,
        height: 2400,
        fit: 'inside',
        withoutEnlargement: true
      })
      .jpeg({ quality: 92, chromaSubsampling: '4:4:4' })
      .toFile(printFullPath);

    // Image Quality & Blur Analysis
    const stats = await sharp(fileBuffer).stats();
    // Compute variance of grayscale channels as a proxy for contrast/sharpness
    const channelVariance = stats.channels.reduce((acc, c) => acc + (c.stdev * c.stdev), 0) / stats.channels.length;
    const blurScore = Math.min(100, Math.max(0, Math.round(channelVariance / 20)));

    let qualityWarning: string | undefined;
    if (origWidth < 800 || origHeight < 600) {
      qualityWarning = 'ความละเอียดภาพค่อนข้างต่ำ (ต่ำกว่า 800x600 พิกเซล)';
    } else if (blurScore < 20) {
      qualityWarning = 'ภาพอาจไม่คมชัดหรือมีความเปรียบต่างต่ำ กรุณาตรวจสอบก่อนบันทึก';
    }

    // Relative paths from storage root for database and API serving
    const toRelative = (p: string) => path.relative(STORAGE_ROOT, p).replace(/\\/g, '/');

    return {
      originalRelativePath: toRelative(originalFullPath),
      previewRelativePath: toRelative(previewFullPath),
      printRelativePath: toRelative(printFullPath),
      width: origWidth,
      height: origHeight,
      fileSize: fileBuffer.length,
      mimeType: metadata.format ? `image/${metadata.format}` : 'image/jpeg',
      qualityScore: blurScore > 30 ? 0.95 : 0.7,
      blurScore,
      qualityWarning,
      fileHash
    };
  }

  /**
   * Save original uploaded TOR document
   */
  static saveTorDocument(projectId: string, tempFilePath: string, filename: string): { relativePath: string; fileSize: number } {
    const dirs = this.getProjectDirs(projectId);
    this.ensureDir(dirs.torOriginal);

    const safeName = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const targetPath = path.join(dirs.torOriginal, safeName);
    fs.copyFileSync(tempFilePath, targetPath);

    const stats = fs.statSync(targetPath);
    const relativePath = path.relative(STORAGE_ROOT, targetPath).replace(/\\/g, '/');

    return { relativePath, fileSize: stats.size };
  }

  /**
   * Resolve absolute path from relative storage path
   */
  static getAbsolutePath(relativePath: string): string {
    return path.join(STORAGE_ROOT, relativePath);
  }
}
