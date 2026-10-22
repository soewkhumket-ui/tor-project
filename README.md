# 🏛️ TOR Evidence & Handover Report System
### ระบบบริหารหลักฐานการดำเนินงานและสร้างเอกสารส่งมอบงานตาม TOR มาตรฐานราชการ

ระบบ Web Application แบบ Responsive และ PWA สำหรับบริหารหลักฐานการดำเนินงานตามข้อกำหนด TOR (งานราชการ งาน Event งานจัดซื้อจัดจ้าง งานติดตั้ง งานประชาสัมพันธ์ และงานโครงการ) พร้อมระบบสกัดข้อมูลโครงการอัตโนมัติ (Hybrid Auto-Fill) และสร้างเอกสารรายงานส่งมอบงานขนาด A4 พร้อมพิมพ์

> **Upload ไฟล์โครงการ/TOR → AI สกัดรายละเอียดโครงการ & แตกหัวข้ออัตโนมัติ → สร้าง Checklist → ทีมหน้างานถ่ายหลักฐาน → ตรวจความครบถ้วน → จัดหน้า A4 → Export PDF พร้อมส่งมอบงาน**

---

## 🤝 คู่มือเริ่มต้นสำหรับทีมงาน (Team Quick Start)

Repository นี้ได้รวม **โค้ดระบบ (Frontend + Backend)**, **ฐานข้อมูลโครงการ (`tor_evidence.sqlite`)**, และ **ไฟล์เอกสาร TOR / รูปภาพหลักฐานทั้งหมด (`server/storage/projects/`)** ไว้ครบถ้วนแล้ว ทีมงานสามารถดึงโปรเจกต์ไปเปิดใช้งานและแก้ไขต่อได้ทันที

### 1. ดึงโปรเจกต์ลงเครื่อง (Clone) และติดตั้งครั้งแรก
เปิด PowerShell หรือ Terminal แล้วรันคำสั่ง:

```bash
git clone https://github.com/soewkhumket-ui/tor-project.git
cd tor-project
npm run setup
```
*(คำสั่ง `npm run setup` จะติดตั้งแพ็กเกจทั้งหมดของทั้ง `server` และ `client` พร้อม Build หน้าเว็บให้อัตโนมัติ)*

### 2. การเปิดใช้งานระบบ (เลือกวิธีที่สะดวก)

- **วิธีที่ 1 — ดับเบิลคลิกไฟล์ (ง่ายที่สุดบน Windows)**:
  ดับเบิลคลิกไฟล์ `start.bat` ในโฟลเดอร์หลัก ระบบจะรันเซิร์ฟเวอร์และเปิดเบราว์เซอร์ที่ `http://localhost:5000` ให้อัตโนมัติ
- **วิธีที่ 2 — รันด้วยคำสั่งเดียวผ่าน Terminal**:
  ```bash
  npm start
  ```
  จากนั้นเปิดเบราว์เซอร์ไปที่ `http://localhost:5000` (หรือเปิดผ่านมือถือในวง Wi-Fi เดียวกันด้วย `http://<IP-เครื่องคอม>:5000`)
- **วิธีที่ 3 — โหมดนักพัฒนา (Frontend + Backend Hot-Reload สำหรับแก้โค้ด)**:
  ```bash
  npm run dev
  ```
  - เมื่อแก้ไขโค้ดฝั่ง `client/src` เสร็จและต้องการอัปเดต Production Bundle ให้รัน:
    ```bash
    npm run build
    ```

---

## 🔄 การซิงค์ข้อมูลและทำงานร่วมกันในทีมผ่าน GitHub

ข้อมูลโครงการทั้งหมดถูกเก็บไว้ในโฟลเดอร์ `server/storage/` ซึ่งตั้งค่าให้ติดตาม (Track) ไปกับ Git เรียบร้อยแล้ว:
- **`server/storage/tor_evidence.sqlite`**: ฐานข้อมูล SQLite ที่รวมข้อมูลโครงการ, หมวดงาน TOR, รายการ Checklist, ประวัติการอนุมัติ และ Audit Log ทั้งหมดไว้ในไฟล์เดียว
- **`server/storage/projects/`**: ไฟล์ต้นฉบับ TOR (`.pdf`, `.docx`), ภาพถ่ายหน้างานทั้ง 3 ระดับ (`original`, `preview`, `print`), และไฟล์ PDF รายงานที่ส่งออกแล้ว

