export type UserRole = 'admin' | 'project_manager' | 'staff' | 'inspector';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar_url?: string;
}

export interface ProjectStats {
  total: number;
  complete: number;
  in_progress: number;
  missing: number;
  waiting_review: number;
  rejected: number;
  progress_percent: number;
  total_images?: number;
  is_tor_approved?: boolean;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  contract_number?: string;
  tor_number?: string;
  government_agency?: string;
  client?: string;
  contractor?: string;
  project_manager?: string;
  start_date?: string;
  end_date?: string;
  inspection_date?: string;
  location?: string;
  description?: string;
  export_policy: 'warning' | 'hard_lock';
  allow_location_metadata: number;
  status: 'PLANNING' | 'IN_PROGRESS' | 'REVIEW' | 'COMPLETED' | 'ARCHIVED';
  created_at: string;
  updated_at: string;
  stats?: ProjectStats;
}

export interface TorItem {
  id: string;
  project_id: string;
  section_id?: string;
  item_number: string;
  title: string;
  requirement: string;
  quantity?: number;
  unit?: string;
  dimensions?: string;
  deliverable?: string;
  evidence_required: number;
  minimum_images: number;
  capture_instructions: string[];
  capture_types: string[];
  installment_number?: number;
  installment_title?: string;
  is_additional: number;
  sort_order: number;
  status: 'DRAFT' | 'APPROVED';
}

export interface EvidenceFile {
  id: string;
  evidence_item_id: string;
  original_path: string;
  preview_path: string;
  print_path: string;
  mime_type: string;
  file_size: number;
  width: number;
  height: number;
  quality_score?: number;
  blur_score?: number;
  quality_warning?: string;
  caption?: string;
  capture_type?: string;
  sort_order: number;
  is_cover: number;
  is_hidden: number;
  annotation_json: any[];
  captured_at: string;
  status: string;
}

export interface EvidenceItem {
  evidence_id: string;
  evidence_status: 'COMPLETE' | 'IN_PROGRESS' | 'MISSING' | 'WAITING_REVIEW' | 'REJECTED' | 'NOT_REQUIRED';
  notes?: string;
  rejection_comment?: string;
  assigned_to?: string;
  evidence_version: number;
  tor_item_id: string;
  item_number: string;
  title: string;
  requirement: string;
  quantity?: number;
  unit?: string;
  dimensions?: string;
  minimum_images: number;
  capture_instructions: string[];
  capture_types: string[];
  installment_number?: number;
  installment_title?: string;
  is_additional: number;
  section_title?: string;
  files: EvidenceFile[];
}
