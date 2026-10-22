import React, { useState, useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { OfflineSyncProvider } from './context/OfflineSyncContext';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectDetailsPage } from './pages/ProjectDetailsPage';

export function App() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [activeProjectName, setActiveProjectName] = useState<string | undefined>(undefined);

  // Check URL pathname for direct QR capture or project link (e.g. /projects/:id or ?project=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const prjParam = params.get('project');
    if (prjParam) {
      setSelectedProjectId(prjParam);
    }
  }, []);

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    window.history.pushState({}, '', `?project=${id}`);
  };

  const handleBackToProjects = () => {
    setSelectedProjectId(null);
    setActiveProjectName(undefined);
    window.history.pushState({}, '', window.location.pathname);
  };

  return (
    <AuthProvider>
      <OfflineSyncProvider>
        <div className="min-h-screen bg-slate-50 flex flex-col font-sarabun">
          <Navbar
            onGoHome={handleBackToProjects}
            activeProjectName={activeProjectName}
          />

          <main className="flex-1">
            {selectedProjectId ? (
              <ProjectDetailsPage
                projectId={selectedProjectId}
                onBack={handleBackToProjects}
              />
            ) : (
              <DashboardPage onSelectProject={handleSelectProject} />
            )}
          </main>

          <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print">
            <p>
              TOR Evidence & Handover Report System (ระบบบริหารหลักฐานและสร้างเอกสารส่งมอบงานตาม TOR)
            </p>
            <p className="mt-1 text-slate-400">
              รองรับ Responsive Mobile PWA • ระบบจัดเก็บภาพ 3 ระดับ • ฟอนต์ TH Sarabun New มาตรฐานราชการ
            </p>
          </footer>
        </div>
      </OfflineSyncProvider>
    </AuthProvider>
  );
}

export default App;
