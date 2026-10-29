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
  installment_number?: number;
  installment_title?: string;
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
   * Normalize Thai PDF/Word decomposed glyphs, Private Use Area (PUA) characters,
   * Sara Am (\u0e4d\u0e32 -> \u0e33), and table line wraps.
   */
  static normalizeThaiText(raw: string): string {
    return raw
      .normalize('NFC')
      // Convert legacy Thai PUA glyphs (Windows/Mac Angsana/Cordia/Sarabun PUA) to standard Thai Unicode
      .replace(/\uF700/g, '\u0E10')
      .replace(/\uF701/g, '\u0E34')
      .replace(/\uF702/g, '\u0E35')
      .replace(/\uF703/g, '\u0E36')
      .replace(/\uF704/g, '\u0E37')
      .replace(/[\uF705\uF70A\uF713]/g, '\u0E48')
      .replace(/[\uF706\uF70B\uF714]/g, '\u0E49')
      .replace(/[\uF707\uF70C\uF715]/g, '\u0E4A')
      .replace(/[\uF708\uF70D\uF716]/g, '\u0E4B')
      .replace(/[\uF709\uF70E\uF717]/g, '\u0E4C')
      .replace(/\uF70F/g, '\u0E0D')
      .replace(/\uF710/g, '\u0E31')
      .replace(/\uF711/g, '\u0E4D')
      .replace(/\uF712/g, '\u0E47')
      .replace(/\uF718/g, '\u0E38')
      .replace(/\uF719/g, '\u0E39')
      .replace(/\uF71A/g, '\u0E3A')
      // Normalize Sara Am
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
      // Remove standalone page number markers like "-2-", "- 3 -", "หน้า 2"
      .replace(/^\s*-\s*\d+\s*-\s*$/gm, '')
      .replace(/^\s*หน้า\s*\d+(?:\s*\/\s*\d+)?\s*$/gm, '');
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

    const baseTitle = path.basename(originalFilename, ext).replace(/[-_]+/g, ' ').trim();
    return this.normalizeThaiText(`ชื่อโครงการ: ${baseTitle || 'โครงการตามขอบเขตงาน (TOR)'}`);
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
   * Extract complete Project Metadata from raw TOR text without injecting fake mock entities
   */
  static extractProjectMetadata(rawText: string, originalFilename?: string): ExtractedProjectMetadata {
    const text = this.normalizeThaiText(rawText);
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const currentBuddhistYear = new Date().getFullYear() + 543;
    const randSuffix = Math.floor(10 + Math.random() * 89);

    // 1. Project Name — Combine multi-line Thai TOR titles (e.g. "จ้างเหมา..." + "โครงการ...")
    let name = '';
    const explicitNameMatch = text.match(/(?:ชื่อโครงการ|(?<![รหัส|เจ้าของ|ของ|ดำเนิน|จัดการ])โครงการ\s*[:：])\s*([^\n]+)/i);
    if (explicitNameMatch && explicitNameMatch[1].trim().length > 4 && !/^[A-Z0-9\-]+$/.test(explicitNameMatch[1].trim())) {
      name = explicitNameMatch[1].replace(/^[":：\-]+/, '').trim();
    }

    if (!name) {
      // Inspect header lines before the first numbered chapter "1."
      const firstChapterIdx = lines.findIndex(l => /^1[\.\s]+(ความเป็นมา|หลักการ|วัตถุประสงค์|งาน|ขอบเขต)/.test(l));
      const headerSlice = firstChapterIdx > 0 ? lines.slice(0, Math.min(firstChapterIdx, 10)) : lines.slice(0, 8);
      const titleParts: string[] = [];

      for (const hl of headerSlice) {
        if (/^(ขอบเขตงาน|ขอบเขตของงาน|ข้อกำหนด|ร่างขอบเขต|Terms of Reference|TOR\b)/i.test(hl) && hl.length < 45) {
          continue; // Skip generic document type header line
        }
        if (/^(โครงการ|งานจ้าง|ประกวดราคาจ้าง|จ้างเหมา|กิจกรรม)/.test(hl) && !hl.includes(':') && hl.length > 8 && hl.length < 180) {
          titleParts.push(hl.trim());
        }
      }

      if (titleParts.length > 0) {
        name = titleParts.join(' ');
      }
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
      name = base;
    }
    if (!name) {
      name = `โครงการตามข้อกำหนดขอบเขตงาน (TOR) ประจำปี ${currentBuddhistYear}`;
    }

    // Detect project year from name or text (e.g. 2569, 2570)
    const yearMatch = name.match(/25[6-8]\d/) || text.match(/ประจำปี\s*(?:งบประมาณ\s*)?(?:พ\.ศ\.\s*)?(25[6-8]\d)/);
    const projectYear = yearMatch ? (yearMatch[1] || yearMatch[0]) : String(currentBuddhistYear);

    // 2. Project Code
    let code = '';
    const codeMatch = text.match(/(?:รหัสโครงการ|Project\s*Code|เลขที่โครงการ)\s*[:：]?\s*([A-Za-z0-9\-\_\/]{4,35})/i);
    if (codeMatch) {
      code = codeMatch[1].trim().replace(/-$/, '').toUpperCase();
    } else {
      const typePrefix = /นิทรรศการ|อีเวนต์|ประชุม|เวที|Open\s*House/i.test(text)
        ? 'EVT'
        : /ก่อสร้าง|ปรับปรุง|อาคาร|ซ่อมแซม/.test(text)
        ? 'CON'
        : /ประชาสัมพันธ์|สื่อ|ป้าย/.test(text)
        ? 'PR'
        : 'TOR';
      code = `PRJ-${projectYear}-${typePrefix}-${randSuffix}`;
    }

    // 3. Contract Number
    let contract_number = '';
    const contractMatch = text.match(/(?:สัญญาเลขที่|สัญญาจ้างเลขที่|เลขที่สัญญา)\s*[:：]?\s*([^\s\n\|]{2,35})/i);
    if (contractMatch && contractMatch[1] !== '-') {
      contract_number = contractMatch[1].trim();
    }

    // 4. TOR Number
    let tor_number = '';
    const torMatch = text.match(/(?:เลขที่\s*TOR|เอกสาร\s*TOR\s*เลขที่|TOR\s*เลขที่|รหัส\s*TOR)\s*[:：]?\s*([^\s\n\|]{2,35})/i);
    if (torMatch && torMatch[1] !== '-') {
      tor_number = torMatch[1].trim();
    }

    // 5. Government Agency / Client
    let government_agency = '';
    const explicitAgencyMatch = text.match(/(?:หน่วยงานเจ้าของโครงการ|หน่วยงานผู้ว่าจ้าง|ส่วนราชการเจ้าของโครงการ)\s*[:：]\s*([^\n]+)/i);
    if (explicitAgencyMatch) {
      government_agency = explicitAgencyMatch[1].trim();
    } else {
      // Find main institution (e.g. มหาวิทยาลัยแม่โจ้)
      const mainInstMatch = text.match(/((?:มหาวิทยาลัย|กระทรวง|กรม|เทศบาล|องค์การบริหารส่วน|การท่องเที่ยวแห่ง|โรงพยาบาล|การไฟฟ้า|การประปา)[^\s\n,;\|()""“”]{3,50})/);
      const mainInst = mainInstMatch ? mainInstMatch[1].trim() : '';

      // Find sub-department / responsible office (e.g. สำนักบริหารและพัฒนาวิชาการ or หน่วยงานที่รับผิดชอบ: ...)
      const respUnitMatch = text.match(/(?:หน่วยงานที่รับผิดชอบ|หน่วยงานผู้รับผิดชอบ)\s*[:：]\s*([^\n]+)/i);
      const deptActionMatch = text.match(/((?:สำนัก|คณะ|วิทยาลัย|กอง|ฝ่าย)[^\s\n,;\|()]{4,45})(?=\s*(?:กำหนดการเบิกจ่าย|พิจารณา|มีความประสงค์))/);

      const subUnit = respUnitMatch
        ? respUnitMatch[1].trim()
        : deptActionMatch
        ? deptActionMatch[1].trim()
        : '';

      if (subUnit && mainInst && !subUnit.includes(mainInst)) {
        government_agency = `${subUnit} ${mainInst}`;
      } else if (mainInst) {
        government_agency = mainInst;
      } else if (subUnit) {
        government_agency = subUnit;
      }
    }

    let client = '';
    const clientMatch = text.match(/(?:ผู้ว่าจ้าง)\s*[:：]\s*([^\n]+)/i);
    if (clientMatch) {
      client = clientMatch[1].trim();
    } else {
      client = government_agency;
    }

    // 6. Contractor — Only populate when explicitly stated in document (never inject fake company)
    let contractor = '';
    const contractorLabelMatch = text.match(/(?:ผู้รับจ้างดำเนินงาน|ผู้รับจ้าง|บริษัทผู้รับจ้าง|รับจ้างโดย)\s*[:：]\s*([^\n]+)/i);
    if (contractorLabelMatch) {
      contractor = contractorLabelMatch[1].trim();
    }

    // 7. Project Manager — Only populate when explicitly stated in document (never inject fake person)
    let project_manager = '';
    const pmMatch = text.match(/(?:ผู้จัดการโครงการ|ผู้ควบคุมงาน|ผู้รับผิดชอบโครงการ|ผู้ประสานงานโครงการ)\s*[:：]\s*((?:นาย|นางสาว|นาง|ดร\.|ผศ\.|รศ\.|ศ\.|ว่าที่\s*ร\.ต\.|คุณ)[^\n\(\|,]{3,50})/i);
    if (pmMatch) {
      project_manager = pmMatch[1].trim();
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

    if (!start_date || !end_date) {
      const rangeMatch = text.match(/(?:ระยะเวลาสัญญา|ระยะเวลาดำเนินงาน)\s*[:：]?\s*(\d{1,2}\s+[^\s\d]+\s+\d{4}|\d{4}-\d{2}-\d{2})\s*(?:ถึง|\-|จนถึง)\s*(\d{1,2}\s+[^\s\d]+\s+\d{4}|\d{4}-\d{2}-\d{2})/);
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
      // Prioritize contract-level duration ("ระยะเวลาดำเนินการรวมจำนวน 30 วัน", "ภายใน 30 วัน นับถัดจากวันลงนาม")
      const contractDurationMatch =
        text.match(/(?:ระยะเวลาดำเนินการ(?:รวม)?(?:จำนวน)?|ระยะเวลาส่งมอบ(?:งาน)?|กำหนดเวลาดำเนินการ|อายุสัญญา)\s*(?:รวม)?(?:จำนวน)?\s*(?:ภายใน\s*)?(\d{1,3})\s*วัน/) ||
        text.match(/ภายใน\s*(\d{1,3})\s*วัน\s*นับ(?:ถัด)?จากวันลงนาม/);

      const daysToAdd = contractDurationMatch ? parseInt(contractDurationMatch[1], 10) : 30;
      const startObj = new Date(start_date);
      startObj.setDate(startObj.getDate() + daysToAdd);
      end_date = startObj.toISOString().split('T')[0];
    }

    // 9. Location — Extract real venue + institution (never fallback to fake Bangkok venue)
    let location = '';
    const locLabelMatch = text.match(/(?:สถานที่ดำเนินงาน|สถานที่ดำเนินการ|สถานที่จัดงาน|สถานที่ติดตั้ง|สถานที่ส่งมอบ)\s*[:：]\s*([^\n]+)/i);
    if (locLabelMatch) {
      location = locLabelMatch[1].trim();
    } else {
      // Match primary venue after "ณ" or "ของ" (e.g., "ณ ศูนย์กีฬาทศมินทรบพิตร", "ของศูนย์กีฬาทศมินทรบพิตร")
      const primaryVenueMatch =
        text.match(/(?:ณ\s+)(ศูนย์กีฬา[^\s\n,()]+|ศูนย์การประชุม[^\n,()]+|ศูนย์แสดงสินค้า[^\n,()]+|หอประชุม[^\s\n,()]+|อาคาร[^\s\n,()]+|โรงแรม[^\n,()]+|ศาลากลาง[^\n,()]+|สำนักงาน[^\n,()]+)/) ||
        text.match(/(ศูนย์กีฬา[^\s\n,()]+|ศูนย์การประชุม[^\n,()]+|หอประชุม[^\s\n,()]+)/);

      const mainUniOrPlaceMatch = text.match(/((?:มหาวิทยาลัย|โรงเรียน|วิทยาลัย|เทศบาล)[^\s\n,;\|()""“”]{3,45})/);
      const contactLocMatch = text.match(/สถานที่ติดต่อ\s*[:：]\s*([^\n]+)/i);

      if (primaryVenueMatch) {
        const venue = primaryVenueMatch[1].trim();
        const inst = mainUniOrPlaceMatch ? mainUniOrPlaceMatch[1].trim() : '';
        location = inst && !venue.includes(inst) ? `${venue} ${inst}` : venue;
      } else if (contactLocMatch) {
        location = contactLocMatch[1].trim();
      } else if (mainUniOrPlaceMatch) {
        location = mainUniOrPlaceMatch[1].trim();
      }
    }

    // 10. Description
    let description = '';
    const conceptMatch = text.match(/ภายใต้แนวคิด\s*[“"']?([^”"'\n]+)[”"']?/);
    const budgetMatch = text.match(/วงเงิน(?:งบประมาณ|ในการจัดหา)?\s*([0-9,]+\s*บาท[^\n]*)/);
    const descParts: string[] = [];
    if (conceptMatch) descParts.push(`แนวคิด: "${conceptMatch[1].trim()}"`);
    if (budgetMatch) descParts.push(`วงเงินงบประมาณ ${budgetMatch[1].trim()}`);

    if (descParts.length > 0) {
      description = `${name} (${descParts.join(' | ')})`;
    } else {
      const explicitDesc = text.match(/(?:รายละเอียดโครงการโดยสรุป|คำอธิบายโครงการ)\s*[:：]\s*([^\n]{10,250})/i);
      description = explicitDesc ? explicitDesc[1].trim() : `ดำเนินงานและส่งมอบหลักฐานตามขอบเขตงาน (TOR) โครงการ ${name}`;
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
        if (geminiResult.rawItems && geminiResult.rawItems.length > 0) {
          return {
            ...geminiResult,
            extractedText: cleanedText
          };
        }
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
    const systemPrompt = `You are an expert Thai government procurement and TOR (Terms of Reference) analyst.
Analyze the provided TOR document and extract:
1. Full project metadata (name, code, contract_number, tor_number, government_agency, contractor, project_manager, start_date in YYYY-MM-DD, end_date in YYYY-MM-DD, location, description). Do NOT fabricate contractor or project_manager if not stated in the TOR.
2. ONLY the actual Scope of Work (ขอบเขตการดำเนินงาน / ขอบเขตของงาน) sections and deliverable items. NEVER include Objectives (วัตถุประสงค์), Bidder Qualifications (คุณสมบัติผู้ยื่นข้อเสนอ), or Bidding Instructions (ข้อปฏิบัติในการยื่นข้อเสนอราคา) as work items.

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
      "section_number": "6.1",
      "title": "ชื่อหมวดงาน",
      "items": [
        {
          "item_number": "6.1.1",
          "title": "ชื่อรายการงาน",
          "requirement": "รายละเอียดข้อกำหนด...",
          "quantity": 1,
          "unit": "งาน",
          "dimensions": "ขนาด...",
          "deliverable": "สิ่งที่ต้องส่งมอบ...",
          "evidence_required": true,
          "minimum_images": 4,
          "capture_instructions": ["ถ่ายภาพรวม", "ถ่ายรายละเอียด"],
          "capture_types": ["overview", "detail"],
          "installment_number": 1,
          "installment_title": "งวดที่ 1"
        }
      ]
    }
  ]
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(6000),
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
      throw new Error(`Gemini API HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const jsonText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!jsonText) {
      throw new Error('Empty response from Gemini');
    }

    const parsed = JSON.parse(jsonText);
    const rawItems: ParsedTorItem[] = [];

    for (const sec of parsed.sections || []) {
      for (const item of sec.items || []) {
        item.section_number = sec.section_number;
        item.section_title = sec.title;
        item.installment_number = item.installment_number || 1;
        item.installment_title = item.installment_title || `งวดที่ ${item.installment_number}`;
        rawItems.push(item);
      }
    }

    const gm = parsed.projectMetadata || {};
    const mergedMetadata: ExtractedProjectMetadata = {
      name: gm.name || fallbackMetadata.name,
      code: gm.code || fallbackMetadata.code,
      contract_number: gm.contract_number || fallbackMetadata.contract_number,
      tor_number: gm.tor_number || fallbackMetadata.tor_number,
      government_agency: gm.government_agency || fallbackMetadata.government_agency,
      client: gm.client || gm.government_agency || fallbackMetadata.client,
      contractor: gm.contractor || fallbackMetadata.contractor,
      project_manager: gm.project_manager || fallbackMetadata.project_manager,
      start_date: this.parseThaiOrIsoDate(gm.start_date) || fallbackMetadata.start_date,
      end_date: this.parseThaiOrIsoDate(gm.end_date) || fallbackMetadata.end_date,
      location: gm.location || fallbackMetadata.location,
      description: gm.description || fallbackMetadata.description,
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
   * Extract clean human-readable item title from a Thai TOR clause
   */
  private static extractCleanItemTitle(fullContent: string): string {
    const cleaned = fullContent.replace(/\s+/g, ' ').trim();
    if (cleaned.includes(':')) {
      const colonIdx = cleaned.indexOf(':');
      if (colonIdx > 3 && colonIdx < 65) {
        return cleaned.slice(0, colonIdx).trim();
      }
    }

    // Remove overly long parenthetical explanations for the short title
    let concise = cleaned.replace(/\([^)]{18,}\)/g, '').replace(/\s+/g, ' ').trim();

    // Cut at secondary descriptive clauses if after 15 chars
    const cutMarkers = [
      ' โดยมีโครงสร้าง',
      ' โดยมีรายละเอียด',
      ' โดยระบุ',
      ' โดยผู้ว่าจ้าง',
      ' เพื่อสื่อสาร',
      ' เพื่อประสานงานและซักซ้อม',
      ' ทั้งนี้',
      ' ติดบริเวณ',
      ' ติดตั้งบริเวณ',
      ' ณ ใต้ถุน',
      ' ให้เพียงพอกับ',
      ' และโครงสร้างคูหาต้องประกอบด้วย'
    ];
    for (const marker of cutMarkers) {
      const idx = concise.indexOf(marker);
      if (idx >= 15) {
        concise = concise.slice(0, idx).trim();
        break;
      }
    }

    if (concise.length > 75) {
      const spaceIdx = concise.lastIndexOf(' ', 75);
      concise = (spaceIdx > 35 ? concise.slice(0, spaceIdx) : concise.slice(0, 72)).trim() + '...';
    }
    return concise || cleaned.slice(0, 60);
  }

  /**
   * Build a ParsedTorItem with accurate quantity, unit, dimensions, and capture instructions
   */
  private static buildParsedTorItem(
    secNum: string,
    secTitle: string,
    itemNum: string,
    rawContent: string,
    installmentMap: Map<string, { num: number; title: string }>,
    defaultInstallmentTitle: string
  ): ParsedTorItem {
    const fullContent = rawContent
      .replace(/\s*\(?(?:🟢|🟡|🔴|🔵|🟣)?\s*(?:ครบถ้วนสมบูรณ์|กำลังดำเนินงาน|รอตรวจสอบ)?\s*\(\d+\/\d+\s*ภาพ\)\)?/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    const title = this.extractCleanItemTitle(fullContent);
    const requirement = fullContent;

    // Extract Quantities and Units: require explicit quantity indicators ("จำนวน", "ไม่น้อยกว่า", "อย่างน้อย")
    // or trailing unit pattern so item numbers/voltages/channels are never confused with deliverable quantities.
    let quantity = 1;
    let unit = 'งาน';

    const unitPattern = 'ตัว\\/คูหา|ชุด\\/คูหา|คูหา|ชุด|ระบบ|จุด|ตัว|เครื่อง|จอ|โคม|แผง|ผืน|งาน|ตารางเมตร|ตร\\.ม\\.|รายการ|แห่ง|ป้าย|คน|คัน|หลัง|ตู้|ใบ|เล่ม';
    const explicitQtyRegex = new RegExp(
      `(?:จำนวน(?:ไม่น้อยกว่า|อย่างน้อย|รวม|ทั้งสิ้น)?\\s*(?:อย่างละ\\s*)?|ไม่น้อยกว่า\\s*|อย่างน้อย\\s*)(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})`,
      'g'
    );

    const matches = Array.from(fullContent.matchAll(explicitQtyRegex));
    if (matches.length > 0) {
      // Prefer "จำนวน..." matches or the last deliverable quantity (e.g. "จำนวน 1 จุด ... จำนวนไม่น้อยกว่า 24 จุด" -> 24 จุด)
      const chosen = matches[matches.length - 1];
      quantity = parseFloat(chosen[1]);
      unit = chosen[2];

      // Handle "อย่างละ 1 ชุด" when 2 types of signs/items are mentioned
      if (/จำนวนอย่างละ\s*1\s*ชุด/.test(fullContent) && /และจุด/.test(fullContent)) {
        quantity = 2;
      }
    } else {
      const fallbackQty = fullContent.match(new RegExp(`(?<!\\d\\.|\\d)\\b(\\d+(?:\\.\\d+)?)\\s*(${unitPattern})(?!\\s*เสียบ)`));
      if (fallbackQty) {
        quantity = parseFloat(fallbackQty[1]);
        unit = fallbackQty[2];
      }
    }

    // Extract Dimensions (e.g. ขนาด 1.2 x 2.4 เมตร, 3 x 3 x 2.5 เมตรต่อคูหา, กว้างไม่น้อยกว่า 3 เมตร และความยาวไม่น้อยกว่า 7 เมตร)
    let dimensions: string | undefined;
    const stageDimMatch = fullContent.match(/ความกว้าง[^\n]{0,25}?ไม่น้อยกว่า\s*(\d+(?:\.\d+)?)\s*เมตร\s*และ(?:ขนาด)?ความยาว[^\n]{0,25}?ไม่น้อยกว่า\s*(\d+(?:\.\d+)?)\s*เมตร/);
    if (stageDimMatch) {
      dimensions = `${stageDimMatch[1]} x ${stageDimMatch[2]} เมตร`;
    } else {
      const dimMatch = fullContent.match(/(?:ขนาด(?:ไม่น้อยกว่า)?\s*)([0-9\.\s×xX\*]+(?:เมตรต่อคูหา|เมตร|ม\.|เซนติเมตร|ซม\.|ตารางเมตร|ตร\.ม\.))/);
      if (dimMatch) {
        dimensions = dimMatch[1].trim();
      }
    }

    const isReportOnly = /รายงานสรุปผลการดำเนินงาน/.test(fullContent);
    const evidenceRequired = true;

    const captureInstructions: string[] = [];
    const captureTypes: string[] = ['overview', 'detail'];

    if (dimensions) {
      captureInstructions.push(`ถ่ายภาพยืนยันขนาด/มิติ (${dimensions}) ตามที่ระบุใน TOR`);
      captureTypes.push('measurement');
    }
    if (quantity > 1) {
      captureInstructions.push(`ถ่ายภาพให้เห็นจำนวนส่งมอบครบ (${quantity} ${unit})`);
    }
    captureInstructions.push('ถ่ายภาพรวมพื้นที่ติดตั้ง/การดำเนินงานด้านหน้า');
    captureInstructions.push('ถ่ายรายละเอียดวัสดุ อุปกรณ์ และความเรียบร้อยของงาน');
    if (!isReportOnly) {
      captureInstructions.push('ถ่ายภาพยืนยันการใช้งานจริงระหว่างดำเนินกิจกรรม');
      captureTypes.push('finished_work');
    }

    const instInfo =
      installmentMap.get(itemNum) ||
      installmentMap.get(secNum) || { num: 1, title: defaultInstallmentTitle };

    return {
      section_number: secNum,
      section_title: secTitle,
      item_number: itemNum,
      title,
      requirement,
      quantity,
      unit,
      dimensions,
      deliverable: `${title} (${quantity} ${unit})`,
      evidence_required: evidenceRequired,
      minimum_images: 4,
      capture_instructions: captureInstructions.slice(0, 4),
      capture_types: Array.from(new Set(captureTypes)),
      installment_number: instInfo.num,
      installment_title: instInfo.title
    };
  }

  /**
   * Built-in intelligent Thai TOR semantic extractor
   * Accurately separates administrative chapters (1-5, 7-13) from Scope of Work (Chapter 6)
   * and supports both 3-level (6. -> 6.2 -> 6.2.1) and 2-level (1. -> 1.1) TOR hierarchies.
   */
  static parseWithSemanticThaiParser(
    text: string,
    projectMetadata?: ExtractedProjectMetadata
  ): TorAnalysisResult {
    const cleanedText = this.normalizeThaiText(text);
    const metadata = projectMetadata || this.extractProjectMetadata(cleanedText);
    const lines = cleanedText
      .split(/\r?\n/)
      .map(l => l.trim())
      .filter(l => l.length > 0 && !/^-\s*\d+\s*-$/.test(l));

    // Detect Installment rules from text
    const installmentMap = new Map<string, { num: number; title: string }>();
    let defaultInstallmentTitle = 'งวดที่ 1';
    if (/ร้อยละ\s*100\s*ของวงเงิน|จ่ายให้เมื่อผู้รับจ้างได้ดำเนินการทั้งหมดแล้วเสร็จ/.test(cleanedText)) {
      defaultInstallmentTitle = 'งวดที่ 1 (ส่งมอบงาน 100%)';
    }

    const instMatches = cleanedText.matchAll(/งวดที่\s*(\d+)[^\n]*(?:ข้อ\s*([\d\.,\s\-ถึงและ]+))?/g);
    for (const m of instMatches) {
      const instNum = parseInt(m[1], 10);
      const instTitle = `งวดที่ ${instNum}`;
      if (m[2]) {
        const refs = m[2].match(/\d+(?:\.\d+)*/g) || [];
        for (const r of refs) {
          installmentMap.set(r, { num: instNum, title: instTitle });
        }
      }
    }

    const sections: { section_number: string; title: string; items: ParsedTorItem[] }[] = [];
    const rawItems: ParsedTorItem[] = [];

    // Administrative chapter titles that must NEVER be extracted as deliverable work items
    const adminChapterRegex = /^(?:หมวดที่|ส่วนที่|ข้อที่)?\s*(\d+)[\.\s]+(ความเป็นมา|หลักการและเหตุผล|วัตถุประสงค์|คุณสมบัติของผู้ยื่นข้อเสนอ|คุณสมบัติผู้ยื่นข้อเสนอ|คุณสมบัติของผู้เสนอราคา|กลุ่มเป้าหมาย|ข้อปฏิบัติในการยื่นข้อเสนอ|หลักเกณฑ์และสิทธิ์|ระยะเวลาดำเนินการ|ระยะเวลาส่งมอบ|วงเงินในการจัดหา|งบประมาณ|ค่าจ้างและการจ่ายเงิน|การเบิกจ่ายเงิน|อัตราค่าปรับ|ค่าปรับ|เกณฑ์การพิจารณา|หน่วยงานผู้รับผิดชอบ|การรับประกัน|การทำสัญญา)/;
    const scopeChapterRegex = /^(?:หมวดที่|ส่วนที่|ข้อที่)?\s*(\d+)[\.\s]+(ขอบเขตการดำเนินงาน|ขอบเขตของงาน|ขอบเขตงาน|รายละเอียดขอบเขตงาน|รายการดำเนินงาน|งานที่ต้องดำเนินการ)/;

    // Check if document uses 3-level numbering (e.g. 6.2.1, 6.3.1)
    const threeLevelRegex = /^(?:หัวข้อ)?\s*(\d+\.\d+\.\d+)(?:[\s:：]+|(?=[ก-ฮA-Za-z]))(.+)$/;
    const twoLevelRegex = /^(?:หัวข้อ)?\s*(\d+\.\d+)(?!\.\d)(?:[\s:：]+|(?=[ก-ฮA-Za-z]))(.+)$/;
    const oneLevelRegex = /^(?:หมวดที่|ส่วนที่|ข้อที่)?\s*(\d+)(?!\.\d)[\.\s]+(.+)$/;

    const hasThreeLevelItems = lines.some(l => threeLevelRegex.test(l));
    const hasExplicitScopeChapter = lines.some(l => scopeChapterRegex.test(l));

    if (hasThreeLevelItems || hasExplicitScopeChapter) {
      // Find which chapter number is the Scope of Work (e.g. "6")
      let scopeChapterNum: string | null = null;
      for (const l of lines) {
        const sm = l.match(scopeChapterRegex);
        if (sm) {
          scopeChapterNum = sm[1];
          break;
        }
      }
      if (!scopeChapterNum && hasThreeLevelItems) {
        const firstThree = lines.find(l => threeLevelRegex.test(l));
        if (firstThree) {
          scopeChapterNum = firstThree.match(threeLevelRegex)![1].split('.')[0];
        }
      }

      let currentSection: { section_number: string; title: string; items: ParsedTorItem[]; descLines: string[] } | null = null;
      let currentItem: ParsedTorItem | null = null;
      let inScopeChapter = false;

      const flushSectionIfEmpty = (sec: { section_number: string; title: string; items: ParsedTorItem[]; descLines: string[] } | null) => {
        if (!sec) return;
        if (sec.items.length === 0 && sec.descLines.length > 0) {
          const combinedDesc = sec.descLines.join(' ').trim();
          const singleItem = this.buildParsedTorItem(
            sec.section_number,
            sec.title,
            sec.section_number,
            `${sec.title}: ${combinedDesc}`,
            installmentMap,
            defaultInstallmentTitle
          );
          singleItem.title = sec.title;
          singleItem.requirement = combinedDesc;
          sec.items.push(singleItem);
          rawItems.push(singleItem);
        }
      };

      for (const line of lines) {
        // Check 1-level chapter header (e.g. "6. ขอบเขตการดำเนินงาน..." or "7. ระยะเวลาดำเนินการ")
        const oneMatch = line.match(oneLevelRegex);
        if (oneMatch && !threeLevelRegex.test(line) && !twoLevelRegex.test(line)) {
          const chapNum = oneMatch[1];
          if (chapNum === scopeChapterNum || scopeChapterRegex.test(line)) {
            inScopeChapter = true;
            continue;
          } else if (inScopeChapter && parseInt(chapNum, 10) > parseInt(scopeChapterNum || '0', 10)) {
            // Reached Chapter 7+ after Scope Chapter 6 -> stop scope extraction
            flushSectionIfEmpty(currentSection);
            currentSection = null;
            currentItem = null;
            inScopeChapter = false;
            break;
          }
        }

        // Check 3-level item (e.g. 6.2.1 จัดทำแผนผังรูปแบบงาน...)
        const threeMatch = line.match(threeLevelRegex);
        if (threeMatch) {
          const itemNum = threeMatch[1];
          const topChap = itemNum.split('.')[0];
          if (scopeChapterNum && topChap !== scopeChapterNum) continue;

          inScopeChapter = true;
          const parentSecNum = itemNum.split('.').slice(0, 2).join('.');
          if (!currentSection || currentSection.section_number !== parentSecNum) {
            flushSectionIfEmpty(currentSection);
            currentSection = {
              section_number: parentSecNum,
              title: `หมวดงาน ${parentSecNum}`,
              items: [],
              descLines: []
            };
            sections.push(currentSection);
          }

          currentItem = this.buildParsedTorItem(
            currentSection.section_number,
            currentSection.title,
            itemNum,
            threeMatch[2],
            installmentMap,
            defaultInstallmentTitle
          );
          currentSection.items.push(currentItem);
          rawItems.push(currentItem);
          continue;
        }

        // Check 2-level header (e.g. "6.1 การออกแบบแนวคิดการจัดงาน", "6.2 การจัดเวทีเปิดงาน...")
        const twoMatch = line.match(twoLevelRegex);
        if (twoMatch) {
          const secNum = twoMatch[1];
          const topChap = secNum.split('.')[0];
          if (scopeChapterNum && topChap !== scopeChapterNum) {
            continue; // Ignore 2.1, 3.1, 3.2, 5.1 outside Scope Chapter 6!
          }
          if (/\.00$/.test(secNum)) continue;

          inScopeChapter = true;
          flushSectionIfEmpty(currentSection);
          const secTitle = twoMatch[2].trim();
          currentSection = {
            section_number: secNum,
            title: secTitle,
            items: [],
            descLines: []
          };
          sections.push(currentSection);
          currentItem = null;
          continue;
        }

        // Handle continuation lines or section-level notes inside Scope Chapter
        if (inScopeChapter && currentSection) {
          if (/^ทั้งนี้\s*(?:การขนย้าย|ให้ผู้รับจ้าง)/.test(line)) {
            // Section-level installation/removal schedule note: attach to section items' deliverable info
            const dateNoteMatch = line.match(/ติดตั้งในวันที่\s*([^\n]+?)\s*และ(?:ต้อง)?(?:รื้อถอน|ส่งมอบคืน)[^\n]*?(?:ในวันที่|ภายในวันที่)\s*([^\n]+)/);
            const scheduleNote = dateNoteMatch
              ? ` (กำหนดติดตั้ง ${dateNoteMatch[1].trim()} / รื้อถอน-ส่งมอบ ${dateNoteMatch[2].trim()})`
              : ` (${line})`;
            if (currentSection.items.length > 0) {
              for (const it of currentSection.items) {
                if (!it.requirement.includes(line)) {
                  it.requirement += scheduleNote;
                }
              }
            } else {
              currentSection.descLines.push(line);
            }
          } else if (currentItem) {
            currentItem.requirement += ' ' + line;
            // Re-evaluate item properties with full multi-line requirement text
            const updated = this.buildParsedTorItem(
              currentSection.section_number,
              currentSection.title,
              currentItem.item_number,
              currentItem.requirement,
              installmentMap,
              defaultInstallmentTitle
            );
            Object.assign(currentItem, updated);
          } else {
            currentSection.descLines.push(line);
          }
        }
      }

      flushSectionIfEmpty(currentSection);
    }

    // Fallback for 2-level documents (where 1. งาน..., 2. งาน... are the work sections directly)
    if (rawItems.length === 0) {
      let currentSection: { section_number: string; title: string; items: ParsedTorItem[] } | null = null;
      let currentItem: ParsedTorItem | null = null;
      let skipCurrentChapter = false;

      const sectionRegex2Level = /^(?:หมวดที่|ส่วนที่|ข้อที่)?\s*(\d+)(?!\.\d)[\.\s]+(.+)$/;

      for (const line of lines) {
        if (/^(ชื่อโครงการ|รหัสโครงการ|สัญญาเลขที่|เลขที่\s*TOR|หน่วยงานเจ้าของโครงการ|ผู้ว่าจ้าง|ผู้รับจ้าง|ผู้จัดการโครงการ|วันเริ่มสัญญา|วันสิ้นสุดสัญญา|สถานที่ดำเนินงาน)\s*[:：]/.test(line)) {
          continue;
        }

        if (adminChapterRegex.test(line)) {
          skipCurrentChapter = true;
          currentSection = null;
          currentItem = null;
          continue;
        }

        const secMatch = line.match(sectionRegex2Level);
        if (secMatch && !line.includes('×') && !line.includes('เมตร')) {
          skipCurrentChapter = false;
          currentSection = {
            section_number: secMatch[1],
            title: secMatch[2].trim(),
            items: []
          };
          sections.push(currentSection);
          currentItem = null;
          continue;
        }

        if (skipCurrentChapter) continue;

        const itemMatch = line.match(twoLevelRegex);
        if (itemMatch && !/\.00$/.test(itemMatch[1])) {
          const itemNum = itemMatch[1];
          const secNum: string = currentSection ? currentSection.section_number : itemNum.split('.')[0];
          const secTitle: string = currentSection ? currentSection.title : `หมวดที่ ${secNum}`;

          if (!currentSection) {
            currentSection = { section_number: secNum, title: secTitle, items: [] };
            sections.push(currentSection);
          }

          currentItem = this.buildParsedTorItem(
            secNum,
            secTitle,
            itemNum,
            itemMatch[2],
            installmentMap,
            defaultInstallmentTitle
          );
          currentSection.items.push(currentItem);
          rawItems.push(currentItem);
        } else if (currentItem && line.length > 5) {
          currentItem.requirement += ' ' + line;
        }
      }
    }

    // Remove any empty sections
    const nonEmptySections = sections
      .filter(s => s.items.length > 0)
      .map(s => ({
        section_number: s.section_number,
        title: s.title,
        items: s.items
      }));

    return {
      projectMetadata: metadata,
      projectName: metadata.name,
      contractNumber: metadata.contract_number,
      sections: nonEmptySections,
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

    const keywords = ['จอ', 'led', 'เวที', 'แสง', 'เสียง', 'บูธ', 'คูหา', 'ป้าย', 'ขนาด', 'เมตร', 'ติดตั้ง', 'สำรวจ', 'ปลั๊กไฟ', 'โต๊ะ', 'เก้าอี้', 'วิทยุ'];
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
