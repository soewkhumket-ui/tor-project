import React, { useState, useEffect } from 'react';
import { History, User, Clock, ShieldCheck, ChevronDown, ChevronRight } from 'lucide-react';

interface AuditLog {
  id: string;
  project_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_state?: string;
  after_state?: string;
  created_at: string;
}

export const AuditTrailTab: React.FC<{ projectId: string }> = ({ projectId }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/projects/${projectId}/audit`)
      .then(res => res.json())
      .then(data => setLogs(data.logs || []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, [projectId]);

  const actionLabels: Record<string, { label: string; color: string }> = {
    PROJECT_CREATED: { label: 'สร้างโครงการใหม่', color: 'bg-emerald-100 text-emerald-800' },
    PROJECT_UPDATED: { label: 'แก้ไขข้อมูลโครงการ', color: 'bg-blue-100 text-blue-800' },
    TOR_STRUCTURE_APPROVED: { label: 'อนุมัติโครงสร้าง TOR', color: 'bg-purple-100 text-purple-800' },
    EVIDENCE_FILE_UPLOADED: { label: 'อัปโหลดภาพหลักฐาน', color: 'bg-sky-100 text-sky-800' },
    EVIDENCE_SUBMITTED_FOR_REVIEW: { label: 'ส่งหลักฐานให้ตรวจ', color: 'bg-indigo-100 text-indigo-800' },
    EVIDENCE_APPROVED: { label: 'อนุมัติหลักฐานภาพ', color: 'bg-emerald-100 text-emerald-800' },
    EVIDENCE_REJECTED: { label: 'ส่งกลับให้แก้ไขหลักฐาน', color: 'bg-rose-100 text-rose-800' },
    EXTRA_EVIDENCE_ADDED: { label: 'เพิ่มหลักฐานเพิ่มเติม', color: 'bg-amber-100 text-amber-800' },
    REPORT_PDF_EXPORTED: { label: 'ส่งออกรายงาน PDF', color: 'bg-blue-100 text-blue-800' }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-sm space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
        <History className="w-5 h-5 text-slate-600" />
        <h3 className="font-bold text-base text-slate-900">
          ประวัติการดำเนินงานและบันทึกความปลอดภัย (Audit Log & Version History)
        </h3>
      </div>
      <p className="text-xs text-slate-500">
        บันทึกทุกการแก้ไขและการดำเนินการของผู้ใช้ทุกคนในโครงการ เพื่อความโปร่งใสและตรวจสอบย้อนหลังได้ (Requirement #28, #29)
      </p>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-xs">ยังไม่มีบันทึกกิจกรรม</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {logs.map((log) => {
            const actionInfo = actionLabels[log.action] || {
              label: log.action,
              color: 'bg-slate-100 text-slate-700'
            };
            const isExpanded = expandedLogId === log.id;

            return (
              <div key={log.id} className="py-3">
                <div
                  className="flex items-center justify-between cursor-pointer hover:bg-slate-50 p-2 rounded-lg transition"
                  onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 text-sm">{log.user_name || 'ผู้ใช้'}</span>
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${actionInfo.color}`}>
                          {actionInfo.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {new Date(log.created_at).toLocaleString('th-TH')} • Entity: {log.entity_type} ({log.entity_id.substring(0, 12)}...)
                      </p>
                    </div>
                  </div>

                  <div className="text-slate-400">
                    {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </div>

                {isExpanded && (log.before_state || log.after_state) && (
                  <div className="mt-2 ml-11 p-3 bg-slate-50 rounded-lg text-xs font-mono text-slate-700 border border-slate-200 overflow-x-auto space-y-2">
                    {log.before_state && (
                      <div>
                        <strong className="text-rose-600">สถานะก่อนหน้า (Before):</strong>
                        <pre className="mt-0.5">{JSON.stringify(JSON.parse(log.before_state), null, 2)}</pre>
                      </div>
                    )}
                    {log.after_state && (
                      <div>
                        <strong className="text-emerald-600">สถานะหลังการแก้ไข (After):</strong>
                        <pre className="mt-0.5">{JSON.stringify(JSON.parse(log.after_state), null, 2)}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
