import React, { useState, useRef } from 'react';
import { Camera, Image as ImageIcon, X, AlertTriangle, CheckCircle, Sparkles, Wand2 } from 'lucide-react';
import { EvidenceItem } from '../types';
import { ImageAnnotationEditor, AnnotationItem } from './ImageAnnotationEditor';

interface MobileCameraModalProps {
  item: EvidenceItem;
  onUploadSuccess: () => void;
  onClose: () => void;
}

export const MobileCameraModal: React.FC<MobileCameraModalProps> = ({
  item,
  onUploadSuccess,
  onClose
}) => {
  const fileInputCameraRef = useRef<HTMLInputElement | null>(null);
  const fileInputGalleryRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [captureType, setCaptureType] = useState<string>('overview');
  const [isUploading, setIsUploading] = useState(false);
  const [qualityWarning, setQualityWarning] = useState<string | null>(null);
  const [createdFileId, setCreatedFileId] = useState<string | null>(null);
  const [showAnnotationEditor, setShowAnnotationEditor] = useState(false);

  const currentCount = item.files.length;
  const minRequired = item.minimum_images || 4;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);

      // Simple client-side blur / resolution pre-check
      const img = new Image();
      img.src = url;
      img.onload = () => {
        if (img.width < 800 || img.height < 600) {
          setQualityWarning('⚠️ ภาพมีความละเอียดต่ำกว่า 800x600 พิกเซล อาจไม่คมชัดเมื่อพิมพ์รายงาน A4');
        } else {
          setQualityWarning(null);
        }
      };
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('capture_type', captureType);
      formData.append('caption', caption || `${item.title} (${captureType})`);

      const res = await fetch(`/api/v1/evidence/${item.evidence_id}/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      setCreatedFileId(data.file.id);
      if (data.file.quality_warning) {
        setQualityWarning(data.file.quality_warning);
      }

      onUploadSuccess();

      // Open annotation editor or close if complete
      setShowAnnotationEditor(true);
    } catch (err: any) {
      alert(`การอัปโหลดขัดข้อง: ${err.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAnnotations = async (annotations: AnnotationItem[]) => {
    if (!createdFileId) return;
    await fetch(`/api/v1/evidence-files/${createdFileId}/annotations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ annotations })
    });
    onUploadSuccess();
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 flex flex-col justify-between backdrop-blur-sm animate-in fade-in duration-150">
        {/* Top Field HUD Banner (Requirement #13) */}
        <div className="bg-slate-900 border-b border-slate-800 p-4 text-white shadow-lg">
          <div className="flex items-center justify-between">
            <span className="bg-blue-600/30 text-blue-300 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-blue-500/30">
              📸 กำลังถ่ายภาพหลักฐานหน้างาน
            </span>
            <button
              onClick={onClose}
              className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-2">
            <h2 className="text-lg font-bold text-white">
              {item.item_number} {item.title}
            </h2>
            <p className="text-xs text-slate-300 mt-0.5 line-clamp-2">
              {item.requirement}
            </p>
          </div>

          {/* Instructions Box */}
          <div className="mt-3 bg-slate-800/80 rounded-lg p-2.5 border border-slate-700 text-xs">
            <div className="font-semibold text-blue-300 mb-1 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> ต้องเห็นในภาพ:
            </div>
            <ul className="text-slate-300 space-y-0.5">
              {item.capture_instructions && item.capture_instructions.length > 0 ? (
                item.capture_instructions.map((inst, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="text-blue-400 font-bold">•</span>
                    <span>{inst}</span>
                  </li>
                ))
              ) : (
                <li>• ภาพรวม • ตำแหน่งติดตั้ง • ขนาดโดยประมาณ</li>
              )}
            </ul>
          </div>

          {/* Image Counter */}
          <div className="mt-3 flex items-center justify-between text-xs font-medium text-slate-300">
            <span>
              ความคืบหน้าภาพถ่าย: <strong className="text-white">{currentCount}</strong> / ขั้นต่ำ {minRequired} ภาพ
            </span>
            <span className="text-emerald-400 font-bold">
              {currentCount >= minRequired ? '✓ ครบตามเกณฑ์' : `ขาดอีก ${minRequired - currentCount} ภาพ`}
            </span>
          </div>
        </div>

        {/* Center Preview or Viewfinder Area */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-y-auto">
          {previewUrl ? (
            <div className="w-full max-w-sm flex flex-col items-center gap-3">
              <div className="relative rounded-xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black">
                <img src={previewUrl} alt="Preview" className="w-full max-h-[45vh] object-contain" />
              </div>

              {qualityWarning && (
                <div className="w-full p-2.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-400" />
                  <span>{qualityWarning}</span>
                </div>
              )}

              {/* Capture Type Selection */}
              <div className="w-full">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  ประเภทมุมมองภาพ (Capture Type)
                </label>
                <select
                  value={captureType}
                  onChange={(e) => setCaptureType(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                >
                  <option value="overview">ภาพรวม (Overview)</option>
                  <option value="detail">รายละเอียดวัสดุ (Detail)</option>
                  <option value="before">ก่อนดำเนินงาน (Before)</option>
                  <option value="during">ระหว่างติดตั้ง (During)</option>
                  <option value="after">หลังแล้วเสร็จ (After / Finished Work)</option>
                  <option value="measurement">การวัดขนาด/สัดส่วน (Measurement)</option>
                  <option value="installation">ขั้นตอนการติดตั้ง (Installation)</option>
                </select>
              </div>

              {/* Caption Input */}
              <div className="w-full">
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  คำบรรยายภาพ (Caption)
                </label>
                <input
                  type="text"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder={`เช่น ภาพทดสอบระบบ ${item.title}`}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ) : (
            <div className="text-center p-8 border-2 border-dashed border-slate-700 rounded-2xl max-w-sm">
              <Camera className="w-16 h-16 text-slate-500 mx-auto mb-3" />
              <p className="text-white font-semibold text-base mb-1">พร้อมบันทึกภาพหลักฐาน</p>
              <p className="text-slate-400 text-xs">
                แตะปุ่มด้านล่างเพื่อเปิดกล้องมือถือถ่ายภาพ หรือเลือกภาพที่ถ่ายไว้แล้วจากคลัง
              </p>
            </div>
          )}
        </div>

        {/* Bottom Actions Bar with Big Buttons (Requirement #13) */}
        <div className="bg-slate-900 border-t border-slate-800 p-4">
          {/* Hidden inputs */}
          <input
            ref={fileInputCameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />
          <input
            ref={fileInputGalleryRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {previewUrl ? (
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
                className="flex-1 py-3 px-4 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
              >
                ถ่ายใหม่
              </button>
              <button
                onClick={handleUpload}
                disabled={isUploading}
                className="flex-[2] py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-base hover:from-blue-500 hover:to-indigo-500 shadow-lg shadow-blue-500/25 flex items-center justify-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                {isUploading ? 'กำลังประมวลผล 3 ระดับ...' : 'บันทึกและใส่คำอธิบายภาพ'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
              <button
                onClick={() => fileInputCameraRef.current?.click()}
                className="py-4 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-base flex flex-col items-center justify-center gap-1 shadow-lg shadow-blue-600/30 active:scale-95 transition"
              >
                <Camera className="w-6 h-6" />
                <span>📷 ถ่ายภาพ</span>
              </button>
              <button
                onClick={() => fileInputGalleryRef.current?.click()}
                className="py-4 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-base flex flex-col items-center justify-center gap-1 border border-slate-700 active:scale-95 transition"
              >
                <ImageIcon className="w-6 h-6 text-slate-300" />
                <span>🖼 เลือกจากคลัง</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Annotation Editor Modal */}
      {showAnnotationEditor && previewUrl && createdFileId && (
        <ImageAnnotationEditor
          imageUrl={previewUrl}
          fileId={createdFileId}
          itemTitle={`${item.item_number} ${item.title}`}
          onSave={handleSaveAnnotations}
          onClose={() => {
            setShowAnnotationEditor(false);
            onClose();
          }}
        />
      )}
    </>
  );
};
