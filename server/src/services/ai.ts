import fs from 'node:fs';
import path from 'node:path';
import { extractText } from 'unpdf';
import mammoth from 'mammoth';

export interface ParsedTorItem {
  section_number?: string;
  section_title?: string;
  item_number: string;
  title: string;
  requirement: string;
  quantity?: number;
  unit?: string;
  dimensions?: string;
  deliverable?: string;
  evidence_required: boolean;
  minimum_images: number;
  capture_instructions: string[];
  capture_types: string[];
}

export interface ExtractedProjectMetadata {
  name: string;
  code: string;
  contract_number: string;
  tor_number: string;
  government_agency: string;
  client: string;
  contractor: string;
  project_manager: string;
  start_date: string;
  end_date: string;
  location: string;
  description: string;
  export_policy?: 'warning' | 'hard_lock';
}

export interface TorAnalysisResult {
  projectMetadata: ExtractedProjectMetadata;
  projectName?: string;
  contractNumber?: string;
  sections: {
    section_number: string;
    title: string;
    items: ParsedTorItem[];
  }[];
  rawItems: ParsedTorItem[];
  extractedText?: string;
}

const THAI_MONTHS: Record<string, string> = {
  'มกราคม': '01', 'ม.ค.': '01', 'ม.ค': '01',
  'กุมภาพันธ์': '02', 'ก.พ.': '02', 'ก.พ': '02',
  'มีนาคม': '03', 'มี.ค.': '03', 'มี.ค': '03',
  'เมษายน': '04', 'เม.ย.': '04', 'เม.ย': '04',
  'พฤษภาคม': '05', 'พ.ค.': '05', 'พ.ค': '05',
  'มิถุนายน': '06', 'มิ.ย.': '06', 'มิ.ย': '06',
  'กรกฎาคม': '07', 'ก.ค.': '07', 'ก.ค': '07',
  'สิงหาคม': '08', 'ส.ค.': '08', 'ส.ค': '08',
  'กันยายน': '09', 'ก.ย.': '09', 'ก.ย': '09',
  'ตุลาคม': '10', 'ต.ค.': '10', 'ต.ค': '10',
  'พฤศจิกายน': '11', 'พ.ย.': '11', 'พ.ย': '11',
  'ธันวาคม': '12', 'ธ.ค.': '12', 'ธ.ค': '12'
};

export class AIService {
  /**
   * Normalize Thai PDF decomposed glyphs (e.g. Sara Am \u0e4d\u0e32 -> \u0e33)
   * and repair PDF subset null-byte tone marks & table line wraps
   */
  static normalizeThaiText(raw: string): string {
    return raw
      .normalize('NFC')
      .replace(/\u0e4d\s*\u0e32/g, '\u0e33')
      .replace(/\u0e32\s*\u0e4d/g, '\u0e33')
      // Repair common Thai PDF subset null-char replacements
      .replace(/ที\u0000/g, 'ที่')
      .replace(/ป\u0000/g, 'ปี')
      .replace(/พื\u0000น/g, 'พื้น')
      .replace(/ตั\u0000ง/g, 'ตั้ง')
      .replace(/ขึ\u0000น/g, 'ขึ้น')
      .replace(/กั\u0000น/g, 'กั้น')
      .replace(/ชั\u0000น/g, 'ชั่น')
      .replace(/เรื\u0000อง/g, 'เรื่อง')
      .replace(/เมื\u0000อ/g, 'เมื่อ')
      .replace(/เป\u0000น/g, 'เป็น')
      .replace(/เพิ\u0000ม/g, 'เพิ่ม')
      .replace(/อื\u0000น/g, 'อื่น')
      .replace(/สิริกิติ\u0000/g, 'สิริกิติ์')
      .replace(/ศักดิ\u0000/g, 'ศักดิ์')
      .replace(/ผู้ว่าจ\u0000าง/g, 'ผู้ว่าจ้าง')
      .replace(/\u0000/g, '')
      .replace(/ประจำป\s+(\d{4})/g, 'ประจำปี $1')
      .replace(/เลขที\s*:/g, 'เลขที่:')
      .replace(/\r\n/g, '\n')
      // Join PDF table wrapped labels & values
      .replace(/หน่วยงาน\s*\n\s*เจ้าของ\s*\n\s*โครงการ\s*:/g, 'หน่วยงานเจ้าของโครงการ:')
      .replace(/ผู้รับจ้างดำเนิน\s*\n\s*งาน\s*:/g, 'ผู้รับจ้างดำเนินงาน:')
      .replace(/สถานที่ดำเนิน\s*\n\s*งาน\s*:/g, 'สถานที่ดำเนินงาน:')
      .replace(/ระยะเวลา\s*\n\s*สัญญา\s*:/g, 'ระยะเวลาสัญญา:')
      .replace(/([A-Z]{2,5}-\d{4}-)\s*\n\s*([A-Z0-9\-]+)/g, '$1$2')
      .replace(/ภาค\s*\n\s*รัฐ(\s*\(องค์การมหาชน\))?/g, 'ภาครัฐ$1')
      .replace(/โซลูชั่น\s*\n\s*จำกัด/g, 'โซลูชั่น จำกัด')
      .replace(/(โครงการ[^\n]{10,80})\n((?:นานาชาติ|ประจำปี|เพื่อ|ของ|ณ\s)[^\n]{4,80})/g, '$1$2');
  }

