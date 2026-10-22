import { initDatabase, dbQuery } from './index.js';
import { v4 as uuidv4 } from 'uuid';
export function runSeed() {
    initDatabase();
    // Check if already seeded
    const existingUsers = dbQuery.all('SELECT count(*) as count FROM users');
    if (existingUsers[0]?.count > 0) {
        console.log('🌱 Database already contains data. Skipping full seed.');
        return;
    }
    console.log('🌱 Seeding initial database data...');
    // 1. Organization
    const orgId = uuidv4();
    dbQuery.run(`INSERT INTO organizations (id, name, code) VALUES (?, ?, ?)`, [orgId, 'กรมส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ', 'DSTI-GOV']);
    // 2. Users (4 Roles)
    const users = [
        {
            id: 'usr-admin-01',
            orgId,
            name: 'สมชาย ประเสริฐสุข (Admin)',
            email: 'admin@dsti.go.th',
            role: 'admin',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Somchai'
        },
        {
            id: 'usr-pm-01',
            orgId,
            name: 'กิตติศักดิ์ พัฒนเสรี (Project Manager)',
            email: 'pm@contractor.co.th',
            role: 'project_manager',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kittisak'
        },
        {
            id: 'usr-staff-01',
            orgId,
            name: 'วิชัย มุ่งมั่น (Field Staff)',
            email: 'wichai@contractor.co.th',
            role: 'staff',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Wichai'
        },
        {
            id: 'usr-inspector-01',
            orgId,
            name: 'ดร. ประเสริฐ ยุติธรรม (กรรมการตรวจรับพัสดุ)',
            email: 'inspector@dsti.go.th',
            role: 'inspector',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Prasert'
        }
    ];
    for (const u of users) {
        dbQuery.run(`INSERT INTO users (id, org_id, name, email, role, avatar_url) VALUES (?, ?, ?, ?, ?, ?)`, [u.id, u.orgId, u.name, u.email, u.role, u.avatar]);
    }
    // 3. Sample Project
    const projectId = 'prj-event-2567-001';
    dbQuery.run(`INSERT INTO projects (
      id, org_id, name, code, contract_number, tor_number,
      government_agency, client, contractor, project_manager,
      start_date, end_date, inspection_date, location, description,
      export_policy, allow_location_metadata, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        projectId,
        orgId,
        'โครงการจัดงานนิทรรศการและประชุมวิชาการนานาชาติด้านเทคโนโลยีภาครัฐ ประจำปี 2567',
        'PRJ-2567-GOVTECH-01',
        'กท.45/2567',
        'TOR-DSTI-08/2567',
        'สำนักงานส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ (องค์การมหาชน)',
        'สำนักงานส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ',
        'บริษัท สยาม นวัตกรรม แอนด์ อีเวนต์ โซลูชั่น จำกัด',
        'นายกิตติศักดิ์ พัฒนเสรี',
        '2026-10-01',
        '2026-10-15',
        '2026-10-16',
        'ศูนย์การประชุมแห่งชาติสิริกิติ์ แขวงคลองเตย เขตคลองเตย กรุงเทพมหานคร',
        'งานจัดสร้างเวที ติดตั้งระบบจอภาพ LED ระบบแสงเสียง คูหานิทรรศการ และจุดลงทะเบียนเพื่อรองรับผู้เข้าร่วมงาน 1,500 คน',
        'warning',
        1,
        'IN_PROGRESS'
    ]);
    // Link users to project
    dbQuery.run(`INSERT INTO project_members (id, project_id, user_id, role_in_project) VALUES (?, ?, ?, ?)`, [uuidv4(), projectId, 'usr-admin-01', 'Admin']);
    dbQuery.run(`INSERT INTO project_members (id, project_id, user_id, role_in_project) VALUES (?, ?, ?, ?)`, [uuidv4(), projectId, 'usr-pm-01', 'Project Manager']);
    dbQuery.run(`INSERT INTO project_members (id, project_id, user_id, role_in_project) VALUES (?, ?, ?, ?)`, [uuidv4(), projectId, 'usr-staff-01', 'Staff']);
    dbQuery.run(`INSERT INTO project_members (id, project_id, user_id, role_in_project) VALUES (?, ?, ?, ?)`, [uuidv4(), projectId, 'usr-inspector-01', 'Inspector']);
    // 4. Sample TOR Sections
    const sec1 = { id: 'sec-01', num: '1', title: 'งานเตรียมการและพื้นที่', sort: 1 };
    const sec2 = { id: 'sec-02', num: '2', title: 'งานเวทีและฉากนิทรรศการ', sort: 2 };
    const sec3 = { id: 'sec-03', num: '3', title: 'งานระบบภาพ แสง และเสียง', sort: 3 };
    const sec4 = { id: 'sec-04', num: '4', title: 'งานคูหานิทรรศการ (Exhibition Booths)', sort: 4 };
    const sec5 = { id: 'sec-05', num: '5', title: 'งานจุดลงทะเบียนและประชาสัมพันธ์', sort: 5 };
    for (const s of [sec1, sec2, sec3, sec4, sec5]) {
        dbQuery.run(`INSERT INTO tor_sections (id, project_id, section_number, title, sort_order) VALUES (?, ?, ?, ?, ?)`, [s.id, projectId, s.num, s.title, s.sort]);
    }
    // 5. Sample TOR Items & Evidence Items
    const torItems = [
        {
            id: 'tor-item-1-1',
            secId: sec1.id,
            num: '1.1',
            title: 'สำรวจและวางผังการติดตั้ง',
            req: 'ดำเนินการสำรวจพื้นที่จริง ณ ศูนย์การประชุมฯ พร้อมจัดทำแบบผัง (Layout Plan) แสดงตำแหน่งเวที บูธ และเส้นทางหนีไฟที่ได้รับความเห็นชอบจากเจ้าของสถานที่',
            qty: 1, unit: 'งาน', dims: 'ครอบคลุมพื้นที่ 2,400 ตร.ม.',
            deliv: 'ผังแบบแปลนการติดตั้งที่ได้รับอนุมัติ',
            evReq: 1, minImg: 4, sort: 1,
            instr: JSON.stringify(['ถ่ายภาพการสำรวจหน้างานร่วมกับเจ้าหน้าที่', 'ถ่ายแบบผัง Layout บนพื้นที่จริง', 'ถ่ายภาพรวมพื้นที่ก่อนเริ่มติดตั้ง', 'ถ่ายจุดทางหนีไฟและอุปกรณ์ฉุกเฉิน']),
            types: JSON.stringify(['overview', 'measurement', 'before', 'detail']),
            initialStatus: 'COMPLETE'
        },
        {
            id: 'tor-item-2-1',
            secId: sec2.id,
            num: '2.1',
            title: 'จัดทำเวทีหลัก (Main Stage)',
            req: 'จัดทำเวทีหลักโครงสร้างเหล็กปูพื้นไม้อัดหนา 20 มม. ขนาดไม่น้อยกว่า 12.00 × 8.00 เมตร สูง 1.20 เมตร ปูพรมสีเทาเข้ม พร้อมบันไดขึ้น-ลง 2 ข้าง และราวกั้นกันตก',
            qty: 1, unit: 'ชุด', dims: '12.00 × 8.00 × 1.20 ม.',
            deliv: 'เวทีหลักพร้อมใช้งาน',
            evReq: 1, minImg: 4, sort: 2,
            instr: JSON.stringify(['ถ่ายภาพรวมเวทีด้านหน้าตรง', 'ถ่ายโครงสร้างใต้เวทีและเหล็กค้ำยัน', 'ถ่ายการวัดขนาดความกว้าง/ยาว/ความสูง', 'ถ่ายบันไดทางขึ้น-ลงและพรมปูพื้นเวที']),
            types: JSON.stringify(['overview', 'detail', 'measurement', 'finished_work']),
            initialStatus: 'COMPLETE'
        },
        {
            id: 'tor-item-3-1',
            secId: sec3.id,
            num: '3.1',
            title: 'ติดตั้งจอแสดงผล LED Screen',
            req: 'ติดตั้งจอแสดงผลชนิด LED Full Color Indoor ความละเอียดระดับ P2.6 ขนาดไม่น้อยกว่า 7.68 × 4.32 เมตร อัตราส่วน 16:9 พร้อมระบบ Video Processor และเครื่องควบคุมสัญญาณสำรอง',
            qty: 1, unit: 'ระบบ', dims: '7.68 × 4.32 ม. (P2.6)',
            deliv: 'จอ LED ฉายภาพคมชัด ไม่มี Dead Pixel',
            evReq: 1, minImg: 4, sort: 3,
            instr: JSON.stringify(['ถ่ายภาพรวมจอ LED ขณะฉายภาพทดสอบสี/ความสว่าง', 'ถ่ายด้านหลังจอแสดงโครงสร้าง Truss และการเดินสายสัญญาณ', 'ถ่ายการวัดขนาดหน้าจอ 7.68 x 4.32 เมตร', 'ถ่ายตู้ Rack ควบคุมและ Video Processor']),
            types: JSON.stringify(['overview', 'installation', 'measurement', 'finished_work']),
            initialStatus: 'IN_PROGRESS'
        },
        {
            id: 'tor-item-3-2',
            secId: sec3.id,
            num: '3.2',
            title: 'ติดตั้งระบบแสงและไฟเวที (Stage Lighting)',
            req: 'ติดตั้งชุดไฟ Moving Head Beam ไม่น้อยกว่า 12 โคม, ไฟ Par LED RGBW สำหรับส่องสว่างเวทีไม่น้อยกว่า 24 โคม พร้อม DMX Controller ควบคุมระบบไฟมาตรฐานสากล',
            qty: 1, unit: 'ระบบ', dims: 'Truss แขวนไฟยาว 14 ม.',
            deliv: 'ระบบแสงเวทีทำงานสมบูรณ์ทุกโคม',
            evReq: 1, minImg: 4, sort: 4,
            instr: JSON.stringify(['ถ่ายภาพรวมโคมไฟบน Truss', 'ถ่ายการทดสอบเปิดไฟเวทีทุกเฉดสี', 'ถ่ายแผงคอนโซลควบคุม DMX', 'ถ่ายจุดยึด safety wire ของโคมไฟ']),
            types: JSON.stringify(['overview', 'detail', 'installation', 'finished_work']),
            initialStatus: 'WAITING_REVIEW'
        },
        {
            id: 'tor-item-4-1',
            secId: sec4.id,
            num: '4.1',
            title: 'จัดทำบูธนิทรรศการมาตรฐาน (Standard Booth)',
            req: 'จัดทำบูธนิทรรศการแบบ Modular System โครงสร้างอลูมิเนียม ผนัง Maxima หนาสีขาว จำนวน 20 คูหา ขนาดไม่น้อยกว่า 3.00 × 3.00 × 2.50 เมตร แต่ละคูหาประกอบด้วย โต๊ะประชาสัมพันธ์ 1 ตัว เก้าอี้ 2 ตัว ปลั๊กไฟ 5A 1 จุด และโคมไฟสปอตไลท์ LED 2 ดวง',
            qty: 20, unit: 'คูหา', dims: '3.00 × 3.00 × 2.50 ม./คูหา',
            deliv: 'บูธนิทรรศการครบ 20 คูหาพร้อมอุปกรณ์มาตรฐาน',
            evReq: 1, minImg: 4, sort: 5,
            instr: JSON.stringify(['ถ่ายภาพรวมแถวบูธนิทรรศการให้เห็นการจัดเรียง', 'ถ่ายด้านหน้าคูหาเดี่ยวแสดงป้ายชื่อและอุปกรณ์', 'ถ่ายการวัดขนาด กว้างxยาวxสูง ของบูธ', 'ถ่ายการติดตั้งปลั๊กไฟและระบบสวิตช์ควบคุม']),
            types: JSON.stringify(['overview', 'detail', 'measurement', 'finished_work']),
            initialStatus: 'MISSING'
        },
        {
            id: 'tor-item-5-1',
            secId: sec5.id,
            num: '5.1',
            title: 'จัดทำจุดลงทะเบียนและติดตั้งระบบสแกน QR Code',
            req: 'จัดทำเคาน์เตอร์ลงทะเบียนโครงสร้างไม้พ่นสี ขนาด 1.80 × 0.60 × 1.00 เมตร จำนวน 4 ตัว พร้อมป้ายแบนเนอร์ประชาสัมพันธ์จุดลงทะเบียน และเครื่องอ่าน QR Code จำนวน 4 ชุด',
            qty: 4, unit: 'จุด', dims: '1.80 × 0.60 × 1.00 ม.',
            deliv: 'จุดลงทะเบียน 4 จุดพร้อมระบบตรวจบัตร',
            evReq: 1, minImg: 4, sort: 6,
            instr: JSON.stringify(['ถ่ายภาพรวมจุดลงทะเบียนทั้ง 4 เคาน์เตอร์', 'ถ่ายอุปกรณ์คอมพิวเตอร์และเครื่องสแกน QR Code', 'ถ่ายป้ายประชาสัมพันธ์จุดลงทะเบียน', 'ถ่ายเจ้าหน้าที่กำลังทดสอบระบบสแกนหน้างาน']),
            types: JSON.stringify(['overview', 'detail', 'finished_work']),
            initialStatus: 'MISSING'
        }
    ];
    for (const item of torItems) {
        dbQuery.run(`INSERT INTO tor_items (
        id, project_id, section_id, item_number, title, requirement,
        quantity, unit, dimensions, deliverable, evidence_required,
        minimum_images, capture_instructions, capture_types, sort_order, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'APPROVED')`, [
            item.id,
            projectId,
            item.secId,
            item.num,
            item.title,
            item.req,
            item.qty,
            item.unit,
            item.dims,
            item.deliv,
            item.evReq,
            item.minImg,
            item.instr,
            item.types,
            item.sort
        ]);
        // Create corresponding Evidence Item
        const evItemId = `ev-${item.id}`;
        dbQuery.run(`INSERT INTO evidence_items (
        id, project_id, tor_item_id, assigned_to, status, notes, qr_code_token
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
            evItemId,
            projectId,
            item.id,
            'usr-staff-01',
            item.initialStatus,
            `หลักฐานสำหรับหัวข้อ ${item.num} ${item.title}`,
            `QR-${item.id}`
        ]);
    }
    // 6. Default Report Template & Standard Sections
    const templateId = 'tpl-default-gov-01';
    dbQuery.run(`INSERT INTO report_templates (
      id, project_id, name, page_size, orientation,
      margin_top_mm, margin_bottom_mm, margin_left_mm, margin_right_mm,
      font_family, items_per_page, header_text, footer_text, show_page_number, is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        templateId,
        projectId,
        'แบบรายงานส่งมอบงานมาตรฐานราชการ (TH Sarabun New - 2 รายการ/หน้า)',
        'A4',
        'portrait',
        15, 15, 20, 15,
        'TH Sarabun New',
        2, // 2 items per page default
        'เอกสารประกอบการตรวจรับพัสดุ - สำนักงานส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ',
        'โครงการจัดงานนิทรรศการและประชุมวิชาการนานาชาติด้านเทคโนโลยีภาครัฐ ประจำปี 2567',
        1,
        1
    ]);
    const sections = [
        { id: uuidv4(), type: 'cover', title: 'หน้าปกรายงาน', sort: 1 },
        { id: uuidv4(), type: 'submission_letter', title: 'หนังสือขอส่งมอบงาน', sort: 2 },
        { id: uuidv4(), type: 'toc', title: 'สารบัญ', sort: 3 },
        { id: uuidv4(), type: 'project_info', title: 'ข้อมูลรายละเอียดโครงการและสัญญา', sort: 4 },
        { id: uuidv4(), type: 'tor_evidence', title: 'รายงานผลการดำเนินงานและหลักฐานภาพตาม TOR', sort: 5 },
        { id: uuidv4(), type: 'extra_evidence', title: 'หลักฐานเพิ่มเติม (Additional Evidence)', sort: 6 },
        { id: uuidv4(), type: 'summary', title: 'สรุปผลการส่งมอบงาน', sort: 7 },
        { id: uuidv4(), type: 'signatures', title: 'หน้ารับรองและลายมือชื่อผู้ตรวจรับ', sort: 8 }
    ];
    for (const s of sections) {
        dbQuery.run(`INSERT INTO report_sections (id, template_id, section_type, title, sort_order, is_enabled) VALUES (?, ?, ?, ?, ?, 1)`, [s.id, templateId, s.type, s.title, s.sort]);
    }
    // 7. Initial Audit Log
    dbQuery.run(`INSERT INTO audit_logs (id, project_id, user_id, user_name, action, entity_type, entity_id, before_state, after_state)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        uuidv4(),
        projectId,
        'usr-admin-01',
        'สมชาย ประเสริฐสุข (Admin)',
        'PROJECT_CREATED',
        'PROJECT',
        projectId,
        null,
        JSON.stringify({ name: 'โครงการจัดงานนิทรรศการและประชุมวิชาการนานาชาติฯ', code: 'PRJ-2567-GOVTECH-01' })
    ]);
    console.log('✅ Database seeded successfully with sample project, users, TOR items, and templates!');
}
// Allow direct execution: `npx tsx src/db/seed.ts`
if (import.meta.url === `file://${process.argv[1]}`.replace(/\\/g, '/')) {
    runSeed();
}
