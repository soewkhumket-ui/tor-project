import React, { useState, useEffect, useRef } from 'react';
import { Project } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Plus, Search, Building2, MapPin, FileText, ArrowRight,
  Upload, Sparkles, CheckCircle2, FileUp, ClipboardPaste, Trash2, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

interface DashboardPageProps {
  onSelectProject: (projectId: string) => void;
}

const SAMPLE_TOR_DOCUMENT_TEXT = `ชื่อโครงการ: โครงการจัดงานมหกรรมนวัตกรรมดิจิทัลและนิทรรศการบริการภาครัฐ ประจำปี 2569
รหัสโครงการ: PRJ-2569-DIGI-09
สัญญาเลขที่: สนท.88/2569
เลขที่ TOR: TOR-DGA-12/2569
หน่วยงานเจ้าของโครงการ: สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)
ผู้ว่าจ้าง: สำนักงานพัฒนารัฐบาลดิจิทัล (องค์การมหาชน)
ผู้รับจ้างดำเนินงาน: บริษัท ไทยสมาร์ท อีเวนต์ แอนด์ เทคโนโลยี จำกัด
ผู้จัดการโครงการ: นายกิตติศักดิ์ พัฒนเสรี
วันเริ่มสัญญา: 2026-11-01
วันสิ้นสุดสัญญา: 2026-11-30
สถานที่ดำเนินงาน: ศูนย์การประชุมแห่งชาติสิริกิติ์ ฮอลล์ 1-2 กรุงเทพมหานคร

1. งานจัดเตรียมพื้นที่และโครงสร้างหลัก
1.1 สำรวจพื้นที่และจัดทำผังบริเวณงาน (Master Layout Plan) ครอบคลุมพื้นที่ 3,500 ตารางเมตร จำนวน 1 งาน
1.2 จัดทำเวทีหลัก (Main Stage) โครงสร้างเหล็กปูไม้อัดปูพรม ขนาดไม่น้อยกว่า 16.0 × 8.0 × 1.2 เมตร จำนวน 1 ชุด
2. งานระบบภาพ แสง เสียง และมัลติมีเดีย
2.1 ติดตั้งจอแสดงผล LED Full Color ความละเอียด P2.5 ขนาดไม่น้อยกว่า 10.0 × 4.5 เมตร จำนวน 1 ระบบ
2.2 ติดตั้งระบบไฟแสงสีเวที Moving Head Beam และไฟส่องสว่างเวทีพร้อมบอร์ดควบคุม จำนวน 1 ระบบ
2.3 ติดตั้งระบบเครื่องเสียง Line Array พร้อมไมโครโฟนไร้สายดิจิทัล จำนวน 1 ระบบ
3. งานคูหานิทรรศการและจุดลงทะเบียนอัจฉริยะ
3.1 จัดทำบูธนิทรรศการหน่วยงานภาครัฐ โครงสร้าง Maxima ขนาด 3.0 × 3.0 × 2.5 เมตร จำนวน 24 คูหา
3.2 จัดทำเคาน์เตอร์ลงทะเบียนอัจฉริยะพร้อมระบบสแกน QR Code และพิมพ์บัตรผู้ร่วมงาน จำนวน 6 จุด
3.3 ติดตั้งป้ายประชาสัมพันธ์หน้างานและป้ายนำทาง (Wayfinding Signage) จำนวน 12 จุด`;

