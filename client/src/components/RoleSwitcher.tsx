import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Shield, ChevronDown, Check } from 'lucide-react';

const roleLabels: Record<UserRole, { title: string; desc: string; badge: string; color: string }> = {
  admin: {
    title: 'Admin (ผู้ดูแลระบบ)',
    desc: 'สิทธิ์สูงสุด จัดการโครงการ อนุมัติ ส่งออก ดู Audit Log',
    badge: 'Admin',
    color: 'bg-purple-100 text-purple-800 border-purple-300'
  },
  project_manager: {
    title: 'Project Manager (ผู้จัดการโครงการ)',
    desc: 'จัดการ TOR ตรวจและ Approve/Reject หลักฐาน ออกรายงาน',
    badge: 'PM',
    color: 'bg-blue-100 text-blue-800 border-blue-300'
  },
  staff: {
    title: 'Staff (ทีมหน้างาน)',
    desc: 'เปิด Checklist ถ่ายภาพ อัปโหลดหลักฐาน ใส่ Annotation',
    badge: 'Staff',
    color: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  inspector: {
    title: 'Viewer / Inspector (กรรมการตรวจรับ)',
    desc: 'ดูข้อมูล TOR ตรวจดูหลักฐาน ดูตัวอย่างรายงาน (Read-only)',
    badge: 'Inspector',
    color: 'bg-amber-100 text-amber-800 border-amber-300'
  }
};

export const RoleSwitcher: React.FC = () => {
  const { currentUser, users, switchUser } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (!currentUser) return null;

  const currentRoleInfo = roleLabels[currentUser.role] || roleLabels.staff;

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition shadow-sm text-sm"
      >
        <Shield className="w-4 h-4 text-gov-600" />
        <span className={`px-2 py-0.5 rounded text-xs font-semibold border ${currentRoleInfo.color}`}>
          {currentRoleInfo.badge}
        </span>
        <span className="font-medium text-slate-800 hidden sm:inline">{currentUser.name.split(' ')[0]}</span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
      </button>

      {isOpen && (
        <div
          className="origin-top-right absolute right-0 mt-2 w-80 rounded-xl shadow-xl bg-white ring-1 ring-black ring-opacity-5 divide-y divide-slate-100 z-50 animate-in fade-in zoom-in-95 duration-100"
          onMouseLeave={() => setIsOpen(false)}
        >
          <div className="p-3 bg-slate-50 rounded-t-xl">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              สลับบทบาทผู้ใช้งาน (Role Switcher)
            </p>
            <p className="text-xs text-slate-600 mt-0.5">
              ทดสอบระบบตาม User Roles ต่าง ๆ ได้ทันที
            </p>
          </div>
          <div className="py-1">
            {users.map((u) => {
              const info = roleLabels[u.role] || roleLabels.staff;
              const isSelected = u.id === currentUser.id;
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    switchUser(u.id);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 flex items-start gap-3 hover:bg-slate-50 transition ${
                    isSelected ? 'bg-gov-50/60' : ''
                  }`}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">{u.name}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[11px] font-bold border ${info.color}`}>
                        {info.badge}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{info.desc}</p>
                  </div>
                  {isSelected && <Check className="w-4 h-4 text-gov-600 flex-shrink-0 mt-1" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
