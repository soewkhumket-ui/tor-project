-- TOR Evidence & Handover Report System Schema
-- SQLite Dialect

PRAGMA foreign_keys = ON;

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organizations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE,
    logo_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'project_manager', 'staff', 'inspector')),
    avatar_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Projects
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    org_id TEXT REFERENCES organizations(id),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    contract_number TEXT,
    tor_number TEXT,
    government_agency TEXT,
    client TEXT,
    contractor TEXT,
    project_manager TEXT,
    start_date TEXT,
    end_date TEXT,
    inspection_date TEXT,
    location TEXT,
    description TEXT,
    logo_agency_path TEXT,
    logo_contractor_path TEXT,
    custom_fields_json TEXT DEFAULT '{}',
    export_policy TEXT NOT NULL DEFAULT 'warning' CHECK(export_policy IN ('warning', 'hard_lock')),
    allow_location_metadata INTEGER DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('PLANNING', 'IN_PROGRESS', 'REVIEW', 'COMPLETED', 'ARCHIVED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 4. Project Members
CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_in_project TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, user_id)
);

-- 5. TOR Documents & Versions
CREATE TABLE IF NOT EXISTS tor_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    filename TEXT NOT NULL,
    original_path TEXT NOT NULL,
    mime_type TEXT,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'PARSED' CHECK(status IN ('UPLOADED', 'PARSING', 'PARSED', 'APPROVED', 'FAILED')),
    raw_extracted_text TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. TOR Sections (Categories/Groups: e.g. 1. งานเตรียมการ, 2. งานโครงสร้าง, 3. งานจัดสถานที่)
CREATE TABLE IF NOT EXISTS tor_sections (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    section_number TEXT NOT NULL,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. TOR Items
CREATE TABLE IF NOT EXISTS tor_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    section_id TEXT REFERENCES tor_sections(id) ON DELETE SET NULL,
    parent_id TEXT REFERENCES tor_items(id) ON DELETE CASCADE,
    item_number TEXT NOT NULL,
    title TEXT NOT NULL,
    requirement TEXT NOT NULL,
    quantity REAL,
    unit TEXT,
    dimensions TEXT,
    deliverable TEXT,
    evidence_required INTEGER NOT NULL DEFAULT 1,
    minimum_images INTEGER NOT NULL DEFAULT 4,
    maximum_images INTEGER NOT NULL DEFAULT 0, -- 0 means unlimited
    capture_instructions TEXT, -- JSON array string
    capture_types TEXT, -- JSON array of recommended types: ["overview", "detail", "installation", "measurement"]
    is_additional INTEGER NOT NULL DEFAULT 0, -- 1 = Additional Evidence (Not Original TOR)
    sort_order INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT', 'APPROVED')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 8. Evidence Items (The checklist items generated after TOR Structure Approval)
CREATE TABLE IF NOT EXISTS evidence_items (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    tor_item_id TEXT NOT NULL REFERENCES tor_items(id) ON DELETE CASCADE,
    assigned_to TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'MISSING' CHECK(status IN ('COMPLETE', 'IN_PROGRESS', 'MISSING', 'WAITING_REVIEW', 'REJECTED', 'NOT_REQUIRED')),
    notes TEXT,
    rejection_comment TEXT,
    qr_code_token TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 9. Evidence Files (The captured/uploaded photos with 3-tier storage)
CREATE TABLE IF NOT EXISTS evidence_files (
    id TEXT PRIMARY KEY,
    evidence_item_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
    original_path TEXT NOT NULL,
    preview_path TEXT NOT NULL,
    print_path TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    quality_score REAL DEFAULT 1.0,
    blur_score REAL DEFAULT 1.0,
    quality_warning TEXT,
    captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploaded_by TEXT REFERENCES users(id),
    latitude REAL,
    longitude REAL,
    annotation_json TEXT DEFAULT '[]', -- Non-destructive annotations
    capture_type TEXT DEFAULT 'overview' CHECK(capture_type IN ('overview', 'detail', 'before', 'during', 'after', 'measurement', 'installation', 'finished_work', 'custom')),
    caption TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_cover INTEGER NOT NULL DEFAULT 0,
    is_hidden INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK(status IN ('DRAFT', 'SUBMITTED', 'WAITING_REVIEW', 'APPROVED', 'REJECTED')),
    version INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    deleted_at DATETIME
);

-- 10. Reviews & Approvals
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    evidence_item_id TEXT NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
    evidence_file_id TEXT REFERENCES evidence_files(id) ON DELETE SET NULL,
    reviewer_id TEXT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('APPROVED', 'REJECTED', 'FIX_REQUIRED')),
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11. Report Templates
CREATE TABLE IF NOT EXISTS report_templates (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    page_size TEXT NOT NULL DEFAULT 'A4',
    orientation TEXT NOT NULL DEFAULT 'portrait',
    margin_top_mm INTEGER NOT NULL DEFAULT 15,
    margin_bottom_mm INTEGER NOT NULL DEFAULT 15,
    margin_left_mm INTEGER NOT NULL DEFAULT 20,
    margin_right_mm INTEGER NOT NULL DEFAULT 15,
    font_family TEXT NOT NULL DEFAULT 'TH Sarabun New',
    items_per_page INTEGER NOT NULL DEFAULT 2, -- 1, 2, 3, 4, or 0 (auto-fit)
    header_text TEXT,
    footer_text TEXT,
    show_page_number INTEGER NOT NULL DEFAULT 1,
    is_default INTEGER NOT NULL DEFAULT 1,
    config_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. Report Sections
CREATE TABLE IF NOT EXISTS report_sections (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES report_templates(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL CHECK(section_type IN ('cover', 'submission_letter', 'toc', 'project_info', 'tor_evidence', 'extra_evidence', 'summary', 'signatures', 'appendix')),
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_enabled INTEGER NOT NULL DEFAULT 1,
    content_json TEXT DEFAULT '{}',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 13. Generated Reports & Exports
CREATE TABLE IF NOT EXISTS generated_reports (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    template_id TEXT REFERENCES report_templates(id),
    name TEXT NOT NULL,
    pdf_path TEXT,
    total_items INTEGER NOT NULL DEFAULT 0,
    complete_items INTEGER NOT NULL DEFAULT 0,
    missing_items INTEGER NOT NULL DEFAULT 0,
    validation_status TEXT NOT NULL DEFAULT 'PASSED' CHECK(validation_status IN ('PASSED', 'WARNING_OVERRIDDEN', 'BLOCKED')),
    override_reason TEXT,
    generated_by TEXT REFERENCES users(id),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 14. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id),
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before_state TEXT, -- JSON
    after_state TEXT, -- JSON
    device_info TEXT,
    ip_address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 15. Save Queue / Concurrency Control
CREATE TABLE IF NOT EXISTS save_queue (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    mutation_id TEXT UNIQUE NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    entity_version INTEGER NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'APPLIED' CHECK(status IN ('PENDING', 'APPLIED', 'CONFLICT')),
    conflict_reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning-fast queries
CREATE INDEX IF NOT EXISTS idx_tor_items_project ON tor_items(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_evidence_items_project ON evidence_items(project_id, status);
CREATE INDEX IF NOT EXISTS idx_evidence_files_item ON evidence_files(evidence_item_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_audit_logs_project ON audit_logs(project_id, created_at DESC);
