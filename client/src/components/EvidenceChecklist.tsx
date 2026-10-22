import React, { useState, useEffect } from 'react';
import { EvidenceItem } from '../types';
import { useAuth } from '../context/AuthContext';
import {
  Camera, CheckCircle2, Clock, AlertCircle, HelpCircle,
  QrCode, Filter, Search, Plus, Sparkles, Send, CheckCheck,
  ChevronRight, ArrowRight, Eye, ShieldAlert, X
} from 'lucide-react';
import { MobileCameraModal } from './MobileCameraModal';
import { ApprovalModal } from './ApprovalModal';
import { ImageAnnotationEditor, AnnotationItem } from './ImageAnnotationEditor';

interface EvidenceChecklistProps {
  projectId: string;
  onRefreshStats?: () => void;
}

export const EvidenceChecklist: React.FC<EvidenceChecklistProps> = ({ projectId, onRefreshStats }) => {
  const { currentUser } = useAuth();
  const [items, setItems] = useState<EvidenceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [activeCaptureItem, setActiveCaptureItem] = useState<EvidenceItem | null>(null);
  const [activeReviewItem, setActiveReviewItem] = useState<EvidenceItem | null>(null);
  const [activeQrModal, setActiveQrModal] = useState<{ id: string; qrUrl: string; title: string } | null>(null);
  const [editingAnnotationFile, setEditingAnnotationFile] = useState<{ file: any; itemTitle: string } | null>(null);

  // Extra evidence modal
  const [showExtraModal, setShowExtraModal] = useState(false);
  const [extraTitle, setExtraTitle] = useState('');
  const [extraReq, setExtraReq] = useState('');

  const fetchChecklist = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/evidence`);
      const data = await res.json();
      setItems(data.evidence_items || []);
      if (onRefreshStats) onRefreshStats();
    } catch (err) {
      console.error('Failed to load evidence checklist:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChecklist();
  }, [projectId]);

  const handleShowQr = async (item: EvidenceItem) => {
    try {
      const res = await fetch(`/api/v1/evidence/${item.evidence_id}/qrcode`);
      const data = await res.json();
      setActiveQrModal({
        id: item.evidence_id,
        qrUrl: data.qrDataUrl,
        title: `${item.item_number} ${item.title}`
      });
    } catch (err) {
      console.error('Failed to fetch QR code:', err);
    }
  };

  const handleSubmitForReview = async (evidenceId: string) => {
    try {
      const res = await fetch(`/api/v1/evidence/${evidenceId}/submit`, { method: 'POST' });
      if (res.ok) {
        fetchChecklist();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddExtra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extraTitle.trim()) return;
    try {
      await fetch('/api/v1/evidence/extra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          title: extraTitle,
          requirement: extraReq || extraTitle
        })
      });
      setShowExtraModal(false);
      setExtraTitle('');
      setExtraReq('');
      fetchChecklist();
    } catch (err) {
      console.error(err);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesFilter =
      statusFilter === 'ALL' ||
      item.evidence_status === statusFilter;

    const matchesSearch =
      searchQuery.trim() === '' ||
      item.item_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.requirement.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesFilter && matchesSearch;
  });

  // Calculate summary counts
  const countComplete = items.filter(i => i.evidence_status === 'COMPLETE').length;
  const countInProgress = items.filter(i => i.evidence_status === 'IN_PROGRESS').length;
  const countMissing = items.filter(i => i.evidence_status === 'MISSING').length;
  const countWaiting = items.filter(i => i.evidence_status === 'WAITING_REVIEW').length;
  const countRejected = items.filter(i => i.evidence_status === 'REJECTED').length;
  const totalCount = items.length;
  const progressPercent = totalCount > 0 ? Math.round((countComplete / totalCount) * 100) : 0;

  const isPMorAdmin = currentUser?.role === 'admin' || currentUser?.role === 'project_manager';

  return (
    <div className="space-y-6">
      {/* 1. Statistics Cards (Requirement #9) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">งานทั้งหมด</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
          <div className="text-[11px] text-blue-600 font-semibold mt-0.5">
            ความคืบหน้า {progressPercent}%
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
          <p className="text-xs text-emerald-700 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> ครบถ้วน (Complete)
          </p>
          <p className="text-2xl font-bold text-emerald-700 mt-1">{countComplete}</p>
          <p className="text-[11px] text-emerald-600 mt-0.5">ผ่านการตรวจแล้ว</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
          <p className="text-xs text-amber-700 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> กำลังดำเนินการ
          </p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{countInProgress}</p>
          <p className="text-[11px] text-amber-600 mt-0.5">ถ่ายภาพบางส่วน</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-sm">
          <p className="text-xs text-rose-700 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> ยังไม่เริ่ม / ขาด
          </p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{countMissing}</p>
          <p className="text-[11px] text-rose-600 mt-0.5">รอส่งหลักฐาน</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
          <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500" /> รอตรวจสอบ
          </p>
          <p className="text-2xl font-bold text-blue-700 mt-1">{countWaiting}</p>
          <p className="text-[11px] text-blue-600 mt-0.5">รอ PM อนุมัติ</p>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
          <p className="text-xs text-purple-700 font-medium flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500" /> ส่งกลับแก้ไข
          </p>
          <p className="text-2xl font-bold text-purple-700 mt-1">{countRejected}</p>
          <p className="text-[11px] text-purple-600 mt-0.5">ต้องถ่ายภาพเพิ่ม</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-2">
          <span>ความพร้อมในการส่งมอบงานทั้งหมด</span>
          <span className="text-blue-700 font-bold">{countComplete} จาก {totalCount} รายการ ({progressPercent}%)</span>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden flex">
          <div
            className="bg-emerald-500 h-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
          <div
            className="bg-blue-400 h-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (countWaiting / totalCount) * 100 : 0}%` }}
          />
          <div
            className="bg-amber-400 h-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (countInProgress / totalCount) * 100 : 0}%` }}
          />
          <div
            className="bg-purple-400 h-full transition-all duration-500"
            style={{ width: `${totalCount > 0 ? (countRejected / totalCount) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Status filter pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          {[
            { key: 'ALL', label: `ทั้งหมด (${totalCount})` },
            { key: 'COMPLETE', label: `🟢 ครบ (${countComplete})` },
            { key: 'IN_PROGRESS', label: `🟡 ดำเนินการ (${countInProgress})` },
            { key: 'MISSING', label: `🔴 ขาด (${countMissing})` },
            { key: 'WAITING_REVIEW', label: `🔵 รอตรวจ (${countWaiting})` },
            { key: 'REJECTED', label: `🟣 แก้ไข (${countRejected})` }
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition ${
                statusFilter === f.key
                  ? 'bg-navy-900 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search & Extra Evidence Button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาข้อ/ชื่อรายการ..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <button
            onClick={() => setShowExtraModal(true)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1 whitespace-nowrap shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            เพิ่มหลักฐานอื่น
          </button>
        </div>
      </div>

      {/* 2. Checklist Items List */}
      <div className="space-y-4">
        {filteredItems.map(item => {
          const currentPhotos = item.files.length;
          const minRequired = item.minimum_images || 4;
          const isComplete = item.evidence_status === 'COMPLETE';
          const isWaiting = item.evidence_status === 'WAITING_REVIEW';
          const isRejected = item.evidence_status === 'REJECTED';

          // Status Badge details
          let statusBadge = (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
              ⚪ ยังไม่เริ่ม
            </span>
          );
          if (isComplete) {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                🟢 ครบถ้วน (Approved)
              </span>
            );
          } else if (isWaiting) {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300">
                🔵 รอ PM ตรวจสอบ
              </span>
            );
          } else if (isRejected) {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
                🟣 ส่งกลับให้แก้ไข
              </span>
            );
          } else if (currentPhotos > 0) {
            statusBadge = (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                🟡 กำลังดำเนินการ
              </span>
            );
          }

          return (
            <div
              key={item.evidence_id}
              className={`bg-white rounded-xl border p-4 shadow-sm transition hover:shadow-md ${
                isRejected ? 'border-purple-300 bg-purple-50/10' : 'border-slate-200'
              }`}
            >
              {/* Top Row: Item number, title, status */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-blue-700 text-lg">
                    {item.item_number}
                  </span>
                  <h3 className="font-bold text-slate-900 text-base">
                    {item.title}
                  </h3>
                  {statusBadge}
                  {item.is_additional === 1 && (
                    <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                      หลักฐานเพิ่มเติม (Additional)
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleShowQr(item)}
                    className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs flex items-center gap-1"
                    title="สร้าง QR Code สแกนเข้าถ่ายภาพ"
                  >
                    <QrCode className="w-4 h-4 text-blue-600" />
                    <span className="hidden sm:inline">QR หน้างาน</span>
                  </button>
                </div>
              </div>

              {/* Requirement Text */}
              <div className="mt-3 text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                <strong>TOR:</strong> {item.requirement}
                {item.dimensions && <span className="ml-2">| <strong>ขนาด:</strong> {item.dimensions}</span>}
                {item.quantity && <span className="ml-2">| <strong>จำนวน:</strong> {item.quantity} {item.unit}</span>}
              </div>

              {/* Instructions Tags */}
              {item.capture_instructions && item.capture_instructions.length > 0 && (
                <div className="mt-2.5 flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="font-semibold text-slate-500 text-[11px]">ต้องถ่าย:</span>
                  {item.capture_instructions.map((inst, i) => (
                    <span key={i} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 text-[11px]">
                      □ {inst}
                    </span>
                  ))}
                </div>
              )}

              {/* Rejection comment warning */}
              {item.rejection_comment && (
                <div className="mt-2.5 p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-purple-900 text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>ข้อเสนอแนะให้แก้ไขจากผู้จัดการโครงการ:</strong>
                    <p className="mt-0.5">{item.rejection_comment}</p>
                  </div>
                </div>
              )}

              {/* Photos Grid (Thumbnails) */}
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-700">
                    ภาพถ่ายหลักฐาน ({currentPhotos} / ขั้นต่ำ {minRequired} ภาพ)
                  </span>
                  <span className={currentPhotos >= minRequired ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                    {currentPhotos >= minRequired ? '✓ ครบตามเกณฑ์' : `ยังขาดอีก ${minRequired - currentPhotos} ภาพ`}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Render uploaded photos */}
                  {item.files.map((file, idx) => (
                    <div
                      key={file.id}
                      className="group relative rounded-lg overflow-hidden border border-slate-200 bg-slate-100 aspect-video flex flex-col justify-end"
                    >
                      <img
                        src={`/storage/${file.preview_path || file.original_path}`}
                        alt={file.caption || 'Evidence'}
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-90 group-hover:opacity-100 transition" />

                      {/* Quality badge */}
                      {file.blur_score !== undefined && (
                        <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                          คมชัด {file.blur_score}%
                        </div>
                      )}

                      {/* Edit Annotations button */}
                      <button
                        onClick={() => setEditingAnnotationFile({ file, itemTitle: `${item.item_number} ${item.title}` })}
                        className="absolute top-1.5 right-1.5 bg-blue-600/90 hover:bg-blue-600 text-white text-[10px] font-semibold px-2 py-0.5 rounded shadow flex items-center gap-1"
                      >
                        🎨 ใส่คำอธิบาย
                      </button>

                      <div className="relative p-1.5 text-[11px] text-white truncate">
                        ภาพที่ {idx + 1}: {file.caption || file.capture_type}
                      </div>
                    </div>
                  ))}

                  {/* Empty slots placeholders */}
                  {Array.from({ length: Math.max(0, minRequired - currentPhotos) }).map((_, idx) => (
                    <button
                      key={`placeholder-${idx}`}
                      onClick={() => setActiveCaptureItem(item)}
                      className="rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/30 aspect-video flex flex-col items-center justify-center gap-1 text-slate-400 hover:text-blue-600 transition"
                    >
                      <Camera className="w-5 h-5" />
                      <span className="text-[11px] font-medium">+ รอภาพที่ {currentPhotos + idx + 1}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Bottom Actions Row */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs text-slate-500">
                  ผู้รับผิดชอบ: {item.assigned_to ? 'วิชัย (Field Staff)' : 'ยังไม่มอบหมาย'}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveCaptureItem(item)}
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    📷 ถ่ายภาพหน้างาน
                  </button>

                  {/* Submit for review button for Staff */}
                  {!isComplete && !isWaiting && currentPhotos >= minRequired && (
                    <button
                      onClick={() => handleSubmitForReview(item.evidence_id)}
                      className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-sm transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      ส่งตรวจ (Submit)
                    </button>
                  )}

                  {/* Review button for PM / Admin */}
                  {isPMorAdmin && (
                    <button
                      onClick={() => setActiveReviewItem(item)}
                      className="px-3.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-semibold text-xs flex items-center gap-1.5 transition"
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                      ตรวจและอนุมัติ (Review)
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Camera Modal */}
      {activeCaptureItem && (
        <MobileCameraModal
          item={activeCaptureItem}
          onUploadSuccess={() => {
            fetchChecklist();
          }}
          onClose={() => setActiveCaptureItem(null)}
        />
      )}

      {/* Approval Modal */}
      {activeReviewItem && (
        <ApprovalModal
          item={activeReviewItem}
          onSuccess={() => {
            fetchChecklist();
          }}
          onClose={() => setActiveReviewItem(null)}
        />
      )}

      {/* Annotation Editor on existing file */}
      {editingAnnotationFile && (
        <ImageAnnotationEditor
          imageUrl={`/storage/${editingAnnotationFile.file.preview_path || editingAnnotationFile.file.original_path}`}
          initialAnnotations={editingAnnotationFile.file.annotation_json || []}
          fileId={editingAnnotationFile.file.id}
          itemTitle={editingAnnotationFile.itemTitle}
          onSave={async (annotations: AnnotationItem[]) => {
            await fetch(`/api/v1/evidence-files/${editingAnnotationFile.file.id}/annotations`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ annotations })
            });
            fetchChecklist();
          }}
          onClose={() => setEditingAnnotationFile(null)}
        />
      )}

      {/* QR Code Modal (Requirement #24) */}
      {activeQrModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xs w-full p-6 text-center shadow-2xl space-y-3">
            <h3 className="font-bold text-sm text-slate-900">QR Code ถ่ายหลักฐานหน้างาน</h3>
            <p className="text-xs text-slate-500">{activeQrModal.title}</p>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 inline-block">
              <img src={activeQrModal.qrUrl} alt="QR Code" className="w-52 h-52 mx-auto" />
            </div>
            <p className="text-[11px] text-slate-400">
              ใช้โทรศัพท์มือถือสแกนเพื่อเปิดหน้าต่างถ่ายภาพหัวข้อนี้โดยตรง
            </p>
            <button
              onClick={() => setActiveQrModal(null)}
              className="w-full py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold hover:bg-slate-700"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Extra Evidence Modal (Requirement #31) */}
      {showExtraModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleAddExtra} className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900">
                + เพิ่มหลักฐานอื่น (Extra Evidence)
              </h3>
              <button type="button" onClick={() => setShowExtraModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              <strong>หมายเหตุ:</strong> รายการนี้จะถูกระบุในเอกสารเป็น <em>"Additional Evidence — Not Original TOR Requirement"</em> เพื่อไม่ให้ปะปนกับข้อกำหนด TOR เดิม
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อรายการหลักฐานเพิ่มเติม</label>
              <input
                type="text"
                required
                value={extraTitle}
                onChange={(e) => setExtraTitle(e.target.value)}
                placeholder="เช่น การทำความสะอาดพื้นที่หลังจบงาน"
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">คำอธิบาย</label>
              <textarea
                rows={2}
                value={extraReq}
                onChange={(e) => setExtraReq(e.target.value)}
                placeholder="รายละเอียดหลักฐานเพิ่มเติม..."
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowExtraModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-500"
              >
                เพิ่มรายการ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
