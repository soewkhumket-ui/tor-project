import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Chrome executable location
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const STORAGE_ROOT = path.resolve(__dirname, '../../storage');

export interface ReportRenderOptions {
  project: any;
  template: any;
  sections: any[];
  torItems: any[];
  evidenceMap: Record<string, any[]>; // tor_item_id -> evidence_files
  itemsPerPage?: number;
  outputPath: string;
}

export class PDFGeneratorService {
  /**
   * Get base64 encoded TTF fonts for true offline vector font embedding
   */
  private static getFontBase64(): { regular: string; bold: string } {
    const regularFontPath = path.resolve(__dirname, '../assets/fonts/Sarabun-Regular.ttf');
    const boldFontPath = path.resolve(__dirname, '../assets/fonts/Sarabun-Bold.ttf');

    let regular = '';
    let bold = '';

    if (fs.existsSync(regularFontPath)) {
      regular = fs.readFileSync(regularFontPath).toString('base64');
    }
    if (fs.existsSync(boldFontPath)) {
      bold = fs.readFileSync(boldFontPath).toString('base64');
    }

    return { regular, bold };
  }

  /**
   * Build complete HTML markup for A4 document
   */
  static buildReportHTML(options: ReportRenderOptions): string {
    const { project, template, torItems, evidenceMap } = options;
    const fonts = this.getFontBase64();
    const itemsPerPage = options.itemsPerPage || template.items_per_page || 2;

    const fontFaceCSS = `
      @font-face {
        font-family: 'TH Sarabun New';
        src: url('data:font/truetype;charset=utf-8;base64,${fonts.regular}') format('truetype');
        font-weight: normal;
        font-style: normal;
      }
      @font-face {
        font-family: 'TH Sarabun New';
        src: url('data:font/truetype;charset=utf-8;base64,${fonts.bold}') format('truetype');
        font-weight: bold;
        font-style: normal;
      }
    `;

    // Filter items requiring evidence
    const activeItems = torItems.filter(i => !i.deleted_at);

    // Group items into pages based on itemsPerPage
    const pagedItems: any[][] = [];
    for (let i = 0; i < activeItems.length; i += itemsPerPage) {
      pagedItems.push(activeItems.slice(i, i + itemsPerPage));
    }

    // Thai Date Formatter
    const formatThaiDate = (dateStr?: string) => {
      if (!dateStr) return '..........................';
      const d = new Date(dateStr);
      const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
      return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
    };

    const todayThai = formatThaiDate(new Date().toISOString());

    return `<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <title>${project.name} - รายงานส่งมอบงาน</title>
  <style>
    ${fontFaceCSS}

    @page {
      size: A4 portrait;
      margin: 12mm 15mm 15mm 20mm;
      @bottom-right {
        content: "หน้าที่ " counter(page);
        font-family: 'TH Sarabun New', sans-serif;
        font-size: 14pt;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'TH Sarabun New', 'Sarabun', sans-serif;
      font-size: 16pt;
      line-height: 1.25;
      color: #1a202c;
      margin: 0;
      padding: 0;
      background: #ffffff;
    }

    .page {
      page-break-after: always;
      position: relative;
      min-height: 270mm;
      padding-bottom: 10mm;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .page-header {
      border-bottom: 1.5px solid #2b6cb0;
      padding-bottom: 4px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
      font-size: 13pt;
      color: #4a5568;
    }

    .page-footer {
      position: absolute;
      bottom: 2mm;
      left: 0;
      right: 0;
      border-top: 1px solid #cbd5e0;
      padding-top: 3px;
      display: flex;
      justify-content: space-between;
      font-size: 12pt;
      color: #718096;
    }

    /* Cover Page Styles */
    .cover-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 260mm;
      text-align: center;
      padding: 20px;
    }

    .cover-emblem {
      width: 100px;
      height: 100px;
      margin-bottom: 25px;
      object-fit: contain;
    }

    .cover-title {
      font-size: 26pt;
      font-weight: bold;
      color: #1a365d;
      margin-bottom: 12px;
      line-height: 1.2;
    }

    .cover-subtitle {
      font-size: 20pt;
      font-weight: bold;
      color: #2b6cb0;
      margin-bottom: 25px;
    }

    .cover-info-card {
      border: 2px solid #2b6cb0;
      border-radius: 8px;
      padding: 20px 30px;
      width: 85%;
      margin: 25px auto;
      text-align: left;
      font-size: 16pt;
      background-color: #f7fafc;
    }

    .cover-info-row {
      margin-bottom: 8px;
      display: flex;
    }

    .cover-info-label {
      font-weight: bold;
      width: 140px;
      flex-shrink: 0;
    }

    /* Letter Page Styles */
    .letter-header {
      text-align: center;
      margin-bottom: 15px;
    }
    .letter-title {
      font-size: 20pt;
      font-weight: bold;
      text-decoration: underline;
    }
    .letter-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 6px;
    }
    .letter-body {
      text-indent: 2.5cm;
      margin-top: 12px;
      margin-bottom: 12px;
      text-align: justify;
    }

    /* Evidence Grid Styles */
    .evidence-item-card {
      border: 1px solid #cbd5e0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 14px;
      background: #ffffff;
      page-break-inside: avoid;
    }

    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 4px;
      margin-bottom: 6px;
    }

    .item-number {
      font-size: 17pt;
      font-weight: bold;
      color: #2b6cb0;
    }

    .item-status-badge {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 4px;
      font-size: 13pt;
      font-weight: bold;
      background-color: #c6f6d5;
      color: #22543d;
    }

    .item-requirement-box {
      background-color: #edf2f7;
      border-left: 3px solid #3182ce;
      padding: 4px 8px;
      font-size: 14pt;
      margin-bottom: 8px;
      color: #2d3748;
    }

    .image-grid-4 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 6px;
    }

    .evidence-photo-box {
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
      background: #f7fafc;
      text-align: center;
      display: flex;
      flex-direction: column;
    }

    .evidence-photo-img {
      width: 100%;
      height: 60mm;
      object-fit: cover;
      display: block;
      background-color: #edf2f7;
    }

    .photo-caption {
      font-size: 12pt;
      color: #4a5568;
      padding: 2px 4px;
      background: #edf2f7;
      border-top: 1px solid #e2e8f0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Signatures Table */
    .sig-table {
      width: 100%;
      margin-top: 25px;
      border-collapse: collapse;
    }

    .sig-cell {
      width: 50%;
      padding: 15px 20px;
      vertical-align: top;
      text-align: center;
    }

    .sig-line {
      margin-top: 45px;
      border-bottom: 1px dotted #4a5568;
      width: 75%;
      margin-left: auto;
      margin-right: auto;
    }
  </style>
</head>
<body>

  <!-- 1. COVER PAGE -->
  <div class="page">
    <div class="cover-container">
      <div style="font-size: 32pt; font-weight: bold; color: #1a365d; margin-bottom: 20px;">
        🏛️ เอกสารส่งมอบงานตามข้อกำหนด TOR
      </div>
      <div class="cover-title">
        ${project.name}
      </div>
      <div class="cover-subtitle">
        สัญญาเลขที่: ${project.contract_number || '-'} | รหัสโครงการ: ${project.code}
      </div>

      <div class="cover-info-card">
        <div class="cover-info-row">
          <div class="cover-info-label">หน่วยงานเจ้าของโครงการ:</div>
          <div>${project.government_agency || '-'}</div>
        </div>
        <div class="cover-info-row">
          <div class="cover-info-label">ผู้ว่าจ้าง:</div>
          <div>${project.client || '-'}</div>
        </div>
        <div class="cover-info-row">
          <div class="cover-info-label">ผู้รับจ้างดำเนินงาน:</div>
          <div>${project.contractor || '-'}</div>
        </div>
        <div class="cover-info-row">
          <div class="cover-info-label">สถานที่ดำเนินงาน:</div>
          <div>${project.location || '-'}</div>
        </div>
        <div class="cover-info-row">
          <div class="cover-info-label">ระยะเวลาสัญญา:</div>
          <div>${formatThaiDate(project.start_date)} ถึง ${formatThaiDate(project.end_date)}</div>
        </div>
        <div class="cover-info-row">
          <div class="cover-info-label">วันที่ส่งมอบเอกสาร:</div>
          <div>${todayThai}</div>
        </div>
      </div>

      <div style="margin-top: 30px; font-size: 15pt; color: #718096;">
        จัดทำโดย: บริษัท สยาม นวัตกรรม แอนด์ อีเวนต์ โซลูชั่น จำกัด
      </div>
    </div>
  </div>

  <!-- 2. SUBMISSION LETTER (หนังสือขอส่งมอบงาน) -->
  <div class="page">
    <div class="page-header">
      <span>${template.header_text || 'เอกสารประกอบการส่งมอบงาน'}</span>
      <span>สัญญาเลขที่ ${project.contract_number || '-'}</span>
    </div>

    <div class="letter-header">
      <div style="font-size: 24pt; font-weight: bold; margin-bottom: 8px;">หนังสือขอส่งมอบงานตามสัญญา</div>
      <div style="font-size: 16pt; color: #4a5568;">${project.contractor || 'บริษัทผู้รับจ้าง'}</div>
    </div>

    <div class="letter-row" style="margin-top: 20px;">
      <div>เลขที่หนังสือ: สอ.089/2567</div>
      <div>วันที่: ${todayThai}</div>
    </div>
    <div style="margin-bottom: 6px;"><strong>เรื่อง:</strong> ขอส่งมอบงานและรายงานหลักฐานผลการดำเนินงานตามข้อกำหนด TOR งวดที่ 1</div>
    <div style="margin-bottom: 6px;"><strong>เรียน:</strong> ประธานคณะกรรมการตรวจรับพัสดุ ${project.government_agency || ''}</div>
    <div style="margin-bottom: 6px;"><strong>อ้างถึง:</strong> สัญญาจ้างเลขที่ ${project.contract_number || '-'} ลงวันที่ ${formatThaiDate(project.start_date)}</div>
    <div style="margin-bottom: 12px;"><strong>สิ่งที่ส่งมาด้วย:</strong> เอกสารรายงานหลักฐานภาพถ่ายการดำเนินงานตาม TOR จำนวน 1 ชุด</div>

    <div class="letter-body">
      ตามที่ ${project.contractor || 'ผู้รับจ้าง'} ได้เข้าทำสัญญาจ้างกับ ${project.government_agency || 'หน่วยงาน'} ตามสัญญาเลขที่ ${project.contract_number || '-'} เพื่อดำเนินการ ${project.name} ณ ${project.location || 'สถานที่ตามสัญญา'} นั้น
    </div>
    <div class="letter-body">
      บัดนี้ ผู้รับจ้างได้ดำเนินงานตามขอบเขตข้อกำหนดของงาน (Terms of Reference : TOR) ครบถ้วนถูกต้องตามมาตรฐานสัญญาเรียบร้อยแล้ว จึงขอส่งมอบงานดังกล่าว พร้อมแนบเอกสารรายงานหลักฐานภาพถ่ายประกอบการพิจารณา เพื่อให้คณะกรรมการตรวจรับพัสดุได้โปรดดำเนินการตรวจรับงานต่อไป
    </div>

    <div style="margin-top: 40px; margin-left: 55%; text-align: center;">
      <div>ขอแสดงความนับถือ</div>
      <div class="sig-line"></div>
      <div style="margin-top: 6px;">(${project.project_manager || 'นายกิตติศักดิ์ พัฒนเสรี'})</div>
      <div style="font-size: 14pt; color: #4a5568;">ผู้จัดการโครงการ / ผู้มีอำนาจลงนาม</div>
    </div>

    <div class="page-footer">
      <span>${project.code}</span>
      <span>หน้าที่ 2</span>
    </div>
  </div>

  <!-- 3. TOR EVIDENCE ITEMS PAGES (2 Items / Page default) -->
  ${pagedItems.map((pageGroup, pageIdx) => `
    <div class="page">
      <div class="page-header">
        <span><strong>${project.code}</strong> - รายงานหลักฐานภาพถ่ายตาม TOR</span>
        <span>${template.header_text || ''}</span>
      </div>

      <div style="font-size: 18pt; font-weight: bold; color: #1a365d; margin-bottom: 10px;">
        ส่วนที่ 5: รายงานผลการดำเนินงานและหลักฐานภาพ (หน้า ${pageIdx + 1})
      </div>

      ${pageGroup.map(item => {
        const files = evidenceMap[item.id] || [];
        // Default to 4 slots if less
        const displaySlots = [0, 1, 2, 3];

        return `
          <div class="evidence-item-card">
            <div class="item-header">
              <span class="item-number">หัวข้อ ${item.item_number} : ${item.title}</span>
              <span class="item-status-badge">
                ${files.length >= (item.minimum_images || 4) ? '🟢 ครบถ้วนสมบูรณ์' : '🟡 กำลังดำเนินงาน'} (${files.length}/${item.minimum_images || 4} ภาพ)
              </span>
            </div>

            <div class="item-requirement-box">
              <strong>ข้อกำหนดตาม TOR:</strong> ${item.requirement}
              ${item.dimensions ? `<br><strong>ขนาด/มิติ:</strong> ${item.dimensions}` : ''}
              ${item.quantity ? ` | <strong>จำนวน:</strong> ${item.quantity} ${item.unit || ''}` : ''}
            </div>

            <div class="image-grid-4">
              ${displaySlots.map(slotIdx => {
                const file = files[slotIdx];
                if (file) {
                  // Resolve absolute file path or fallback to base64
                  let imgSrc = '';
                  const targetPath = path.resolve(STORAGE_ROOT, file.print_path || file.preview_path || file.original_path);
                  if (fs.existsSync(targetPath)) {
                    const imgBuffer = fs.readFileSync(targetPath);
                    imgSrc = `data:${file.mime_type || 'image/jpeg'};base64,${imgBuffer.toString('base64')}`;
                  } else {
                    imgSrc = 'https://placehold.co/600x400/e2e8f0/4a5568?text=Evidence+Photo';
                  }

                  return `
                    <div class="evidence-photo-box">
                      <img class="evidence-photo-img" src="${imgSrc}" alt="Evidence ${slotIdx + 1}" />
                      <div class="photo-caption">
                        ภาพที่ ${slotIdx + 1}: ${file.caption || file.capture_type || 'ภาพหลักฐาน'}
                        ${file.captured_at ? ` | ${new Date(file.captured_at).toLocaleTimeString('th-TH')}` : ''}
                      </div>
                    </div>
                  `;
                } else {
                  return `
                    <div class="evidence-photo-box">
                      <div class="evidence-photo-img" style="display: flex; align-items: center; justify-content: center; color: #a0aec0; font-size: 14pt;">
                        [ รอแนบภาพหลักฐานที่ ${slotIdx + 1} ]
                      </div>
                      <div class="photo-caption" style="color: #a0aec0;">(ยังไม่ได้บันทึกภาพ)</div>
                    </div>
                  `;
                }
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}

      <div class="page-footer">
        <span>${project.name}</span>
        <span>หน้าที่ ${pageIdx + 3}</span>
      </div>
    </div>
  `).join('')}

  <!-- 4. SIGNATURES PAGE -->
  <div class="page">
    <div class="page-header">
      <span>${template.header_text || 'เอกสารประกอบการส่งมอบงาน'}</span>
      <span>${project.code}</span>
    </div>

    <div style="text-align: center; margin-top: 15px; margin-bottom: 25px;">
      <div style="font-size: 22pt; font-weight: bold; color: #1a365d;">การรับรองผลการดำเนินงานและลายมือชื่อ</div>
      <div style="font-size: 15pt; color: #4a5568;">ขอรับรองว่าหลักฐานภาพถ่ายและรายละเอียดผลงานข้างต้นถูกต้องและตรงตามความเป็นจริงทุกประการ</div>
    </div>

    <table class="sig-table">
      <tr>
        <td class="sig-cell">
          <strong>ผู้จัดทำรายงาน / ตัวแทนผู้รับจ้าง</strong>
          <div class="sig-line"></div>
          <div style="margin-top: 6px;">(............................................................)</div>
          <div style="font-size: 14pt; color: #4a5568;">เจ้าหน้าที่ผู้บันทึกหลักฐานหน้างาน</div>
          <div style="font-size: 13pt; margin-top: 4px;">วันที่ ........../........../..........</div>
        </td>
        <td class="sig-cell">
          <strong>ผู้จัดการโครงการ (Project Manager)</strong>
          <div class="sig-line"></div>
          <div style="margin-top: 6px;">(${project.project_manager || 'นายกิตติศักดิ์ พัฒนเสรี'})</div>
          <div style="font-size: 14pt; color: #4a5568;">ผู้ควบคุมการดำเนินงาน</div>
          <div style="font-size: 13pt; margin-top: 4px;">วันที่ ........../........../..........</div>
        </td>
      </tr>
      <tr>
        <td class="sig-cell" style="padding-top: 30px;">
          <strong>ผู้ตรวจสอบงานภาคสนาม (Inspector)</strong>
          <div class="sig-line"></div>
          <div style="margin-top: 6px;">(............................................................)</div>
          <div style="font-size: 14pt; color: #4a5568;">ผู้แทนหน่วยงานเจ้าของโครงการ</div>
          <div style="font-size: 13pt; margin-top: 4px;">วันที่ ........../........../..........</div>
        </td>
        <td class="sig-cell" style="padding-top: 30px;">
          <strong>ประธานคณะกรรมการตรวจรับพัสดุ</strong>
          <div class="sig-line"></div>
          <div style="margin-top: 6px;">(............................................................)</div>
          <div style="font-size: 14pt; color: #4a5568;">ประธานคณะกรรมการฯ</div>
          <div style="font-size: 13pt; margin-top: 4px;">วันที่ ........../........../..........</div>
        </td>
      </tr>
    </table>

    <div class="page-footer">
      <span>${project.code}</span>
      <span>หน้าสุดท้าย</span>
    </div>
  </div>

</body>
</html>`;
  }

  /**
   * Render HTML directly into an A4 PDF using Headless Chrome
   */
  static async renderToPDF(options: ReportRenderOptions): Promise<string> {
    const htmlContent = this.buildReportHTML(options);
    const tempHtmlPath = path.join(path.dirname(options.outputPath), `temp-${Date.now()}.html`);

    fs.writeFileSync(tempHtmlPath, htmlContent, 'utf-8');

    try {
      const args = [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--no-pdf-header-footer',
        `--print-to-pdf=${options.outputPath}`,
        tempHtmlPath
      ];

      await execFileAsync(CHROME_PATH, args);

      // Verify file exists
      if (!fs.existsSync(options.outputPath)) {
        throw new Error('PDF output file was not generated by Chrome');
      }

      return options.outputPath;
    } finally {
      // Clean up temporary HTML file
      if (fs.existsSync(tempHtmlPath)) {
        fs.unlinkSync(tempHtmlPath);
      }
    }
  }
}