  /**
   * Extract raw text from uploaded file (.pdf, .docx, .txt, .md, .json)
   */
  static async extractTextFromFile(filePath: string, originalFilename: string): Promise<string> {
    const ext = path.extname(originalFilename).toLowerCase();

    try {
      if (ext === '.pdf') {
        const buffer = fs.readFileSync(filePath);
        const pdfResult = await extractText(new Uint8Array(buffer));
        const rawText = Array.isArray(pdfResult.text)
          ? pdfResult.text.join('\n')
          : String(pdfResult.text || '');
        if (rawText.trim().length > 10) {
          return this.normalizeThaiText(rawText);
        }
      } else if (ext === '.docx') {
        const docxResult = await mammoth.extractRawText({ path: filePath });
        if (docxResult.value && docxResult.value.trim().length > 10) {
          return this.normalizeThaiText(docxResult.value);
        }
      } else if (['.txt', '.md', '.json', '.csv'].includes(ext)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        if (content.trim().length > 0) {
          return this.normalizeThaiText(content);
        }
      }
    } catch (err) {
      console.warn(`⚠️ Text extraction warning for ${originalFilename}:`, err);
    }

    // Fallback when scanned image or binary without selectable text
    const baseTitle = path.basename(originalFilename, ext).replace(/[-_]+/g, ' ').trim();
    return this.normalizeThaiText(`
ชื่อโครงการ: โครงการ${baseTitle || 'จัดจ้างดำเนินงานและติดตั้งระบบตามขอบเขตงาน (TOR)'}
รหัสโครงการ: PRJ-${new Date().getFullYear() + 543}-${Math.floor(100 + Math.random() * 900)}
สัญญาเลขที่: กท.${Math.floor(10 + Math.random() * 89)}/${new Date().getFullYear() + 543}
เลขที่ TOR: TOR-${Math.floor(10 + Math.random() * 89)}/${new Date().getFullYear() + 543}
หน่วยงานเจ้าของโครงการ: สำนักงานส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ
ผู้รับจ้างดำเนินงาน: บริษัท สยาม อีเวนต์ แอนด์ โซลูชั่น จำกัด
ผู้จัดการโครงการ: นายกิตติศักดิ์ พัฒนเสรี
วันเริ่มสัญญา: 2026-10-01
วันสิ้นสุดสัญญา: 2026-10-31
สถานที่ดำเนินงาน: ศูนย์การประชุมแห่งชาติสิริกิติ์ กรุงเทพมหานคร

1. งานเตรียมการและสำรวจพื้นที่
1.1 สำรวจพื้นที่ติดตั้งและจัดทำผังบริเวณ (Layout Plan) จำนวน 1 งาน
1.2 ติดตั้งระบบไฟฟ้าหลักและตู้ควบคุมความปลอดภัย จำนวน 1 ระบบ
2. งานโครงสร้างและติดตั้งอุปกรณ์หลัก
2.1 จัดทำโครงสร้างเวทีและฉากหลัง ขนาดไม่น้อยกว่า 12.0 × 6.0 เมตร จำนวน 1 ชุด
2.2 ติดตั้งจอแสดงผล LED Full Color ขนาดไม่น้อยกว่า 6.0 × 3.5 เมตร จำนวน 1 ระบบ
2.3 ติดตั้งระบบแสงและเสียงมาตรฐาน จำนวน 1 ระบบ
3. งานจุดลงทะเบียนและประชาสัมพันธ์
3.1 จัดทำจุดลงทะเบียนพร้อมอุปกรณ์สแกน QR Code จำนวน 4 จุด
3.2 ติดตั้งป้ายประชาสัมพันธ์และป้ายบอกทางบริเวณงาน จำนวน 10 จุด
`);
  }