export const DashboardPage: React.FC<DashboardPageProps> = ({ onSelectProject }) => {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Hybrid Mode states inside Create Project Modal
  const [inputMode, setInputMode] = useState<'hybrid_upload' | 'paste_text' | 'manual_only'>('hybrid_upload');
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [tempFileToken, setTempFileToken] = useState<string | null>(null);
  const [uploadedMimeType, setUploadedMimeType] = useState<string | null>(null);
  const [extractedSections, setExtractedSections] = useState<any[]>([]);
  const [extractedItemsCount, setExtractedItemsCount] = useState<number>(0);
  const [autoCreateChecklist, setAutoCreateChecklist] = useState<boolean>(true);
  const [showExtractedPreview, setShowExtractedPreview] = useState<boolean>(false);
  const [pastedTorText, setPastedTorText] = useState<string>('');
  const [autoFillSuccessMsg, setAutoFillSuccessMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New project form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    contract_number: '',
    tor_number: '',
    government_agency: '',
    client: '',
    contractor: '',
    project_manager: '',
    start_date: '',
    end_date: '',
    inspection_date: '',
    location: '',
    description: '',
    export_policy: 'warning' as 'warning' | 'hard_lock'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/v1/projects');
      const data = await res.json();
      setProjects(data.projects || []);
    } catch (err) {
      console.error('Failed to fetch projects:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const resetModalState = () => {
    setFormData({
      name: '',
      code: '',
      contract_number: '',
      tor_number: '',
      government_agency: '',
      client: '',
      contractor: '',
      project_manager: '',
      start_date: '',
      end_date: '',
      inspection_date: '',
      location: '',
      description: '',
      export_policy: 'warning'
    });
    setUploadedFileName(null);
    setTempFileToken(null);
    setUploadedMimeType(null);
    setExtractedSections([]);
    setExtractedItemsCount(0);
    setAutoCreateChecklist(true);
    setShowExtractedPreview(false);
    setPastedTorText('');
    setAutoFillSuccessMsg(null);
    setFormError(null);
    setInputMode('hybrid_upload');
  };

  const applyExtractedData = (data: any, sourceLabel: string) => {
    const meta = data.projectMetadata || {};
    setFormData(prev => ({
      ...prev,
      name: meta.name || prev.name,
      code: meta.code || prev.code,
      contract_number: meta.contract_number || prev.contract_number,
      tor_number: meta.tor_number || prev.tor_number,
      government_agency: meta.government_agency || prev.government_agency,
      client: meta.client || meta.government_agency || prev.client,
      contractor: meta.contractor || prev.contractor,
      project_manager: meta.project_manager || prev.project_manager,
      start_date: meta.start_date || prev.start_date,
      end_date: meta.end_date || prev.end_date,
      location: meta.location || prev.location,
      description: meta.description || prev.description,
      export_policy: meta.export_policy || prev.export_policy
    }));

    const sections = data.sections || [];
    const rawItems = data.rawItems || [];
    setExtractedSections(sections);
    setExtractedItemsCount(rawItems.length);
    setUploadedFileName(data.filename || sourceLabel);
    setTempFileToken(data.tempFileToken || null);
    setUploadedMimeType(data.mimeType || null);
    setAutoFillSuccessMsg(
      `ดึงรายละเอียดโครงการอัตโนมัติสำเร็จจาก "${data.filename || sourceLabel}" และพบหัวข้อ TOR ${rawItems.length} รายการ (${sections.length} หมวดงาน)`
    );
  };

  // Handle file upload for automatic project metadata + TOR extraction
  const handleFileUploadExtract = async (file: File) => {
    setIsExtracting(true);
    setFormError(null);
    setAutoFillSuccessMsg(null);

    try {
      const fd = new FormData();
      fd.append('project_file', file);

      const res = await fetch('/api/v1/projects/extract-metadata', {
        method: 'POST',
        body: fd
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถอ่านไฟล์ได้');

      applyExtractedData(data, file.name);
    } catch (err: any) {
      setFormError(`การอ่านไฟล์ขัดข้อง: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  // Handle raw text or sample TOR extraction
  const handleTextExtract = async (textToAnalyze: string, label = 'ข้อความ TOR ที่วาง') => {
    if (!textToAnalyze.trim()) {
      setFormError('กรุณาวางข้อความโครงการหรือข้อกำหนด TOR ก่อนกดสกัดข้อมูล');
      return;
    }

    setIsExtracting(true);
    setFormError(null);
    setAutoFillSuccessMsg(null);

    try {
      const res = await fetch('/api/v1/projects/extract-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_text: textToAnalyze,
          filename: label
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถสกัดข้อมูลได้');

      applyExtractedData(data, label);
    } catch (err: any) {
      setFormError(`การวิเคราะห์ข้อความขัดข้อง: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUploadExtract(e.dataTransfer.files[0]);
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('กรุณากรอกชื่อโครงการและรหัสโครงการ');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const payload = {
        ...formData,
        sections: extractedSections.length > 0 ? extractedSections : undefined,
        auto_create_checklist: extractedSections.length > 0 ? autoCreateChecklist : false,
        temp_file_token: tempFileToken,
        original_filename: uploadedFileName,
        mime_type: uploadedMimeType
      };

      const res = await fetch('/api/v1/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create project');

      setShowCreateModal(false);
      resetModalState();
      fetchProjects();
      onSelectProject(data.projectId);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.contract_number && p.contract_number.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const canCreate = currentUser?.role === 'admin' || currentUser?.role === 'project_manager';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-navy-900 via-blue-900 to-gov-800 rounded-2xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="bg-blue-500/20 text-blue-300 text-xs font-semibold px-3 py-1 rounded-full border border-blue-400/30">
            ระบบบริหารหลักฐาน TOR และสร้างเอกสารส่งมอบงาน
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold mt-3 leading-tight">
            โครงการตรวจรับพัสดุและส่งมอบงานภาครัฐ
          </h1>
          <p className="text-sm text-slate-300 mt-2">
            Upload TOR → AI สกัดหัวข้อ → สร้าง Checklist → ทีมถ่ายหลักฐานหน้างาน → ตรวจความครบถ้วน → จัดหน้า A4 พิมพ์ PDF พร้อมส่งงาน
          </p>
        </div>
      </div>

      {/* Action and Search Header */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ค้นหาชื่อโครงการ รหัส หรือเลขที่สัญญา..."
            className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white shadow-sm"
          />
        </div>

        {canCreate && (
          <button
            onClick={() => {
              resetModalState();
              setShowCreateModal(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            + สร้างโครงการใหม่
          </button>
        )}
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          กำลังโหลดรายการโครงการ...
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">ไม่พบโครงการที่ค้นหา</h3>
          <p className="text-xs text-slate-500 mt-1">เริ่มต้นโดยการคลิกปุ่ม "+ สร้างโครงการใหม่"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((p) => {
            const stats = p.stats || { total: 0, complete: 0, in_progress: 0, missing: 0, progress_percent: 0 };
            return (
              <div
                key={p.id}
                onClick={() => onSelectProject(p.id)}
                className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md hover:border-blue-400 transition cursor-pointer flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {p.code}
                    </span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      สัญญา: {p.contract_number || '-'}
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-blue-700 transition line-clamp-2">
                    {p.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{p.government_agency || p.client || 'หน่วยงานภาครัฐ'}</span>
                  </p>

                  {p.location && (
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{p.location}</span>
                    </p>
                  )}
                </div>

                <div className="mt-5 pt-4 border-t border-slate-100">
                  {/* Progress bar */}
                  <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                    <span className="text-slate-600">หลักฐานครบถ้วน</span>
                    <span className="text-blue-700 font-bold">{stats.complete}/{stats.total} รายการ ({stats.progress_percent}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden mb-3">
                    <div
                      className="bg-emerald-500 h-full transition-all duration-300"
                      style={{ width: `${stats.progress_percent}%` }}
                    />
                  </div>

                  {/* Summary badges */}
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-emerald-600 font-semibold">🟢 {stats.complete} ครบ</span>
                      <span className="text-amber-600 font-semibold">🟡 {stats.in_progress} ทำอยู่</span>
                      <span className="text-rose-600 font-semibold">🔴 {stats.missing} ขาด</span>
                    </div>

                    <div className="text-blue-600 font-semibold flex items-center gap-1 group-hover:translate-x-1 transition">
                      เปิดโครงการ <ArrowRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Project Modal (Hybrid Auto-Extract + Manual Form) */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleCreateProject}
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-4 my-8 max-h-[92vh] overflow-y-auto"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                  🏛️ สร้างโครงการใหม่ (Create Project)
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  เลือกอัปโหลดไฟล์ TOR เพื่อให้ AI กรอกข้อมูลให้อัตโนมัติ หรือกรอก/แก้ไขรายละเอียดด้วยตนเอง (Hybrid Mode)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            {/* Hybrid Mode Selector Tabs */}
            <div className="grid grid-cols-3 gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
              <button
                type="button"
                onClick={() => setInputMode('hybrid_upload')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  inputMode === 'hybrid_upload'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileUp className="w-4 h-4" />
                อัปโหลดไฟล์โครงการ (Auto-Fill)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste_text')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  inputMode === 'paste_text'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardPaste className="w-4 h-4" />
                วางข้อความ TOR (Auto-Fill)
              </button>
              <button
                type="button"
                onClick={() => setInputMode('manual_only')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition ${
                  inputMode === 'manual_only'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-4 h-4" />
                กรอกข้อมูลเอง (รูปแบบเดิม)
              </button>
            </div>

            {/* Smart Upload / Auto-Extract Section (Shown in hybrid_upload or paste_text modes) */}
            {inputMode === 'hybrid_upload' && (
              <div className="space-y-2.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.json,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUploadExtract(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => !isExtracting && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition ${
                    isDragging
                      ? 'border-blue-500 bg-blue-50/70'
                      : 'border-blue-300 bg-gradient-to-b from-blue-50/50 to-slate-50/40 hover:border-blue-500 hover:bg-blue-50/40'
                  }`}
                >
                  {isExtracting ? (
                    <div className="py-3 flex flex-col items-center justify-center gap-2 text-blue-700">
                      <RefreshCw className="w-7 h-7 animate-spin text-blue-600" />
                      <p className="text-xs font-bold">
                        AI กำลังอ่านไฟล์และสกัดรายละเอียดโครงการ + โครงสร้าง TOR อัตโนมัติ...
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm">
                        <Upload className="w-5 h-5" />
                      </div>
                      <div className="text-xs font-bold text-slate-800">
                        คลิกเลือกไฟล์โครงการ / TOR หรือลากไฟล์มาวางที่นี่ เพื่อกรอกข้อมูลอัตโนมัติ
                      </div>
                      <p className="text-[11px] text-slate-500">
                        รองรับไฟล์ <span className="font-semibold text-slate-700">PDF, Word (.docx), TXT, Markdown, JSON</span> (อ่านชื่อโครงการ, รหัส, สัญญา, หน่วยงาน, วันที่ และแตกหัวข้อ TOR ให้อัตโนมัติ)
                      </p>
                      <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-sm hover:bg-blue-500">
                          📂 เลือกไฟล์จากเครื่อง
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTextExtract(SAMPLE_TOR_DOCUMENT_TEXT, 'TOR_มหกรรมนวัตกรรมดิจิทัล_2569.pdf');
                          }}
                          className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center gap-1"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          ทดลองดึงข้อมูลจากไฟล์ตัวอย่างอัตโนมัติ
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {inputMode === 'paste_text' && (
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    วางข้อความรายละเอียดโครงการ / TOR เพื่อให้ระบบแยกข้อมูลใส่ช่องด้านล่างอัตโนมัติ
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPastedTorText(SAMPLE_TOR_DOCUMENT_TEXT);
                      handleTextExtract(SAMPLE_TOR_DOCUMENT_TEXT, 'ข้อความตัวอย่าง_TOR_2569.txt');
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-semibold"
                  >
                    + ใส่ข้อความตัวอย่างแล้วสกัดทันที
                  </button>
                </div>
                <textarea
                  rows={4}
                  value={pastedTorText}
                  onChange={(e) => setPastedTorText(e.target.value)}
                  placeholder="วางข้อความจากไฟล์ TOR เช่น ชื่อโครงการ, เลขที่สัญญา, หน่วยงาน, วันเริ่ม-สิ้นสุด และหัวข้อ 1.1, 1.2..."
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    disabled={isExtracting || !pastedTorText.trim()}
                    onClick={() => handleTextExtract(pastedTorText)}
                    className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isExtracting ? 'กำลังสกัดข้อมูล...' : 'สกัดรายละเอียดใส่ฟอร์มอัตโนมัติ'}
                  </button>
                </div>
              </div>
            )}

            {/* Auto-fill Success Banner & Extracted TOR Items Summary */}
            {autoFillSuccessMsg && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 text-emerald-900 text-xs">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">{autoFillSuccessMsg}</span>
                      <p className="text-[11px] text-emerald-700 mt-0.5">
                        คุณสามารถตรวจสอบหรือแก้ไขข้อมูลในช่องด้านล่างได้ตามต้องการก่อนกดสร้างโครงการ
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAutoFillSuccessMsg(null);
                      setUploadedFileName(null);
                      setExtractedSections([]);
                      setExtractedItemsCount(0);
                    }}
                    className="text-emerald-700 hover:text-rose-600 p-1"
                    title="ล้างไฟล์ที่อัปโหลด"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {extractedItemsCount > 0 && (
                  <div className="pt-2 border-t border-emerald-200/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-xs font-semibold text-emerald-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoCreateChecklist}
                        onChange={(e) => setAutoCreateChecklist(e.target.checked)}
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      นำเข้าหัวข้อ TOR และสร้าง Checklist ({extractedItemsCount} รายการ) เข้าสู่โครงการทันที
                    </label>

                    <button
                      type="button"
                      onClick={() => setShowExtractedPreview(!showExtractedPreview)}
                      className="text-[11px] font-bold text-blue-700 hover:underline flex items-center gap-1 self-start sm:self-auto"
                    >
                      {showExtractedPreview ? (
                        <>ซ่อนรายการที่สกัดได้ <ChevronUp className="w-3.5 h-3.5" /></>
                      ) : (
                        <>ดูรายการ TOR ที่สกัดได้ ({extractedItemsCount}) <ChevronDown className="w-3.5 h-3.5" /></>
                      )}
                    </button>
                  </div>
                )}

                {showExtractedPreview && extractedSections.length > 0 && (
                  <div className="mt-2 bg-white rounded-lg border border-emerald-200 p-2.5 max-h-40 overflow-y-auto space-y-2 text-xs">
                    {extractedSections.map((sec, sIdx) => (
                      <div key={sIdx}>
                        <div className="font-bold text-slate-800">
                          หมวด {sec.section_number}: {sec.title}
                        </div>
                        <ul className="pl-4 mt-0.5 space-y-0.5 text-[11px] text-slate-600">
                          {(sec.items || []).map((it: any, iIdx: number) => (
                            <li key={iIdx}>
                              • <strong>{it.item_number} {it.title}</strong> ({it.quantity || 1} {it.unit || 'งาน'}) — ขั้นต่ำ {it.minimum_images || 4} ภาพ
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {formError}
              </div>
            )}

            {/* Classic Form Fields (Always present & editable in Hybrid design) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ชื่อโครงการ (Project Name) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="เช่น โครงการจัดงานนิทรรศการและประชุมวิชาการประจำปี 2567"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  รหัสโครงการ (Project Code) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  placeholder="PRJ-2567-EVT-01"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  สัญญาเลขที่ (Contract Number)
                </label>
                <input
                  type="text"
                  value={formData.contract_number}
                  onChange={(e) => setFormData({ ...formData, contract_number: e.target.value })}
                  placeholder="กท.45/2567"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  เลขที่ TOR (TOR Number)
                </label>
                <input
                  type="text"
                  value={formData.tor_number}
                  onChange={(e) => setFormData({ ...formData, tor_number: e.target.value })}
                  placeholder="TOR-08/2567"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  หน่วยงานเจ้าของโครงการ (Government Agency)
                </label>
                <input
                  type="text"
                  value={formData.government_agency}
                  onChange={(e) => setFormData({ ...formData, government_agency: e.target.value })}
                  placeholder="สำนักงานส่งเสริมเทคโนโลยีและนวัตกรรมภาครัฐ"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้รับจ้างดำเนินงาน (Contractor)
                </label>
                <input
                  type="text"
                  value={formData.contractor}
                  onChange={(e) => setFormData({ ...formData, contractor: e.target.value })}
                  placeholder="บริษัท สยาม อีเวนต์ จำกัด"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  ผู้จัดการโครงการ (Project Manager)
                </label>
                <input
                  type="text"
                  value={formData.project_manager}
                  onChange={(e) => setFormData({ ...formData, project_manager: e.target.value })}
                  placeholder="นายกิตติศักดิ์ พัฒนเสรี"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วันเริ่มสัญญา</label>
                <input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">วันสิ้นสุดสัญญา</label>
                <input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">สถานที่ดำเนินงาน (Location)</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="ศูนย์การประชุมแห่งชาติสิริกิติ์ กรุงเทพฯ"
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  นโยบายการส่งออกเอกสาร (Export Policy - Requirement #42)
                </label>
                <select
                  value={formData.export_policy}
                  onChange={(e) => setFormData({ ...formData, export_policy: e.target.value as any })}
                  className="w-full p-2.5 text-xs border border-slate-300 rounded-xl"
                >
                  <option value="warning">Warning: อนุญาตให้ส่งออกได้แม้หลักฐานยังไม่ครบ แต่มีข้อความเตือน</option>
                  <option value="hard_lock">Hard Lock: ล็อกไม่อนุญาตให้ออกรายงาน PDF จนกว่าหลักฐานจะครบ 100%</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div className="text-[11px] text-slate-500">
                {extractedItemsCount > 0 && autoCreateChecklist
                  ? `✨ พร้อมสร้างโครงการ + นำเข้า ${extractedItemsCount} รายการ TOR ทันที`
                  : 'สามารถปรับแก้ข้อมูลได้ตลอดเวลาหลังสร้างโครงการ'}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || isExtracting}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'กำลังสร้างโครงการ...'
                    : extractedItemsCount > 0 && autoCreateChecklist
                    ? `สร้างโครงการ + นำเข้า TOR (${extractedItemsCount} ข้อ)`
                    : 'สร้างโครงการ'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
