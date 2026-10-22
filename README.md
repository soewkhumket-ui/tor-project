# TOR Evidence & Handover Report System
### ระบบบริหารหลักฐานการดำเนินงานและสร้างเอกสารส่งมอบงานตาม TOR มาตรฐานราชการ

ระบบ Web Application แบบ Responsive และ PWA สำหรับการบริหารหลักฐานงานราชการ งาน Event งานติดตั้ง งานก่อสร้าง และงานจัดซื้อจัดจ้างที่ต้องมีภาพถ่ายประกอบการตรวจรับพัสดุ

> **Upload TOR → AI อ่าน TOR → แตกหัวข้อ → สร้าง Checklist → ทีมถ่ายหลักฐาน → ตรวจความครบ → จัดหน้า A4 → Export PDF พร้อมส่งงาน**

---

## 🌟 จุดเด่นและฟังก์ชันหลัก

1. **4 ระดับสิทธิ์ผู้ใช้งาน (User Roles)**:
   - **Admin**: ผู้ดูแลระบบ สร้างโครงการ ตั้งค่านโยบาย ดู Audit Log
   - **Project Manager**: ผู้จัดการโครงการ ตรวจโครงสร้าง TOR อนุมัติ/ส่งกลับแก้ไขหลักฐาน ออกรายงาน
   - **Staff**: ทีมหน้างาน เปิด Checklist ถ่ายภาพ ใส่คำอธิบายภาพ
   - **Viewer / Inspector**: กรรมการตรวจรับพัสดุ ตรวจดูหลักฐาน (Read-only)
   - มี **Role Switcher** สลับบทบาทได้ทันทีบนแถบเมนู

2. **AI TOR Analysis & Semantic Parser**:
   - รองรับ Gemini API และ Smart Thai Semantic Parser
   - สกัดหมวดงาน, หัวข้อย่อย, ปริมาณ, หน่วยนับ, ขนาดมิติ และกำหนดเกณฑ์หลักฐานภาพถ่ายขั้นต่ำ 4 ภาพต่อรายการอัตโนมัติ

3. **Mobile Field Capture & Camera HUD**:
   - หน้าจอถ่ายภาพสำหรับทีมหน้างาน แสดงข้อกำหนด TOR, สิ่งที่ต้องเห็นในภาพ, และตัวนับภาพสด (เช่น 2/4 ภาพ)
   - มีระบบตรวจคุณภาพภาพถ่าย (Quality Check) เตือนภาพเบลอหรือความละเอียดต่ำ

4. **ระบบจัดเก็บภาพ 3 ระดับ (3-Tier Storage)**:
   - `ORIGINAL`: ไฟล์ต้นฉบับแท้ ไม่ถูกบีบอัดหรือดัดแปลง
   - `PREVIEW`: ปรับขนาด 1,200px บีบอัดเป็น WebP (82%) โหลดเร็วบนมือถือ
   - `PRINT`: ความละเอียดสูง 200–300 DPI สำหรับสร้างเอกสาร A4 คมชัด

5. **Non-destructive Annotation Canvas Editor**:
   - วาดและเขียนข้อความบนภาพโดยไม่ทำลายภาพต้นฉบับ
   - รองรับ Text (ฟอนต์ TH Sarabun New), ลูกศรชี้ตำแหน่ง, กรอบสี่เหลี่ยม, วงกลม, ป้ายหมายเลขลำดับ 1, 2, 3...
   - บันทึกเป็น JSON พิกัดเวกเตอร์

6. **Checklist & Approval Workflow**:
   - สถานะ 🟢 ครบถ้วน (Approved), 🟡 กำลังทำ, 🔴 ขาด, 🔵 รอตรวจ, 🟣 ส่งกลับแก้ไข (ระบุข้อเสนอแนะ)
   - QR Code หน้างาน สแกนเปิดหัวข้อที่ต้องการถ่ายได้ทันที

