import React, { useState, useEffect } from 'react';
import { Project, ProjectStats } from '../types';
import { ArrowLeft, CheckCircle2, Clock, AlertCircle, FileText, CheckSquare, Printer, History, Building2, Calendar, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { EvidenceChecklist } from '../components/EvidenceChecklist';
import { TORStructureEditor } from '../components/TORStructureEditor';
import { ReportA4Preview } from '../components/ReportA4Preview';
import { AuditTrailTab } from '../components/AuditTrailTab';

interface ProjectDetailsPageProps {
  projectId: string;
  onBack: () => void;
}

export const ProjectDetailsPage: React.FC<ProjectDetailsPageProps> = ({ projectId, onBack }) => {
  const [project, setProject] = useState<Project | null>(null);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [activeTab, setActiveTab] = useState<'checklist' | 'structure' | 'report' | 'audit'>('checklist');
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`/api/v1/projects/${projectId}`);
      const data = await res.json();
      setProject(data.project);
      setStats(data.stats);
    } catch (err) {
      console.error('Failed to load project details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [projectId]);

  if (isLoading || !project) {
    return (
      <div className="p-16 text-center text-slate-500">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        กำลังโหลดข้อมูลโครงการ...
      </div>
    );
  }

  const progress = stats?.progress_percent || 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Back button & Project Header */}
      <div>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 mb-3 transition"
        >
          <ArrowLeft className="w-4 h-4" /> ย้อนกลับไปหน้ารวมโครงการ
        </button>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-xs font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                  {project.code}
                </span>
                <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full">
                  สัญญา: {project.contract_number || '-'}
                </span>
                <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                  นโยบาย: {project.export_policy === 'hard_lock' ? '🔒 Hard Lock' : '⚠️ Warning Lock'}
                </span>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 leading-snug">
                {project.name}
              </h1>

              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mt-2 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                  {project.government_agency || project.client || 'หน่วยงานภาครัฐ'}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {project.start_date || '-'} ถึง {project.end_date || '-'}
                </span>
                {project.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {project.location}
                  </span>
                )}
              </div>
            </div>

            {/* Quick Completion Gauge */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center gap-4 lg:min-w-[260px]">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <svg className="w-14 h-14 transform -rotate-90">
                  <circle cx="28" cy="28" r="22" stroke="#e2e8f0" strokeWidth="5" fill="none" />
                  <circle
                    cx="28"
                    cy="28"
                    r="22"
                    stroke="#10b981"
                    strokeWidth="5"
                    fill="none"
                    strokeDasharray={138.2}
                    strokeDashoffset={138.2 - (138.2 * progress) / 100}
                    className="transition-all duration-700"
                  />
                </svg>
                <span className="absolute text-xs font-extrabold text-slate-800">{progress}%</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">ความคืบหน้าหลักฐาน</p>
                <p className="text-sm font-bold text-slate-900">
                  {stats?.complete || 0} / {stats?.total || 0} รายการ
                </p>
                <p className="text-[11px] text-slate-400">
                  ภาพทั้งหมด: {stats?.total_images || 0} ภาพ
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 mt-6 -mb-6 gap-2 sm:gap-6 overflow-x-auto text-sm">
            <button
              onClick={() => setActiveTab('checklist')}
              className={`pb-3.5 font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'checklist'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <CheckSquare className="w-4 h-4" />
              Checklist ตรวจรับหลักฐาน
            </button>

            <button
              onClick={() => setActiveTab('structure')}
              className={`pb-3.5 font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'structure'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              โครงสร้าง TOR (Human Review)
            </button>

            <button
              onClick={() => setActiveTab('report')}
              className={`pb-3.5 font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'report'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              ตัวอย่างและส่งออกรายงาน A4 (PDF)
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`pb-3.5 font-bold flex items-center gap-2 border-b-2 whitespace-nowrap transition ${
                activeTab === 'audit'
                  ? 'border-blue-600 text-blue-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <History className="w-4 h-4" />
              ประวัติการแก้ไข (Audit Trail)
            </button>
          </div>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="mt-4">
        {activeTab === 'checklist' && (
          <EvidenceChecklist projectId={projectId} onRefreshStats={fetchProjectData} />
        )}

        {activeTab === 'structure' && (
          <TORStructureEditor
            projectId={projectId}
            onStructureApproved={() => {
              fetchProjectData();
              setActiveTab('checklist');
            }}
          />
        )}

        {activeTab === 'report' && (
          <ReportA4Preview projectId={projectId} />
        )}

        {activeTab === 'audit' && (
          <AuditTrailTab projectId={projectId} />
        )}
      </div>
    </div>
  );
};
