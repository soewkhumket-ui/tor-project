import React, { useState, useEffect } from 'react';
import { Project, TorItem } from '../types';
import { Download, LayoutGrid, FileText, CheckCircle2, AlertTriangle, ArrowUpDown, Eye, EyeOff, Printer, ShieldAlert } from 'lucide-react';

interface ReportA4PreviewProps {
  projectId: string;
}

export const ReportA4Preview: React.FC<ReportA4PreviewProps> = ({ projectId }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [template, setTemplate] = useState<any>(null);
  const [torItems, setTorItems] = useState<TorItem[]>([]);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, any[]>>({});
  const [itemsPerPage, setItemsPerPage] = useState<number>(2);
  const [isLoading, setIsLoading] = useState(true);

  // Validation modal state
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [validationData, setValidationData] = useState<any>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  const fetchPreviewData = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/report-preview`);
      const data = await res.json();
      setProject(data.project);
      setTemplate(data.template);
      setTorItems(data.torItems || []);
      setEvidenceMap(data.evidenceMap || {});
      if (data.template?.items_per_page) {
        setItemsPerPage(data.template.items_per_page);
      }
    } catch (err) {
      console.error('Failed to load report preview:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPreviewData();
  }, [projectId]);

  const handleValidateAndExport = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/validate-export`, { method: 'POST' });
      const data = await res.json();
      setValidationData(data);
      setShowValidationModal(true);
    } catch (err) {
      console.error('Export validation error:', err);
    }
  };

  const executePdfExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`/api/v1/projects/${projectId}/export-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          overrideReason: overrideReason || undefined,
          itemsPerPage
        })
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `TOR_Handover_Report_${project?.code || 'Doc'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setShowValidationModal(false);
    } catch (err: any) {
      alert(`การดาวน์โหลด PDF ล้มเหลว: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading || !project) {
    return (
      <div className="p-12 text-center text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        กำลังประมวลผลตัวอย่างเอกสาร A4...
      </div>
    );
  }

  // Format date
  const formatThaiDate = (dateStr?: string) => {
    if (!dateStr) return '..........................';
    const d = new Date(dateStr);
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear() + 543}`;
  };

  // Group evidence items into pages
  const pagedItems: TorItem[][] = [];
  for (let i = 0; i < torItems.length; i += itemsPerPage) {
    pagedItems.push(torItems.slice(i, i + itemsPerPage));
  }

  return (
    <div className="space-y-6">
      {/* Top Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 sticky top-16 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <LayoutGrid className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900">
              ตัวอย่างรายงานส่งมอบงาน A4 (WYSIWYG Preview)
            </h3>
            <p className="text-xs text-slate-500">
              ฟอนต์ TH Sarabun New มาตรฐานราชการ • รวมทั้งสิ้น {pagedItems.length + 3} หน้า
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Layout Selector (Requirement #33) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-700">
            <span className="font-medium">รูปแบบ:</span>
            <select
              value={itemsPerPage}
              onChange={(e) => setItemsPerPage(parseInt(e.target.value))}
              className="px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>1 รายการ / หน้า</option>
              <option value={2}>2 รายการ / หน้า (แนะนำ)</option>
              <option value={3}>3 รายการ / หน้า</option>
              <option value={4}>4 รายการ / หน้า</option>
            </select>
          </div>

          {/* Export PDF Button (Requirement #41) */}
          <button
            onClick={handleValidateAndExport}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-700 to-indigo-700 hover:from-blue-600 hover:to-indigo-600 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-700/20 active:scale-95 transition"
          >
            <Download className="w-4 h-4" />
            ส่งออกรายงาน PDF (A4)
          </button>
        </div>
      </div>

      {/* Realistic A4 Sheets Container */}
      <div className="overflow-x-auto pb-12 flex flex-col items-center">
        {/* Page 1: COVER PAGE */}
        <div className="a4-sheet font-sarabun text-slate-900">
          <div className="flex flex-col items-center justify-center min-h-[260mm] text-center p-6">
            <div className="text-4xl mb-6">🏛️</div>
            <h1 className="text-3xl font-extrabold text-slate-900 leading-tight mb-2">
              รายงานส่งมอบงานและหลักฐานภาพถ่ายตาม TOR
            </h1>
            <h2 className="text-xl font-bold text-blue-800 mb-8">
              {project.name}
            </h2>

            <div className="border-2 border-blue-800/80 rounded-xl p-6 w-[88%] mx-auto text-left bg-slate-50/70 text-base space-y-2 mb-8 shadow-sm">
              <div className="flex"><strong className="w-40 flex-shrink-0">รหัสโครงการ:</strong> <span>{project.code}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">สัญญาเลขที่:</strong> <span>{project.contract_number || '-'}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">เลขที่ TOR:</strong> <span>{project.tor_number || '-'}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">หน่วยงานเจ้าของโครงการ:</strong> <span>{project.government_agency || '-'}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">ผู้ว่าจ้าง:</strong> <span>{project.client || '-'}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">ผู้รับจ้างดำเนินงาน:</strong> <span>{project.contractor || '-'}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">สถานที่ดำเนินงาน:</strong> <span>{project.location || '-'}</span></div>
              <div className="flex"><strong className="w-40 flex-shrink-0">ระยะเวลาสัญญา:</strong> <span>{formatThaiDate(project.start_date)} ถึง {formatThaiDate(project.end_date)}</span></div>
            </div>

            <div className="text-sm text-slate-600">
              ผู้จัดการโครงการ: {project.project_manager || 'นายกิตติศักดิ์ พัฒนเสรี'}
            </div>
          </div>
        </div>

        {/* Page 2: SUBMISSION LETTER (หนังสือขอส่งมอบงาน) */}
        <div className="a4-sheet font-sarabun text-slate-900 text-[15pt] leading-relaxed">
          <div className="flex justify-between border-b border-blue-800 pb-1 text-xs text-slate-500 mb-4">
            <span>{template?.header_text || 'เอกสารประกอบการส่งมอบงานตาม TOR'}</span>
            <span>สัญญาเลขที่ {project.contract_number || '-'}</span>
          </div>

          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold">หนังสือขอส่งมอบงานตามสัญญา</h2>
            <p className="text-slate-600 text-sm">{project.contractor || 'บริษัทผู้รับจ้าง'}</p>
          </div>

          <div className="flex justify-between mb-2">
            <div>เลขที่หนังสือ: สอ.089/2567</div>
            <div>วันที่: {formatThaiDate(new Date().toISOString())}</div>
          </div>
          <div className="mb-1"><strong>เรื่อง:</strong> ขอส่งมอบงานและรายงานหลักฐานผลการดำเนินงานตามข้อกำหนด TOR งวดที่ 1</div>
          <div className="mb-1"><strong>เรียน:</strong> ประธานคณะกรรมการตรวจรับพัสดุ {project.government_agency || ''}</div>
          <div className="mb-1"><strong>อ้างถึง:</strong> สัญญาจ้างเลขที่ {project.contract_number || '-'}</div>
          <div className="mb-4"><strong>สิ่งที่ส่งมาด้วย:</strong> เอกสารรายงานหลักฐานภาพถ่ายการดำเนินงานตาม TOR จำนวน 1 ชุด</div>

          <p className="indent-12 mb-3 text-justify">
            ตามที่ {project.contractor || 'ผู้รับจ้าง'} ได้เข้าทำสัญญากับ {project.government_agency || 'หน่วยงาน'} ตามสัญญาเลขที่ {project.contract_number || '-'} เพื่อดำเนินการ {project.name} นั้น
          </p>
          <p className="indent-12 mb-8 text-justify">
            บัดนี้ ผู้รับจ้างได้ดำเนินงานตามขอบเขตข้อกำหนดของงาน (TOR) ครบถ้วนถูกต้องตามมาตรฐานสัญญาเรียบร้อยแล้ว จึงขอส่งมอบงานดังกล่าว พร้อมแนบเอกสารรายงานหลักฐานภาพถ่ายประกอบการพิจารณา เพื่อให้คณะกรรมการตรวจรับพัสดุได้โปรดดำเนินการตรวจรับงานต่อไป
          </p>

          <div className="mt-12 ml-[50%] text-center">
            <div>ขอแสดงความนับถือ</div>
            <div className="w-48 border-b border-dotted border-slate-500 mx-auto mt-12 mb-2" />
            <div>({project.project_manager || 'นายกิตติศักดิ์ พัฒนเสรี'})</div>
            <div className="text-sm text-slate-600">ผู้จัดการโครงการ / ผู้มีอำนาจลงนาม</div>
          </div>

          <div className="absolute bottom-4 left-6 right-6 flex justify-between border-t border-slate-200 pt-1 text-xs text-slate-500">
            <span>{project.code}</span>
            <span>หน้าที่ 2</span>
          </div>
        </div>

        {/* Evidence Pages (2 Items / Page default) */}
        {pagedItems.map((pageGroup, pageIdx) => (
          <div key={`page-${pageIdx}`} className="a4-sheet font-sarabun text-slate-900 text-sm">
            <div className="flex justify-between border-b border-blue-800 pb-1 text-xs text-slate-500 mb-3">
              <span>{project.code} - รายงานผลการดำเนินงานและหลักฐานภาพ</span>
              <span>{template?.header_text || ''}</span>
            </div>

            <h3 className="text-lg font-bold text-blue-900 mb-3">
              ส่วนที่ 5: รายงานผลการดำเนินงานและหลักฐานภาพ (หน้า {pageIdx + 1})
            </h3>

            <div className="space-y-4">
              {pageGroup.map((item) => {
                const files = evidenceMap[item.id] || [];
                const displaySlots = [0, 1, 2, 3];

                return (
                  <div key={item.id} className="border border-slate-300 rounded-lg p-3 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 mb-2">
                      <span className="font-bold text-blue-800 text-base">
                        หัวข้อ {item.item_number} : {item.title}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded font-bold bg-emerald-100 text-emerald-800">
                        {files.length >= (item.minimum_images || 4) ? '🟢 ครบถ้วน' : '🟡 กำลังดำเนินการ'} ({files.length}/{item.minimum_images || 4} ภาพ)
                      </span>
                    </div>

                    <div className="text-xs text-slate-700 bg-slate-50 p-2 rounded mb-2 border border-slate-200/80">
                      <strong>ข้อกำหนด TOR:</strong> {item.requirement}
                      {item.dimensions && <span className="ml-2">| <strong>ขนาด:</strong> {item.dimensions}</span>}
                    </div>

                    {/* 4 Photos Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {displaySlots.map((slotIdx) => {
                        const file = files[slotIdx];
                        return (
                          <div
                            key={slotIdx}
                            className="border border-slate-200 rounded overflow-hidden bg-slate-50 flex flex-col"
                          >
                            {file ? (
                              <img
                                src={`/storage/${file.preview_path || file.original_path}`}
                                alt={`Evidence ${slotIdx + 1}`}
                                className="w-full h-32 object-cover"
                              />
                            ) : (
                              <div className="w-full h-32 flex items-center justify-center text-slate-400 text-xs bg-slate-100">
                                [ รอภาพหลักฐานที่ {slotIdx + 1} ]
                              </div>
                            )}
                            <div className="p-1 bg-slate-100 border-t border-slate-200 text-[11px] text-slate-600 truncate">
                              ภาพที่ {slotIdx + 1}: {file ? file.caption || file.capture_type : '(ยังไม่แนบ)'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="absolute bottom-4 left-6 right-6 flex justify-between border-t border-slate-200 pt-1 text-xs text-slate-500">
              <span>{project.name}</span>
              <span>หน้าที่ {pageIdx + 3}</span>
            </div>
          </div>
        ))}

        {/* Last Page: SIGNATURES PAGE */}
        <div className="a4-sheet font-sarabun text-slate-900 text-base">
          <div className="flex justify-between border-b border-blue-800 pb-1 text-xs text-slate-500 mb-4">
            <span>{template?.header_text || 'เอกสารประกอบการส่งมอบงาน'}</span>
            <span>{project.code}</span>
          </div>

          <div className="text-center my-8">
            <h2 className="text-2xl font-bold text-blue-950 mb-1">
              การรับรองผลการดำเนินงานและลายมือชื่อ
            </h2>
            <p className="text-slate-600 text-sm">
              ขอรับรองว่าหลักฐานภาพถ่ายและผลงานทั้งหมดถูกต้องตรงตามสัญญาจ้างทุกประการ
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 mt-12 text-center text-sm">
            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
              <strong className="block text-slate-900 mb-12">ผู้จัดทำรายงาน / เจ้าหน้าที่ภาคสนาม</strong>
              <div className="w-48 border-b border-dotted border-slate-500 mx-auto mb-2" />
              <div>(............................................................)</div>
              <div className="text-xs text-slate-500 mt-1">วันที่ ........../........../..........</div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50">
              <strong className="block text-slate-900 mb-12">ผู้จัดการโครงการ (Project Manager)</strong>
              <div className="w-48 border-b border-dotted border-slate-500 mx-auto mb-2" />
              <div>({project.project_manager || 'นายกิตติศักดิ์ พัฒนเสรี'})</div>
              <div className="text-xs text-slate-500 mt-1">วันที่ ........../........../..........</div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 mt-4">
              <strong className="block text-slate-900 mb-12">ผู้ตรวจสอบงาน (Inspector)</strong>
              <div className="w-48 border-b border-dotted border-slate-500 mx-auto mb-2" />
              <div>(............................................................)</div>
              <div className="text-xs text-slate-500 mt-1">วันที่ ........../........../..........</div>
            </div>

            <div className="p-4 border border-slate-200 rounded-xl bg-slate-50/50 mt-4">
              <strong className="block text-slate-900 mb-12">ประธานคณะกรรมการตรวจรับพัสดุ</strong>
              <div className="w-48 border-b border-dotted border-slate-500 mx-auto mb-2" />
              <div>(............................................................)</div>
              <div className="text-xs text-slate-500 mt-1">วันที่ ........../........../..........</div>
            </div>
          </div>

          <div className="absolute bottom-4 left-6 right-6 flex justify-between border-t border-slate-200 pt-1 text-xs text-slate-500">
            <span>{project.code}</span>
            <span>หน้าสุดท้าย</span>
          </div>
        </div>
      </div>

      {/* Export Validation Modal (Requirement #42) */}
      {showValidationModal && validationData && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                ตรวจสอบความสมบูรณ์ก่อนส่งออก (Export Validation)
              </h3>
              <button onClick={() => setShowValidationModal(false)} className="text-slate-400 hover:text-slate-600">
                ✕
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-xl border border-slate-200 text-center">
              <div>
                <p className="text-[11px] text-slate-500">รายการทั้งหมด</p>
                <p className="text-xl font-bold text-slate-900">{validationData.total}</p>
              </div>
              <div>
                <p className="text-[11px] text-emerald-600">ครบถ้วน</p>
                <p className="text-xl font-bold text-emerald-600">{validationData.complete}</p>
              </div>
              <div>
                <p className="text-[11px] text-rose-600">ยังไม่ครบ</p>
                <p className="text-xl font-bold text-rose-600">{validationData.missing}</p>
              </div>
            </div>

            {validationData.status === 'LOCKED' ? (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-start gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong>นโยบาย Hard Lock:</strong>
                  <p className="mt-0.5">{validationData.message}</p>
                </div>
              </div>
            ) : validationData.status === 'WARNING' ? (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong>แจ้งเตือน:</strong>
                    <p className="mt-0.5">{validationData.message}</p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    เหตุผลความจำเป็นในการส่งออกล่วงหน้า (Override Reason):
                  </label>
                  <input
                    type="text"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="เช่น ส่งรายงานความคืบหน้างวดที่ 1 เพื่อประกอบการประชุม"
                    className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <span>หลักฐานภาพถ่ายครบถ้วน 100% พร้อมจัดทำเอกสารส่งมอบงานราชการ</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 text-xs font-semibold"
              >
                ย้อนกลับ
              </button>
              {validationData.canExport && (
                <button
                  onClick={executePdfExport}
                  disabled={isExporting}
                  className="px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-blue-700/20"
                >
                  <Download className="w-4 h-4" />
                  {isExporting ? 'กำลังสร้างไฟล์ PDF (A4)...' : 'ยืนยันและดาวน์โหลด PDF'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
