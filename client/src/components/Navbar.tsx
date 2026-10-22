import React from 'react';
import { RoleSwitcher } from './RoleSwitcher';
import { useOfflineSync } from '../context/OfflineSyncContext';
import { FileText, CheckCircle2, RefreshCw, WifiOff } from 'lucide-react';

interface NavbarProps {
  onGoHome?: () => void;
  activeProjectName?: string;
}

export const Navbar: React.FC<NavbarProps> = ({ onGoHome, activeProjectName }) => {
  const { syncStatus, isOnline, pendingCount } = useOfflineSync();

  return (
    <header className="bg-navy-900 text-white sticky top-0 z-40 shadow-md border-b border-slate-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand / Logo */}
        <div className="flex items-center gap-3 cursor-pointer" onClick={onGoHome}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent">
                TOR Evidence & Handover
              </span>
              <span className="bg-blue-600/30 text-blue-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-blue-500/30 uppercase tracking-wider">
                Gov Edition
              </span>
            </div>
            {activeProjectName ? (
              <p className="text-xs text-slate-300 truncate max-w-xs sm:max-w-md">
                📁 {activeProjectName}
              </p>
            ) : (
              <p className="text-xs text-slate-400">ระบบบริหารหลักฐานและสร้างเอกสารส่งมอบงานตาม TOR</p>
            )}
          </div>
        </div>

        {/* Right Section: Sync Status & Role Switcher */}
        <div className="flex items-center gap-3">
          {/* Offline / Autosave Indicator */}
          <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs">
            {syncStatus === 'saving' && (
              <>
                <RefreshCw className="w-3.5 h-3.5 text-blue-400 animate-spin" />
                <span className="text-blue-300 font-medium">กำลังบันทึก...</span>
              </>
            )}
            {syncStatus === 'saved' && (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300 font-medium">บันทึกอัตโนมัติแล้ว</span>
              </>
            )}
            {syncStatus === 'offline_pending' && (
              <>
                <WifiOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-300 font-medium">
                  ออฟไลน์ ({pendingCount} รายการรอ Sync)
                </span>
              </>
            )}
          </div>

          {/* User Role Switcher */}
          <RoleSwitcher />
        </div>
      </div>
    </header>
  );
};