### เมื่อต้องการดึงงานล่าสุดจากเพื่อนร่วมทีม:
```bash
git pull origin main
```

### เมื่อแก้ไขโค้ด หรือเพิ่มข้อมูลโครงการ/รูปภาพแล้วต้องการส่งขึ้น GitHub ให้ทีม:
```bash
git add .
git commit -m "อัปเดตข้อมูลโครงการและแก้ไขระบบ"
git push origin main
```

---

## ✨ ฟีเจอร์หลักของระบบ (Key Features)

### 1. สร้างโครงการแบบ Hybrid (Auto-Fill จากไฟล์ + กรอก/แก้ไขเองได้)
ในหน้าต่าง **"+ สร้างโครงการใหม่"** และหน้า **"นำเข้าโครงสร้าง TOR"** รองรับการทำงานแบบ Hybrid 3 รูปแบบ:
- **อัปโหลดไฟล์โครงการ (Auto-Fill)**: รองรับไฟล์ `.pdf`, `.docx`, `.txt`, `.md`, `.json` ระบบจะสกัดข้อมูลและกรอกรายละเอียดโครงการลงในช่องฟอร์มทุกช่องให้อัตโนมัติ (ชื่อโครงการ, รหัสโครงการ, เลขที่สัญญา, เลขที่ TOR, หน่วยงานเจ้าของโครงการ, ผู้รับจ้าง, ผู้จัดการโครงการ, วันเริ่ม-สิ้นสุดสัญญา, สถานที่ดำเนินงาน) พร้อมสกัดหมวดงานและรายการ Checklist ทันที
- **วางข้อความ TOR (Auto-Fill)**: คัดลอกข้อความจากเอกสารมาวางเพื่อให้ AI สกัดรายละเอียดโครงการและรายการตรวจรับอัตโนมัติ
- **กรอกข้อมูลเอง (รูปแบบเดิม)**: สามารถกรอกข้อมูลเองหรือปรับแก้ข้อมูลที่ระบบ Auto-Fill มาให้ได้อย่างอิสระทุกช่อง

### 2. ระบบสิทธิ์ผู้ใช้งาน 4 ระดับ (Role-Based Access Control)
สามารถสลับบทบาทเพื่อทดสอบได้ที่มุมขวาบนของแถบเมนู (**Role Switcher**):
- **Admin**: สร้างโครงการ, อัปโหลด/แก้ไขโครงสร้าง TOR, ตั้งค่านโยบายการส่งออกรายงาน, ดู Audit Log
- **Project Manager**: ตรวจทานโครงสร้าง TOR, อนุมัติหรือส่งกลับแก้ไข (Reject) ภาพถ่ายหลักฐาน, ออกรายงาน PDF
- **Staff**: ทีมหน้างาน เปิด Checklist ถ่ายภาพผ่านมือถือ, วาดลูกศร/ใส่คำอธิบายบนภาพ
- **Viewer / Inspector**: กรรมการตรวจรับพัสดุ เปิดดูความคืบหน้าและพรีวิวรายงาน A4 (Read-only)

### 3. Mobile Field Capture & ระบบจัดเก็บภาพ 3 ระดับ (3-Tier Storage)
- หน้าจอถ่ายภาพสำหรับมือถือแสดงข้อกำหนด TOR, คำแนะนำการถ่ายภาพ, และจำนวนภาพที่ต้องถ่าย (เช่น `2/4 ภาพ`)
- ตรวจสอบคุณภาพภาพอัตโนมัติ (แจ้งเตือนเมื่อความละเอียดต่ำหรือภาพเบลอ)
- แยกจัดเก็บภาพอัตโนมัติ 3 ระดับ:
  - `ORIGINAL`: ไฟล์ภาพต้นฉบับแท้ ไม่ถูกบีบอัดหรือเขียนทับ
  - `PREVIEW`: ภาพ WebP ขนาด 1,200px โหลดเร็วบนมือถือ
  - `PRINT`: ภาพความละเอียดสูง 200–300 DPI สำหรับพิมพ์ลงรายงาน A4

### 4. Non-Destructive Image Annotation Editor
- วาดลูกศรชี้จุด, ตีกรอบสี่เหลี่ยม, วงกลม, ป้ายหมายเลขลำดับ `1, 2, 3...`, และพิมพ์ข้อความภาษาไทย (ฟอนต์ TH Sarabun New) บนภาพหลักฐานโดยไม่ทำลายไฟล์ภาพต้นฉบับ