7. **WYSIWYG A4 Preview & Headless Chrome PDF Generator**:
   - จำลองหน้ากระดาษ A4 เสมือนจริง เลือก Layout 1, 2, 3, 4 รายการ/หน้า (Default: 2 รายการ/หน้า ตาราง 4 ภาพ)
   - Auto-pagination จัดหน้าอัตโนมัติ ไม่ตัดรูปกลางหน้า
   - เอกสารครบถ้วน: **หน้าปก**, **หนังสือขอส่งมอบงานราชการ**, **รายงานผลการดำเนินงานและหลักฐานภาพ**, **หน้าลงนามผู้ตรวจรับ**
   - ฝังฟอนต์ TrueType **TH Sarabun New** ในไฟล์ PDF คมชัด ไม่เพี้ยนบนทุกอุปกรณ์

8. **Pre-Export Completeness Validation**:
   - ตรวจความครบถ้วนก่อนส่งออก รองรับทั้งนโยบาย **Warning** และ **Hard Lock**

9. **Audit Trail & PWA**:
   - บันทึกประวัติการแก้ไขทุกกิจกรรม (Before/After)
   - รองรับการติดตั้งลงหน้าจอมือถือ (PWA / Add to Home Screen) และระบบแคช Service Worker

---

## 🚀 คำสั่งเปิดระบบแบบรวม (One-Command Startup)

### วิธีที่ 1: ดับเบิ้ลคลิกไฟล์เปิดระบบ (ง่ายที่สุดบน Windows)
ดับเบิ้ลคลิกไฟล์:
📁 `d:\AI Work\tor-evidence-system\start.bat`
*(ระบบจะรันเซิร์ฟเวอร์ และเปิดหน้าต่างเบราว์เซอร์ให้อัตโนมัติทันที)*

### วิธีที่ 2: รันผ่าน Terminal / Command Prompt (คำสั่งเดียว)
```bash
cd "d:\AI Work\tor-evidence-system"
npm start
```
เปิดใช้งานที่:
- **บนคอมพิวเตอร์**: `http://localhost:5000`
- **บนโทรศัพท์มือถือ (Wi-Fi เดียวกัน)**: `http://192.168.1.190:5000`

### วิธีที่ 3: โหมดนักพัฒนา (Hot-Reload Dev Mode พร้อมกัน)
```bash
cd "d:\AI Work\tor-evidence-system"
npm run dev
```

---

## 🛠️ การติดตั้ง Dependencies (หากติดตั้งใหม่)
```bash
# ติดตั้งฝั่ง Server
cd server
npm install

# ติดตั้งฝั่ง Client
cd ../client
npm install
```

---

## 🧪 การทดสอบระบบ (End-to-End Acceptance Test)

รันคำสั่งทดสอบครบทุกขั้นตอนตั้งแต่ สร้างโครงการ → AI วิเคราะห์ TOR → อนุมัติ Checklist → อัปโหลดภาพ 3 ระดับ → บันทึก Annotation → อนุมัติผลงาน → ออกรายงาน PDF A4:

```bash
cd server
npx tsx src/test_e2e.ts
```

---

## 📂 โครงสร้างโฟลเดอร์

```
tor-evidence-system/
├── server/
│   ├── src/
│   │   ├── assets/fonts/         # Sarabun-Regular.ttf, Sarabun-Bold.ttf
│   │   ├── db/                   # SQLite schema, migrations, seed data
│   │   ├── routes/               # auth, projects, tor, evidence, reports, audit
│   │   ├── services/             # ai.ts, storage.ts, pdf.ts
│   │   ├── index.ts              # Express Server
│   │   └── test_e2e.ts           # Acceptance Criteria E2E Test
│   └── storage/                  # 3-tier images, original tor, reports, exports
├── client/
│   ├── public/                   # fonts, manifest.json, sw.js (PWA)
│   ├── src/
│   │   ├── components/           # MobileCameraModal, ImageAnnotationEditor,
│   │   │                         # TORStructureEditor, EvidenceChecklist,
│   │   │                         # ReportA4Preview, ApprovalModal, RoleSwitcher
│   │   ├── context/              # AuthContext, OfflineSyncContext
│   │   ├── pages/                # DashboardPage, ProjectDetailsPage
│   │   ├── types/                # TypeScript Interfaces
│   │   ├── App.tsx               # Root App
│   │   └── index.css             # Tailwind + TH Sarabun New font + A4 sheet styles
│   └── index.html                # Mobile responsive HTML
└── README.md
```
