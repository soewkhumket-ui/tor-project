import React, { useState } from 'react';
import { EvidenceItem } from '../types';
import { CheckCircle2, XCircle, AlertCircle, X } from 'lucide-react';

interface ApprovalModalProps {
  item: EvidenceItem;
  onSuccess: () => void;
  onClose: () => void;
}

export const ApprovalModal: React.FC<ApprovalModalProps> = ({ item, onSuccess, onClose }) => {
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'APPROVE' | 'REJECT') => {
    if (action === 'REJECT' && !comment.trim()) {
      setError('กรุณาระบุเหตุผลการปฏิเสธ หรือสิ่งที่ต้องถ่ายเพิ่มเติมเพื่อแจ้งทีมงาน');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/v1/evidence/${item.evidence_id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit review');

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              ตรวจสอบและอนุมัติหลักฐานภาพถ่าย (PM Review)
            </h3>
            <p className="text-xs text-slate-500">
              หัวข้อ {item.item_number} : {item.title}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:bg-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Requirement snippet */}
          <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200/80 text-xs text-blue-900">
            <strong>ข้อกำหนดตาม TOR:</strong>
            <p className="mt-1 text-slate-700">{item.requirement}</p>
            {item.dimensions && <p className="mt-1"><strong>ขนาด:</strong> {item.dimensions}</p>}
          </div>

          {/* Photo Summary */}
          <div className="flex items-center justify-between text-xs text-slate-600 bg-slate-100 p-2.5 rounded-lg">
            <span>ภาพถ่ายที่แนบมา: <strong>{item.files.length}</strong> ภาพ</span>
            <span>ขั้นต่ำตามเกณฑ์: <strong>{item.minimum_images}</strong> ภาพ</span>
            <span className={item.files.length >= item.minimum_images ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
              {item.files.length >= item.minimum_images ? '✓ ครบจำนวน' : '⚠ ยังไม่ครบ'}
            </span>
          </div>

          {/* Rejection / Approval Comment */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              ความคิดเห็น / ข้อเสนอแนะการตรวจรับ (กรณี Reject จำเป็นต้องระบุ):
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="ระบุข้อความถึงทีมหน้างาน เช่น ขอภาพถ่ายมุมกว้างเพิ่ม หรือ อนุมัติผ่านเกณฑ์ครบถ้วน..."
              className="w-full p-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex gap-3 justify-end">
          <button
            onClick={() => handleAction('REJECT')}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm flex items-center gap-1.5 transition"
          >
            <XCircle className="w-4 h-4" />
            ส่งกลับแก้ไข (Reject)
          </button>
          <button
            onClick={() => handleAction('APPROVE')}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isSubmitting ? 'กำลังดำเนินการ...' : 'อนุมัติหลักฐาน (Approve)'}
          </button>
        </div>
      </div>
    </div>
  );
};