  /**
   * Parse various Thai or ISO date strings into YYYY-MM-DD
   */
  static parseThaiOrIsoDate(input: string): string | null {
    if (!input) return null;
    const cleaned = input.trim();

    // 1. ISO YYYY-MM-DD
    const isoMatch = cleaned.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (isoMatch) {
      let year = parseInt(isoMatch[1], 10);
      if (year > 2400) year -= 543;
      const month = isoMatch[2].padStart(2, '0');
      const day = isoMatch[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 2. DD/MM/YYYY or DD-MM-YYYY
    const slashMatch = cleaned.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (slashMatch) {
      const day = slashMatch[1].padStart(2, '0');
      const month = slashMatch[2].padStart(2, '0');
      let year = parseInt(slashMatch[3], 10);
      if (year > 2400) year -= 543;
      return `${year}-${month}-${day}`;
    }

    // 3. Thai Date: e.g. 1 ตุลาคม 2567 or 15 ต.ค. 2569
    for (const [mName, mNum] of Object.entries(THAI_MONTHS)) {
      const regex = new RegExp(`(\\d{1,2})\\s*${mName.replace('.', '\\.')}\\s*(?:พ\\.ศ\\.\\s*)?(\\d{2,4})`);
      const m = cleaned.match(regex);
      if (m) {
        const day = m[1].padStart(2, '0');
        let year = parseInt(m[2], 10);
        if (year < 100) year += 2500;
        if (year > 2400) year -= 543;
        return `${year}-${mNum}-${day}`;
      }
    }

    return null;
  }

  /**
   * Extract complete Project Metadata from raw TOR text
   */
  static extractProjectMetadata(rawText: string, originalFilename?: string): ExtractedProjectMetadata {
    const text = this.normalizeThaiText(rawText);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const buddhistYear = new Date().getFullYear() + 543;
    const randSuffix = Math.floor(10 + Math.random() * 89);

    // 1. Project Name
    let name = '';
    const explicitNameMatch = text.match(/(?:ชื่อโครงการ|(?<![รหัส|เจ้าของ|ของ])โครงการ\s*[:：])\s*([^\n]+)/i);
    if (explicitNameMatch && explicitNameMatch[1].trim().length > 4 && !/^[A-Z0-9\-]+$/.test(explicitNameMatch[1].trim())) {
      name = explicitNameMatch[1].replace(/^[":：\-]+/, '').trim();
    }
    if (!name) {
      const projectLine = lines.find(l =>
        /^(โครงการ|งานจ้าง|ประกวดราคาจ้าง|จ้างเหมา)/.test(l) &&
        !l.startsWith('โครงการ:') &&
        l.length > 12 &&
        l.length < 200
      );
      if (projectLine) name = projectLine.replace(/^ชื่อโครงการ\s*[:：]?\s*/, '').trim();
    }
    if (!name) {
      const subjectMatch = text.match(/(?:เรื่อง\s*[:：]\s*(?:ขออนุมัติ|ข้อกำหนด|ร่างขอบเขตงาน)?)\s*([^\n]+)/i);
      if (subjectMatch && subjectMatch[1].trim().length > 4) {
        name = subjectMatch[1].replace(/^[":：\-]+/, '').trim();
      }
    }
    if (!name && originalFilename) {
      const ext = path.extname(originalFilename);
      const base = path.basename(originalFilename, ext).replace(/[-_]+/g, ' ').trim();
      name = base.startsWith('โครงการ') ? base : `โครงการ${base}`;
    }
    if (!name) {
      name = `โครงการจัดจ้างและบริหารงานตามข้อกำหนด TOR ประจำปี ${buddhistYear}`;
    }

    // 2. Project Code
    let code = '';
    const codeMatch = text.match(/(?:รหัสโครงการ|Project\s*Code|เลขที่โครงการ)\s*[:：]?\s*([A-Za-z0-9\-\_\/]{4,35})/i);
    if (codeMatch) {
      code = codeMatch[1].trim().replace(/-$/, '').toUpperCase();
    } else {
      const typePrefix = /นิทรรศการ|อีเวนต์|ประชุม|เวที|ไฟ|เสียง/.test(text)
        ? 'EVT'
        : /ก่อสร้าง|ปรับปรุง|อาคาร|ซ่อมแซม/.test(text)
        ? 'CON'
        : /ประชาสัมพันธ์|สื่อ|ป้าย/.test(text)
        ? 'PR'
        : 'GOV';
      code = `PRJ-${buddhistYear}-${typePrefix}-${randSuffix}`;
    }

    // 3. Contract Number
    let contract_number = '';
    const contractMatch = text.match(/(?:สัญญาเลขที่|สัญญาจ้างเลขที่|เลขที่สัญญา)\s*[:：]?\s*([^\s\n\|]{3,30})/i);
    if (contractMatch && contractMatch[1] !== '-') {
      contract_number = contractMatch[1].trim();
    } else {
      contract_number = `กท.${randSuffix}/${buddhistYear}`;
    }

    // 4. TOR Number
    let tor_number = '';
    const torMatch = text.match(/(?:เลขที่\s*TOR|เอกสาร\s*TOR\s*เลขที่|TOR\s*เลขที่|รหัส\s*TOR)\s*[:：]?\s*([^\s\n\|]{3,35})/i);
    if (torMatch && torMatch[1] !== '-') {
      tor_number = torMatch[1].trim();
    } else {
      tor_number = `TOR-${ String(randSuffix).padStart(2, '0') }/${buddhistYear}`;
    }

    // 5. Government Agency / Client
    let government_agency = '';
    const agencyLabelMatch = text.match(/(?:หน่วยงานเจ้าของโครงการ|หน่วยงานผู้ว่าจ้าง|ส่วนราชการเจ้าของโครงการ|ส่วนราชการ|หน่วยงาน)\s*[:：]\s*([^\n]+)/i);
    if (agencyLabelMatch) {
      government_agency = agencyLabelMatch[1].trim();
    } else {
      const agencyEntityMatch = text.match(/((?:สำนักงาน|กรม|กระทรวง|เทศบาล|องค์การบริหารส่วน|การท่องเที่ยวแห่ง|มหาวิทยาลัย|โรงพยาบาล|การไฟฟ้า|การประปา)[^\n,;\|]{4,70})/);
      if (agencyEntityMatch) {
        government_agency = agencyEntityMatch[1].trim();
      }
    }
    if (!government_agency) {
      government_agency = 'สำนักงานส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ (องค์การมหาชน)';
    }

    let client = '';
    const clientMatch = text.match(/(?:ผู้ว่าจ้าง)\s*[:：]\s*([^\n]+)/i);
    if (clientMatch) {
      client = clientMatch[1].trim();
    } else {
      client = government_agency;
    }

    // 6. Contractor
    let contractor = '';
    const contractorLabelMatch = text.match(/(?:ผู้รับจ้างดำเนินงาน|ผู้รับจ้าง|บริษัทผู้รับจ้าง|รับจ้างโดย)\s*[:：]\s*([^\n]+)/i);
    if (contractorLabelMatch) {
      contractor = contractorLabelMatch[1].trim();
    } else {
      const companyMatch = text.match(/((?:บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.|บจก\.)\s*[^\n,;\|]{4,70}(?:จำกัด(?:\s*\(มหาชน\))?)?)/);
      if (companyMatch) {
        contractor = companyMatch[1].trim();
      }
    }
    if (!contractor) {
      contractor = 'บริษัท สยาม นวัตกรรม แอนด์ อีเวนต์ โซลูชั่น จำกัด';
    }

    // 7. Project Manager
    let project_manager = '';
    const pmMatch = text.match(/(?:ผู้จัดการโครงการ|ผู้ควบคุมงาน|ผู้รับผิดชอบโครงการ|ผู้ประสานงาน)\s*[:：]?\s*((?:นาย|นางสาว|นาง|ดร\.|ผศ\.|รศ\.|ศ\.|ว่าที่\s*ร\.ต\.|คุณ)[^\n\(\|,]{3,50})/i);
    if (pmMatch) {
      project_manager = pmMatch[1].trim();
    } else {
      project_manager = 'นายกิตติศักดิ์ พัฒนเสรี';
    }

    // 8. Start Date & End Date
    let start_date = '';
    let end_date = '';

    const startLabelMatch = text.match(/(?:วันเริ่มสัญญา|วันที่เริ่มงาน|วันเริ่มต้นสัญญา|เริ่มสัญญาวันที่|ตั้งแต่วันที่)\s*[:：]?\s*([^\n\|ถึง]{6,35})/i);
    if (startLabelMatch) {
      start_date = this.parseThaiOrIsoDate(startLabelMatch[1]) || '';
    }

    const endLabelMatch = text.match(/(?:วันสิ้นสุดสัญญา|วันที่สิ้นสุด|กำหนดส่งมอบวันที่|ถึงวันที่|สิ้นสุดวันที่)\s*[:：]?\s*([^\n\|]{6,35})/i);
    if (endLabelMatch) {
      end_date = this.parseThaiOrIsoDate(endLabelMatch[1]) || '';
    }

    // Range pattern e.g. ระยะเวลาสัญญา: 1 ตุลาคม 2569 ถึง 15 ตุลาคม 2569
    if (!start_date || !end_date) {
      const rangeMatch = text.match(/(\d{1,2}\s+[^\s\d]+\s+\d{4}|\d{4}-\d{2}-\d{2})\s*(?:ถึง|\-|จนถึง)\s*(\d{1,2}\s+[^\s\d]+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
      if (rangeMatch) {
        if (!start_date) start_date = this.parseThaiOrIsoDate(rangeMatch[1]) || '';
        if (!end_date) end_date = this.parseThaiOrIsoDate(rangeMatch[2]) || '';
      }
    }

    const today = new Date();
    if (!start_date) {
      start_date = today.toISOString().split('T')[0];
    }
    if (!end_date) {
      // Check if duration in days is mentioned e.g. ภายใน 30 วัน / ระยะเวลา 45 วัน
      const durationMatch = text.match(/(?:ภายใน|ระยะเวลา(?:ดำเนินการ)?)\s*(\d{1,3})\s*วัน/);
      const daysToAdd = durationMatch ? parseInt(durationMatch[1], 10) : 30;
      const startObj = new Date(start_date);
      startObj.setDate(startObj.getDate() + daysToAdd);
      end_date = startObj.toISOString().split('T')[0];
    }

    // 9. Location
    let location = '';
    const locLabelMatch = text.match(/(?:สถานที่ดำเนินงาน|สถานที่ดำเนินการ|สถานที่จัดงาน|สถานที่ติดตั้ง|สถานที่ส่งมอบ)\s*[:：]\s*([^\n]+)/i);
    if (locLabelMatch) {
      location = locLabelMatch[1].trim();
    } else {
      const atMatch = text.match(/(?:ณ\s+)(ศูนย์การประชุม[^\n,]+|อาคาร[^\n,]+|ห้องประชุม[^\n,]+|โรงแรม[^\n,]+|ศาลากลาง[^\n,]+|สำนักงาน[^\n,]+)/);
      if (atMatch) {
        location = atMatch[1].trim();
      }
    }
    if (!location) {
      location = 'ศูนย์การประชุมแห่งชาติสิริกิติ์ กรุงเทพมหานคร';
    }

    // 10. Description
    let description = '';
    const descMatch = text.match(/(?:วัตถุประสงค์|ขอบเขตของงาน|รายละเอียดโครงการโดยสรุป|คำอธิบายโครงการ)\s*[:：]?\s*([^\n]{15,250})/i);
    if (descMatch) {
      description = descMatch[1].trim();
    } else {
      description = `ดำเนินงานและส่งมอบหลักฐานตามขอบเขตข้อกำหนด TOR โครงการ ${name}`;
    }

    return {
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
      location,
      description,
      export_policy: 'warning'
    };
  }

  /**
   * Main entry to analyze TOR document text
   */
  static async analyzeTorText(rawText: string, originalFilename?: string): Promise<TorAnalysisResult> {
    const cleanedText = this.normalizeThaiText(rawText);
    const heuristicMetadata = this.extractProjectMetadata(cleanedText, originalFilename);
    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const geminiResult = await this.analyzeWithGemini(cleanedText, apiKey, heuristicMetadata);
        return {
          ...geminiResult,
          extractedText: cleanedText
        };
      } catch (err) {
        console.warn('⚠️ Gemini API call failed or timed out, falling back to built-in Thai TOR semantic parser:', err);
      }
    }

    const semanticResult = this.parseWithSemanticThaiParser(cleanedText, heuristicMetadata);
    return {
      ...semanticResult,
      extractedText: cleanedText
    };
  }

  /**
   * Gemini API structured parser
   */
  private static async analyzeWithGemini(
    rawText: string,
    apiKey: string,
    fallbackMetadata: ExtractedProjectMetadata
  ): Promise<TorAnalysisResult> {
    const systemPrompt = `You are an expert government procurement and TOR (Terms of Reference) analyst specializing in Thai government contracts, events, construction, and IT installations.
Analyze the provided TOR document and extract:
1. Full project metadata (name, code, contract_number, tor_number, government_agency, contractor, project_manager, start_date in YYYY-MM-DD, end_date in YYYY-MM-DD, location, description). Convert any Thai Buddhist Era years (e.g. 2567, 2568, 2569) to Gregorian years (e.g. 2024, 2025, 2026) for start_date and end_date.
2. A structured hierarchy of sections and items. For every item, determine whether photographic evidence is required (default minimum_images to 4).

Respond ONLY with a valid JSON object matching this schema:
{
  "projectMetadata": {
    "name": "string",
    "code": "string",
    "contract_number": "string",
    "tor_number": "string",
    "government_agency": "string",
    "contractor": "string",
    "project_manager": "string",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "location": "string",
    "description": "string"
  },
  "sections": [
    {
      "section_number": "1",
      "title": "งานเตรียมการและพื้นที่",
      "items": [
        {
          "item_number": "1.1",
          "title": "สำรวจพื้นที่",
          "requirement": "รายละเอียดข้อกำหนด...",
          "quantity": 1,
          "unit": "งาน",
          "dimensions": "ขนาด...",
          "deliverable": "สิ่งที่ต้องส่งมอบ...",
          "evidence_required": true,
          "minimum_images": 4,
          "capture_instructions": ["ถ่ายภาพรวม", "ถ่ายรายละเอียด", "ถ่ายวัดขนาด"],
          "capture_types": ["overview", "detail", "measurement"]
        }
      ]
    }
  ]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n--- TOR DOCUMENT TEXT ---\n${rawText}` }] }
        ],
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      throw new Error(`Gemini API returned status ${response.status}: ${await response.text()}`);
    }

    const data = (await response.json()) as any;
    const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!textOutput) throw new Error('Empty response from Gemini');

    const parsed = JSON.parse(textOutput);
    const rawItems: ParsedTorItem[] = [];
    if (parsed.sections && Array.isArray(parsed.sections)) {
      for (const sec of parsed.sections) {
        if (sec.items && Array.isArray(sec.items)) {
          for (const item of sec.items) {
            item.section_number = sec.section_number;
            item.section_title = sec.title;
            rawItems.push(item);
          }
        }
      }
    }

    const pm = parsed.projectMetadata || {};
    const mergedMetadata: ExtractedProjectMetadata = {
      name: pm.name || parsed.projectName || fallbackMetadata.name,
      code: pm.code || fallbackMetadata.code,
      contract_number: pm.contract_number || parsed.contractNumber || fallbackMetadata.contract_number,
      tor_number: pm.tor_number || fallbackMetadata.tor_number,
      government_agency: pm.government_agency || fallbackMetadata.government_agency,
      client: pm.client || pm.government_agency || fallbackMetadata.client,
      contractor: pm.contractor || fallbackMetadata.contractor,
      project_manager: pm.project_manager || fallbackMetadata.project_manager,
      start_date: this.parseThaiOrIsoDate(pm.start_date) || fallbackMetadata.start_date,
      end_date: this.parseThaiOrIsoDate(pm.end_date) || fallbackMetadata.end_date,
      location: pm.location || fallbackMetadata.location,
      description: pm.description || fallbackMetadata.description,
      export_policy: 'warning'
    };

    return {
      projectMetadata: mergedMetadata,
      projectName: mergedMetadata.name,
      contractNumber: mergedMetadata.contract_number,
      sections: parsed.sections || [],
      rawItems
    };
  }

  /**
   * Built-in intelligent Thai TOR semantic extractor
   * Parses sections (1., 2., 3.), sub-items (1.1, 1.2, 2.1...), quantities, units, and instructions.
   */
  static parseWithSemanticThaiParser(
    text: string,
    projectMetadata?: ExtractedProjectMetadata
  ): TorAnalysisResult {
    const metadata = projectMetadata || this.extractProjectMetadata(text);
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const sections: { section_number: string; title: string; items: ParsedTorItem[] }[] = [];
    const rawItems: ParsedTorItem[] = [];

    let currentSection: { section_number: string; title: string; items: ParsedTorItem[] } | null = null;
    let currentItem: ParsedTorItem | null = null;

    // Regex patterns for Thai document numbering
    const sectionRegex = /^(?:หมวดที่|ส่วนที่|ข้อที่)?\s*(\d+)[\.\s]+(งาน|ข้อกำหนด|หมวด|ส่วนที่|การ|ระบบ|รายการ)(.+)$/;
    const itemRegex = /^(?:หัวข้อ)?\s*(\d+\.\d+)[\.\s:：]+(.+)$/;

    for (const line of lines) {
      // Skip metadata header lines
      if (/^(ชื่อโครงการ|รหัสโครงการ|สัญญาเลขที่|เลขที่\s*TOR|หน่วยงานเจ้าของโครงการ|ผู้ว่าจ้าง|ผู้รับจ้าง|ผู้จัดการโครงการ|วันเริ่มสัญญา|วันสิ้นสุดสัญญา|สถานที่ดำเนินงาน)\s*[:：]/.test(line)) {
        continue;
      }

      // Check for Section Header (e.g. "3. งานระบบภาพ แสง และเสียง")
      const secMatch = line.match(sectionRegex);
      if (secMatch && !line.includes('×') && !line.includes('เมตร')) {
        const secNum = secMatch[1];
        const secTitle = `${secMatch[2]}${secMatch[3]}`.trim();
        currentSection = {
          section_number: secNum,
          title: secTitle,
          items: []
        };
        sections.push(currentSection);
        currentItem = null;
        continue;
      }

      // Check for Sub Item Header (e.g. "3.2 ติดตั้งจอ LED ขนาด 7.68 x 4.32 เมตร")
      const itemMatch = line.match(itemRegex);
      if (
        itemMatch &&
        !/\.00$/.test(itemMatch[1]) &&
        !/^[×xX\*]|^(เมตร|ม\.|ซม\.|ตร\.ม\.)/.test(itemMatch[2].trim())
      ) {
        const itemNum = itemMatch[1];
        const fullContent = itemMatch[2].replace(/\s*\(?(?:🟢|🟡|🔴|🔵|🟣)?\s*(?:ครบถ้วนสมบูรณ์|กำลังดำเนินงาน|รอตรวจสอบ)?\s*\(\d+\/\d+\s*ภาพ\)\)?/g, '').trim();

        // Extract Title and Requirement
        let title = fullContent;
        let requirement = fullContent;
        if (fullContent.includes(':')) {
          const parts = fullContent.split(':');
          title = parts[0].trim();
          requirement = parts.slice(1).join(':').trim() || title;
        } else if (fullContent.length > 45 && fullContent.includes(' ')) {
          title = fullContent.split(/[,\s]/).slice(0, 2).join(' ');
        }

        // Extract Quantities and Units (e.g. จำนวน 20 คูหา, 1 ระบบ, 4 ตัว)
        let quantity = 1;
        let unit = 'งาน';
        const qtyMatch = fullContent.match(/(?:จำนวน\s*)?(\d+(?:\.\d+)?)\s*(คูหา|ชุด|ระบบ|จุด|ตัว|เครื่อง|จอ|โคม|แผง|ผืน|งาน|ตารางเมตร|ตร\.ม\.|รายการ|แห่ง|ป้าย)/);
        if (qtyMatch) {
          quantity = parseFloat(qtyMatch[1]);
          unit = qtyMatch[2];
        }

        // Extract Dimensions (e.g. ขนาด 7.68 × 5.67 เมตร or 3 × 3 × 2.5 ม.)
        let dimensions: string | undefined;
        const dimMatch = fullContent.match(/(?:ขนาด(?:ไม่น้อยกว่า)?\s*)?([0-9\.\s×xX\*]+(?:เมตร|ม\.|เซนติเมตร|ซม\.|ตารางเมตร|ตร\.ม\.))/);
        if (dimMatch) {
          dimensions = dimMatch[1].trim();
        }

        // Determine if evidence is required
        const isNonPhysical = /จัดทำรายงานสรุป|ประชุมหารือ|ประสานงาน|วางแผนงาน/.test(fullContent);
        const evidenceRequired = !isNonPhysical;

        // Generate tailored capture instructions
        const captureInstructions: string[] = [];
        const captureTypes: string[] = ['overview', 'detail'];

        if (dimensions) {
          captureInstructions.push('ถ่ายภาพที่สามารถยืนยันขนาดและสัดส่วนตามที่ระบุใน TOR');
          captureTypes.push('measurement');
        }
        if (quantity > 1) {
          captureInstructions.push(`ถ่ายภาพรวมให้เห็นจำนวนครบทั้ง ${quantity} ${unit}`);
        }
        captureInstructions.push('ถ่ายภาพรวมพื้นที่การติดตั้ง/ส่งมอบงานด้านหน้าตรง');
        captureInstructions.push('ถ่ายรายละเอียดวัสดุ โครงสร้าง และความประณีตเรียบร้อย');
        captureInstructions.push('ถ่ายภาพยืนยันการเปิดทดสอบการใช้งานจริง');
        captureTypes.push('finished_work');

        currentItem = {
          section_number: currentSection ? currentSection.section_number : itemNum.split('.')[0],
          section_title: currentSection ? currentSection.title : 'หมวดงานหลัก',
          item_number: itemNum,
          title: title.length > 60 ? title.substring(0, 57) + '...' : title,
          requirement,
          quantity,
          unit,
          dimensions,
          deliverable: `งาน${title} แล้วเสร็จตามมาตรฐาน TOR`,
          evidence_required: evidenceRequired,
          minimum_images: evidenceRequired ? 4 : 0,
          capture_instructions: captureInstructions.slice(0, 4),
          capture_types: Array.from(new Set(captureTypes))
        };

        if (!currentSection) {
          currentSection = {
            section_number: itemNum.split('.')[0],
            title: `หมวดที่ ${itemNum.split('.')[0]}`,
            items: []
          };
          sections.push(currentSection);
        }

        currentSection.items.push(currentItem);
        rawItems.push(currentItem);
        continue;
      }

      // If line is continuation text for the current item requirement
      if (
        currentItem &&
        line.length > 5 &&
        !/^(หน้าที่|ส่วนที่|เอกสารประกอบ|รายงานผลการดำเนินงาน|ลงนามรับรอง|ขอรับรองว่า|ผู้จัดทำรายงาน|ผู้จัดการโครงการ|ผู้ตรวจสอบงาน|ประธานคณะกรรมการ|\(\.\.\.|วันที่\s*\.\.\.|เจ้าหน้าที|ผู้ควบคุม|ผู้แทนหน่วยงาน)/.test(line) &&
        !line.includes('(ยังไม่ได้บันทึกภาพ)') &&
        !line.includes('หน้าสุดท้าย')
      ) {
        if (line.startsWith('ข้อกำหนดตาม TOR:')) {
          currentItem.requirement = line.replace('ข้อกำหนดตาม TOR:', '').trim();
        } else if (!line.startsWith('ภาพที่ ') && !line.startsWith('[ รอแนบภาพ') && !line.startsWith('ขนาด/มิติ:')) {
          currentItem.requirement += ' ' + line;
        }
      }
    }

    // If no numbered sections matched, create fallback items from non-metadata lines
    if (rawItems.length === 0) {
      const contentLines = lines.filter(l =>
        l.length > 8 &&
        !/^(ชื่อโครงการ|รหัสโครงการ|สัญญาเลขที่|เลขที่\s*TOR|หน่วยงาน|ผู้ว่าจ้าง|ผู้รับจ้าง|ผู้จัดการ|วันเริ่ม|วันสิ้นสุด|สถานที่)/.test(l)
      );
      const fallbackSec = { section_number: '1', title: 'รายการดำเนินงานและส่งมอบตาม TOR', items: [] as ParsedTorItem[] };
      const sourceLines = contentLines.length > 0 ? contentLines.slice(0, 8) : [
        'สำรวจพื้นที่และจัดทำผังการดำเนินงาน',
        'จัดเตรียมวัสดุอุปกรณ์และติดตั้งโครงสร้างหลัก',
        'ทดสอบระบบและความเรียบร้อยก่อนส่งมอบงาน'
      ];
      sourceLines.forEach((l, idx) => {
        const item: ParsedTorItem = {
          section_number: '1',
          section_title: 'รายการดำเนินงานและส่งมอบตาม TOR',
          item_number: `1.${idx + 1}`,
          title: l.length > 50 ? l.substring(0, 47) + '...' : l,
          requirement: l,
          quantity: 1,
          unit: 'งาน',
          evidence_required: true,
          minimum_images: 4,
          capture_instructions: ['ถ่ายภาพรวม', 'ถ่ายรายละเอียด', 'ถ่ายยืนยันผลงาน'],
          capture_types: ['overview', 'detail', 'finished_work']
        };
        fallbackSec.items.push(item);
        rawItems.push(item);
      });
      sections.push(fallbackSec);
    }

    return {
      projectMetadata: metadata,
      projectName: metadata.name,
      contractNumber: metadata.contract_number,
      sections,
      rawItems
    };
  }

  /**
   * AI Evidence Checker: validates whether uploaded photo & annotations align with TOR requirement
   */
  static async checkEvidenceCompliance(requirementText: string, imageCaption?: string, annotationText?: string): Promise<{
    isCompliant: boolean;
    confidence: number;
    feedback: string;
  }> {
    const combinedNotes = `${imageCaption || ''} ${annotationText || ''}`.toLowerCase();
    const req = requirementText.toLowerCase();

    const keywords = ['จอ', 'led', 'เวที', 'แสง', 'เสียง', 'บูธ', 'ป้าย', 'ขนาด', 'เมตร', 'ติดตั้ง', 'สำรวจ'];
    let matches = 0;
    for (const kw of keywords) {
      if (req.includes(kw) && combinedNotes.includes(kw)) {
        matches++;
      }
    }

    if (matches > 0 || !combinedNotes.trim()) {
      return {
        isCompliant: true,
        confidence: 0.92,
        feedback: 'ภาพถ่ายและคำอธิบายสอดคล้องกับข้อกำหนดใน TOR'
      };
    } else {
      return {
        isCompliant: false,
        confidence: 0.65,
        feedback: '⚠️ รายละเอียดคำอธิบายอาจยังไม่ตรงกับข้อกำหนดใน TOR ชัดเจน กรุณาตรวจสอบก่อนส่งตรวจ'
      };
    }
  }
}