### 5. WYSIWYG A4 Report Preview & PDF Export มาตรฐานราชการ
- จำลองหน้ากระดาษ A4 เสมือนจริง เลือกการจัดวางได้ **1, 2, 3 หรือ 4 รายการต่อหน้า** (ค่าเริ่มต้น: 2 รายการ/หน้า รายการละ 4 ภาพ)
- ประกอบด้วย **หน้าปก**, **หนังสือขอส่งมอบงานราชการ**, **ตารางรายการหลักฐานภาพถ่ายตามหัวข้อ TOR**, และ **หน้าลงนามคณะกรรมการตรวจรับพัสดุ**
- ฝังฟอนต์ภาษาไทย **Sarabun (`TH Sarabun New`)** ลงในไฟล์ PDF คมชัด ไม่เพี้ยนทุกอุปกรณ์

---

## ⚙️ การตั้งค่าเพิ่มเติม (Optional Environment Variables)

ระบบมี **Smart Thai TOR Semantic Parser** ในตัวที่สามารถสกัดข้อมูลภาษาไทยจากไฟล์ `.pdf` และ `.docx` ได้ทันทีโดยไม่ต้องใช้ API Key ภายนอก แต่หากทีมงานต้องการเปิดใช้งานการวิเคราะห์ร่วมกับ **Google Gemini API** สามารถสร้างไฟล์ `.env` ในโฟลเดอร์ `server/.env` ได้ดังนี้:

```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key_here
```
*(ไฟล์ `.env` ถูกตั้งค่าใน `.gitignore` ไว้แล้วเพื่อความปลอดภัยของ API Key)*

---

## 🧪 การรันทดสอบระบบอัตโนมัติ (End-to-End Test)

หากทีมงานแก้ไขโค้ดและต้องการทดสอบการทำงานครบทุกขั้นตอน (สร้างโครงการ → วิเคราะห์ TOR → สร้าง Checklist → อัปโหลดภาพ 3 ระดับ → บันทึก Annotation → อนุมัติหลักฐาน → สร้างไฟล์ PDF):

```bash
cd server
npx tsx src/test_e2e.ts
```

---

## 📂 โครงสร้างโปรเจกต์ (Project Structure)

```text
tor-project/
├── package.json                  # สคริปต์รวม (npm start, npm run dev, npm run build, npm run setup)
├── start.bat / start.ps1         # สคริปต์คลิกเดียวเปิดระบบบน Windows
├── client/                       # Frontend (React 19 + TypeScript + Tailwind CSS + Vite)
│   ├── public/                   # ฟอนต์ Sarabun, PWA manifest.json, Service Worker (sw.js)
│   └── src/
│       ├── components/           # TORStructureEditor, EvidenceChecklist, MobileCameraModal,
│       │                         # ImageAnnotationEditor, ReportA4Preview, ApprovalModal, RoleSwitcher
│       ├── context/              # AuthContext, OfflineSyncContext
│       ├── pages/                # DashboardPage (Hybrid Auto-Fill Modal), ProjectDetailsPage
│       └── types/                # TypeScript Interfaces
└── server/                       # Backend (Node.js + Express + SQLite + Sharp + PDFKit + unpdf + mammoth)
    ├── src/
    │   ├── assets/fonts/         # ฟอนต์ภาษาไทย Sarabun-Regular.ttf, Sarabun-Bold.ttf สำหรับฝังใน PDF
    │   ├── db/                   # โครงสร้างตาราง SQLite (schema.sql), ระบบเชื่อมต่อ DB (index.ts), ข้อมูลเริ่มต้น (seed.ts)
    │   ├── routes/               # API Endpoints: projects, tor, evidence, reports, audit, auth
    │   └── services/             # ai.ts (สกัดข้อมูล PDF/DOCX & วิเคราะห์ TOR), storage.ts (3-tier image), pdf.ts (A4 PDF)
    └── storage/                  # ข้อมูลโปรเจกต์ทั้งหมดที่แชร์ร่วมกันในทีม
        ├── tor_evidence.sqlite   # ฐานข้อมูลหลักของระบบ
        └── projects/             # ไฟล์เอกสาร TOR ต้นฉบับ, ภาพถ่ายหลักฐาน และไฟล์รายงาน PDF
```
