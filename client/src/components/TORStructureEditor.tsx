import React, { useState, useEffect } from 'react';
import { TorItem } from '../types';
import { Plus, Edit2, Trash2, CheckCircle, Sparkles, Upload, FileText, AlertCircle, Eye, Save } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface TORStructureEditorProps {
  projectId: string;
  onStructureApproved: () => void;
}

export const TORStructureEditor: React.FC<TORStructureEditorProps> = ({ projectId, onStructureApproved }) => {
  const { currentUser } = useAuth();
  const [sections, setSections] = useState<any[]>([]);
  const [items, setItems] = useState<TorItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // AI Parse raw text / file upload modal
  const [showAiModal, setShowAiModal] = useState(false);
  const [importMode, setImportMode] = useState<'file' | 'text'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Edit item modal
  const [editingItem, setEditingItem] = useState<TorItem | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const fetchStructure = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tor-structure`);
      const data = await res.json();
      setSections(data.sections || []);
      setItems(data.items || []);
    } catch (err) {
      console.error('Failed to load TOR structure:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStructure();
  }, [projectId]);

  const handleAiAnalyze = async () => {
    if (importMode === 'file' && !selectedFile) return;
    if (importMode === 'text' && !rawText.trim()) return;
    setIsAnalyzing(true);
    try {
      let res: Response;
      if (importMode === 'file' && selectedFile) {
        const formData = new FormData();
        formData.append('tor_file', selectedFile);
        formData.append('applyDirectly', 'true');
        res = await fetch(`/api/v1/projects/${projectId}/tor-upload`, {
          method: 'POST',
          body: formData
        });
      } else {
        res = await fetch(`/api/v1/projects/${projectId}/tor-analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rawText, applyDirectly: true })
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setShowAiModal(false);
      setSelectedFile(null);
      setRawText('');
      fetchStructure();
    } catch (err: any) {
      alert(`AI วิเคราะห์เอกสารล้มเหลว: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      if (editingItem.id.startsWith('new-')) {
        await fetch(`/api/v1/projects/${projectId}/tor-items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingItem)
        });
      } else {
        await fetch(`/api/v1/tor-items/${editingItem.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editingItem)
        });
      }
      setShowEditModal(false);
      fetchStructure();
    } catch (err: any) {
      alert('บันทึกรายการไม่สำเร็จ: ' + err.message);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('ต้องการลบรายการนี้ออกจากโครงสร้าง TOR หรือไม่?')) return;
    try {
      await fetch(`/api/v1/tor-items/${id}`, { method: 'DELETE' });
      fetchStructure();
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveStructure = async () => {
    if (!confirm('ยืนยันอนุมัติโครงสร้าง TOR และสร้างรายการ Checklist สำหรับเริ่มดำเนินงาน?')) return;
    setIsApproving(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/tor-approve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      alert('อนุมัติโครงสร้าง TOR และสร้าง Checklist เรียบร้อยแล้ว!');
      onStructureApproved();
    } catch (err: any) {
      alert('เกิดข้อผิดพลาด: ' + err.message);
    } finally {
      setIsApproving(false);
    }
  };

  const canEdit = currentUser?.role === 'admin' || currentUser?.role === 'project_manager';

  return (
    <div className="space-y-6">
      {/* Header bar */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            📋 ตรวจสอบและแก้ไขโครงสร้าง TOR (Human Review)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            ตรวจสอบความถูกต้องของรายการที่ AI สกัดออกมา กำหนดเกณฑ์จำนวนภาพถ่ายขั้นต่ำ ก่อนอนุมัติเพื่อสร้าง Checklist
          </p>
        </div>

        {canEdit && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowAiModal(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-50 border border-blue-200 hover:bg-blue-100 text-blue-700 font-medium text-xs flex items-center gap-1.5 transition"
            >
              <Sparkles className="w-4 h-4 text-blue-600" />
              นำเข้าข้อความ TOR (AI)
            </button>
            <button
              onClick={() => {
                setEditingItem({
                  id: `new-${Date.now()}`,
                  project_id: projectId,
                  item_number: `${items.length + 1}.1`,
                  title: '',
                  requirement: '',
                  quantity: 1,
                  unit: 'ชุด',
                  evidence_required: 1,
                  minimum_images: 4,
                  capture_instructions: ['ถ่ายภาพรวม', 'ถ่ายรายละเอียด'],
                  capture_types: ['overview', 'detail'],
                  is_additional: 0,
                  sort_order: items.length + 1,
                  status: 'DRAFT'
                });
                setShowEditModal(true);
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium text-xs flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              เพิ่มรายการเอง
            </button>
            <button
              onClick={handleApproveStructure}
              disabled={isApproving || items.length === 0}
              className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              {isApproving ? 'กำลังอนุมัติ...' : 'อนุมัติโครงสร้าง TOR (Approve)'}
            </button>
          </div>
        )}
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">ยังไม่มีรายการ TOR ในโครงการนี้</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            กดปุ่ม "นำเข้าข้อความ TOR (AI)" เพื่อให้ AI วิเคราะห์แยกหมวดหมู่และเกณฑ์หลักฐานภาพถ่ายอัตโนมัติ
          </p>
          {canEdit && (
            <button
              onClick={() => setShowAiModal(true)}
              className="mt-4 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 inline-flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" /> เริ่มนำเข้าข้อความ TOR
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:border-slate-300 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-blue-700 text-base">
                      {item.item_number}
                    </span>
                    <h3 className="font-bold text-slate-900 text-base">
                      {item.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        item.evidence_required
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.evidence_required ? `📷 ต้องมีหลักฐาน (${item.minimum_images} ภาพ)` : '⚪ ไม่ต้องมีภาพ'}
                    </span>
                    {item.is_additional === 1 && (
                      <span className="bg-amber-100 text-amber-800 text-xs px-2 py-0.5 rounded font-semibold">
                        งานเพิ่มเติม (Additional)
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-700 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {item.requirement}
                  </p>

                  <div className="flex flex-wrap gap-4 mt-2.5 text-xs text-slate-500">
                    {item.dimensions && (
                      <span>
                        <strong>ขนาด/สัดส่วน:</strong> {item.dimensions}
                      </span>
                    )}
                    {item.quantity && (
                      <span>
                        <strong>จำนวน:</strong> {item.quantity} {item.unit}
                      </span>
                    )}
                    {item.deliverable && (
                      <span>
                        <strong>สิ่งส่งมอบ:</strong> {item.deliverable}
                      </span>
                    )}
                  </div>

                  {item.capture_instructions && item.capture_instructions.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold text-slate-500">คำแนะนำการถ่าย:</span>
                      {item.capture_instructions.map((inst, i) => (
                        <span
                          key={i}
                          className="bg-blue-50 text-blue-700 text-[11px] px-2 py-0.5 rounded border border-blue-200"
                        >
                          {inst}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {canEdit && (
                  <div className="flex items-center gap-1 self-end sm:self-start">
                    <button
                      onClick={() => {
                        setEditingItem(item);
                        setShowEditModal(true);
                      }}
                      className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition"
                      title="แก้ไขรายการ"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteItem(item.id)}
                      className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-slate-100 rounded-lg transition"
                      title="ลบรายการ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* AI Parse Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                นำเข้าและสกัดโครงสร้าง TOR ด้วย AI (Hybrid)
              </h3>
              <button onClick={() => setShowAiModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="flex gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setImportMode('file')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  importMode === 'file' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                อัปโหลดไฟล์ TOR (.PDF, .DOCX, .TXT)
              </button>
              <button
                type="button"
                onClick={() => setImportMode('text')}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  importMode === 'text' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                วางข้อความ TOR
              </button>
            </div>

            {importMode === 'file' ? (
              <div className="border-2 border-dashed border-blue-300 bg-blue-50/40 rounded-xl p-6 text-center space-y-2">
                <Upload className="w-8 h-8 text-blue-600 mx-auto" />
                <p className="text-xs font-bold text-slate-700">
                  เลือกไฟล์เอกสาร TOR (.pdf, .docx, .txt, .md, .json)
                </p>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md,.json"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                />
                {selectedFile && (
                  <p className="text-xs text-emerald-700 font-semibold pt-1">
                    ✓ เลือกไฟล์แล้ว: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                  </p>
                )}
              </div>
            ) : (
              <>
                <p className="text-xs text-slate-600">
                  วางข้อความข้อกำหนด TOR ภาษาไทย ระบบจะตรวจจับหมวดงาน หัวข้อย่อย รายละเอียด ปริมาณ และสร้างคำแนะนำการถ่ายภาพให้อัตโนมัติ
                </p>
                <textarea
                  rows={8}
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="วางข้อความ TOR ที่นี่ เช่น:&#10;3. งานจัดสถานที่&#10;3.1 จัดทำเวที ขนาด 12 x 8 x 1.2 เมตร...&#10;3.2 ติดตั้งจอ LED ขนาด 7.68 x 4.32 เมตร..."
                  className="w-full p-3 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                />
              </>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleAiAnalyze}
                disabled={isAnalyzing || (importMode === 'file' ? !selectedFile : !rawText.trim())}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-blue-600/20 disabled:opacity-50"
              >
                <Sparkles className="w-4 h-4" />
                {isAnalyzing ? 'AI กำลังวิเคราะห์...' : 'เริ่มวิเคราะห์และสกัดข้อมูล'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <form onSubmit={handleSaveItem} className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <h3 className="font-bold text-base text-slate-900">
              {editingItem.id.startsWith('new-') ? 'เพิ่มรายการ TOR' : 'แก้ไขรายการ TOR'}
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เลขข้อ (Item No.)</label>
                <input
                  type="text"
                  required
                  value={editingItem.item_number}
                  onChange={(e) => setEditingItem({ ...editingItem, item_number: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อรายการ (Title)</label>
                <input
                  type="text"
                  required
                  value={editingItem.title}
                  onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">ข้อกำหนดตาม TOR (Requirement)</label>
              <textarea
                rows={3}
                required
                value={editingItem.requirement}
                onChange={(e) => setEditingItem({ ...editingItem, requirement: e.target.value })}
                className="w-full p-2 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">จำนวน (Quantity)</label>
                <input
                  type="number"
                  value={editingItem.quantity || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, quantity: parseFloat(e.target.value) || 1 })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">หน่วย (Unit)</label>
                <input
                  type="text"
                  value={editingItem.unit || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, unit: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ขนาด (Dimensions)</label>
                <input
                  type="text"
                  value={editingItem.dimensions || ''}
                  onChange={(e) => setEditingItem({ ...editingItem, dimensions: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={Boolean(editingItem.evidence_required)}
                  onChange={(e) => setEditingItem({ ...editingItem, evidence_required: e.target.checked ? 1 : 0 })}
                  className="rounded text-blue-600"
                />
                ต้องแนบหลักฐานภาพถ่าย
              </label>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">จำนวนภาพขั้นต่ำ</label>
                <input
                  type="number"
                  min={1}
                  value={editingItem.minimum_images}
                  onChange={(e) => setEditingItem({ ...editingItem, minimum_images: parseInt(e.target.value) || 4 })}
                  className="w-full p-2 border border-slate-300 rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5"
              >
                <Save className="w-4 h-4" /> บันทึก
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
