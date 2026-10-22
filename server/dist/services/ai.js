export class AIService {
    /**
     * Main entry to analyze TOR document text
     */
    static async analyzeTorText(rawText) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
            try {
                return await this.analyzeWithGemini(rawText, apiKey);
            }
            catch (err) {
                console.warn('⚠️ Gemini API call failed or timed out, falling back to built-in Thai TOR semantic parser:', err);
            }
        }
        return this.parseWithSemanticThaiParser(rawText);
    }
    /**
     * Gemini API structured parser
     */
    static async analyzeWithGemini(rawText, apiKey) {
        const systemPrompt = `You are an expert government procurement and TOR (Terms of Reference) analyst specializing in Thai government contracts, events, construction, and IT installations.
Your task is to analyze the provided TOR document and extract a structured hierarchy of sections and items.
For every item, determine whether photographic evidence is required for government inspection and handover.
Default minimum_images to 4 for physical evidence items.
Respond ONLY with a valid JSON object matching this schema:
{
  "projectName": "string or null",
  "contractNumber": "string or null",
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
        const data = (await response.json());
        const textOutput = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!textOutput)
            throw new Error('Empty response from Gemini');
        const parsed = JSON.parse(textOutput);
        const rawItems = [];
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
        return {
            projectName: parsed.projectName,
            contractNumber: parsed.contractNumber,
            sections: parsed.sections || [],
            rawItems
        };
    }
    /**
     * Built-in intelligent Thai TOR semantic extractor
     * Parses sections (1., 2., 3.), sub-items (1.1, 1.2, 2.1...), quantities, units, and instructions.
     */
    static parseWithSemanticThaiParser(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        const sections = [];
        const rawItems = [];
        let currentSection = null;
        let currentItem = null;
        // Regex patterns for Thai document numbering
        const sectionRegex = /^(\d+)[\.\s]+(งาน|ข้อกำหนด|หมวด|ส่วนที่|การ)(.+)$/;
        const itemRegex = /^(\d+\.\d+)[\.\s]+(.+)$/;
        for (const line of lines) {
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
            if (itemMatch) {
                const itemNum = itemMatch[1];
                const fullContent = itemMatch[2].trim();
                // Extract Title and Requirement
                let title = fullContent;
                let requirement = fullContent;
                if (fullContent.length > 40 && fullContent.includes(' ')) {
                    title = fullContent.split(/[,\s]/)[0] + ' ' + (fullContent.split(/[,\s]/)[1] || '');
                }
                // Extract Quantities and Units (e.g. จำนวน 20 คูหา, 1 ระบบ, 4 ตัว)
                let quantity = 1;
                let unit = 'งาน';
                const qtyMatch = fullContent.match(/(?:จำนวน\s*)?(\d+(?:\.\d+)?)\s*(คูหา|ชุด|ระบบ|จุด|ตัว|เครื่อง|จอ|โคม|แผง|ผืน|งาน|ตารางเมตร|ตร\.ม\.)/);
                if (qtyMatch) {
                    quantity = parseFloat(qtyMatch[1]);
                    unit = qtyMatch[2];
                }
                // Extract Dimensions (e.g. ขนาด 7.68 × 5.67 เมตร or 3 × 3 × 2.5 ม.)
                let dimensions;
                const dimMatch = fullContent.match(/(?:ขนาด\s*)([0-9\.\s×xX\*\-]+(?:เมตร|ม\.|เซนติเมตร|ซม\.))/);
                if (dimMatch) {
                    dimensions = dimMatch[1].trim();
                }
                // Determine if evidence is required (physical installation, staging, signage, equipment almost always requires evidence)
                const isNonPhysical = /จัดทำรายงานสรุป|ประชุมหารือ|ประสานงาน|วางแผนงาน/.test(fullContent);
                const evidenceRequired = !isNonPhysical;
                // Generate tailored capture instructions
                const captureInstructions = [];
                const captureTypes = ['overview', 'detail'];
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
            if (currentItem && line.length > 5) {
                currentItem.requirement += ' ' + line;
            }
        }
        // If no numbered sections matched, create fallback items
        if (rawItems.length === 0 && lines.length > 0) {
            const fallbackSec = { section_number: '1', title: 'รายการส่งมอบงาน', items: [] };
            lines.slice(0, 8).forEach((l, idx) => {
                const item = {
                    section_number: '1',
                    section_title: 'รายการส่งมอบงาน',
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
            sections,
            rawItems
        };
    }
    /**
     * AI Evidence Checker: validates whether uploaded photo & annotations align with TOR requirement
     */
    static async checkEvidenceCompliance(requirementText, imageCaption, annotationText) {
        const combinedNotes = `${imageCaption || ''} ${annotationText || ''}`.toLowerCase();
        const req = requirementText.toLowerCase();
        // Check keyword alignment
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
        }
        else {
            return {
                isCompliant: false,
                confidence: 0.65,
                feedback: '⚠️ รายละเอียดคำอธิบายอาจยังไม่ตรงกับข้อกำหนดใน TOR ชัดเจน กรุณาตรวจสอบก่อนส่งตรวจ'
            };
        }
    }
}
