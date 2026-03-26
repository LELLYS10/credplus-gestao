import React from 'react';
import { User, UserRole, UserGroupType, getUserPermissions } from '../types';
import { LogOut, Home, Users, CheckSquare, Settings, Menu, X, Briefcase, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
  pendingApprovalsCount?: number;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, activeTab, setActiveTab, pendingCount, pendingApprovalsCount = 0 }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  if (!user) return <div className="p-10 text-center">Carregando sessão...</div>;

  const perms = getUserPermissions(user);

  const menuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: Home, show: true, badge: 0 },
    { id: 'clients', label: 'Clientes', icon: Users, show: true, badge: 0 },
    { id: 'requests', label: 'Solicitações', icon: CheckSquare, show: true, badge: pendingCount },
    { id: 'pending-approvals', label: 'Aprovar Cadastros', icon: ShieldCheck, show: perms.isAdmin, badge: pendingApprovalsCount },
    { id: 'third-party', label: 'Terceiros', icon: Briefcase, show: user.role === UserRole.VIEWER && (!user.groupType || user.groupType === UserGroupType.GRUPO_A) && !user.thirdPartyBlocked, badge: 0 },
    { id: 'admin', label: 'Administração', icon: Settings, show: perms.isAdmin, badge: 0 },
  ].filter(item => item.show);

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-emerald-900 text-white p-4">
      <div className="mb-10 flex items-center gap-3 px-2 py-4">
        <Logo size="md" />
        <div className="flex flex-col">
          <span className="font-black text-lg tracking-tighter block leading-none">CREDPLUS</span>
          <span className="text-[7px] font-black text-emerald-400 uppercase tracking-[0.2em] mt-1.5 leading-none">Gestão Financeira</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
              activeTab === item.id
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-800/40 border-b-2 border-emerald-700'
                : 'text-emerald-100/60 hover:bg-emerald-800/50 hover:text-white'
            } `}
          >
            <div className="flex items-center gap-3">
              <item.icon size={20} className={activeTab === item.id ? 'text-amber-400' : ''} />
              <span className="font-semibold">{item.label}</span>
              {item.id === 'third-party' && user.thirdPartyBlocked && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[8px] font-black uppercase rounded border border-red-500/30">
                  Bloqueado
                </span>
              )}
            </div>
            {item.badge > 0 && (
              <span className={`text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse ${
                item.id === 'pending-approvals' ? 'bg-red-500' : 'bg-amber-500'
              }`}>{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      <div className="pt-6 border-t border-emerald-900 mt-auto">
        <div className="px-3 mb-4 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-emerald-800 flex items-center justify-center text-xs font-bold text-amber-400">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] text-emerald-500 uppercase font-black tracking-widest">
              {user.role === UserRole.ADMIN ? 'Administrador' : (
                user.groupType === 'GRUPO_A' ? 'Grupo A' :
                user.groupType === 'GRUPO_B' ? 'Grupo B' :
                user.groupType === 'GRUPO_ESPECIAL' ? 'Grupo Especial' : 'Sócio Ativo'
              )}
            </p>
            <p className="text-xs font-bold truncate text-emerald-100">{user.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 p-3 rounded-xl text-emerald-100/40 hover:bg-red-900/40 hover:text-red-300 transition-all font-bold text-sm"
        >
          <LogOut size={18} />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="fixed inset-y-0 w-64"><SidebarContent /></div>
      </aside>
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-emerald-900 text-white z-40 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-black tracking-tighter text-sm">CREDPLUS - GESTÃO FINANCEIRA</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full" onClick={e => e.stopPropagation()}><SidebarContent /></div>
        </div>
      )}
      <main className="flex-1 lg:ml-0 px-4 pt-20 pb-10 lg:pt-8 lg:px-10 max-w-[1440px] mx-auto w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
