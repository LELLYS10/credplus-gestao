import React from 'react';
import { User, UserRole, UserGroupType, getUserPermissions } from '../types';
import { LogOut, Home, Users, CheckSquare, Settings, Menu, X, Briefcase, ShieldCheck, Moon, Sun } from 'lucide-react';
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

function useTheme() {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('cp-theme') as 'light' | 'dark') ?? 'light';
  });
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cp-theme', theme);
  }, [theme]);
  const toggle = () => setTheme(t => t === 'light' ? 'dark' : 'light');
  return { theme, toggle };
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, activeTab, setActiveTab, pendingCount, pendingApprovalsCount = 0 }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const { theme, toggle: toggleTheme } = useTheme();

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

  const roleLabel = user.role === UserRole.ADMIN ? 'Administrador' :
    user.groupType === 'GRUPO_A' ? 'Grupo A' :
    user.groupType === 'GRUPO_B' ? 'Grupo B' :
    user.groupType === 'GRUPO_ESPECIAL' ? 'Grupo Especial' : 'Sócio Ativo';

  const SidebarContent = () => (
    <div className="sidebar-gradient sidebar-sheen relative flex flex-col h-full text-white p-4">
      {/* Logo + Nome */}
      <div className="flex items-center gap-3 px-2 py-5 mb-6">
        <Logo size="md" />
        <div className="flex flex-col">
          <span className="font-black text-[18px] tracking-tighter leading-none">CREDPLUS</span>
          <span className="text-[8px] font-black text-emerald-400 uppercase tracking-[0.2em] mt-1.5 leading-none">Gestão Financeira</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-1">
        {menuItems.map(item => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => { setActiveTab(item.id); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between p-3 rounded-2xl transition-all duration-200 ${
                active
                  ? 'bg-emerald-600 text-white shadow-lg border-b-2 border-emerald-800'
                  : 'text-emerald-100/60 hover:bg-emerald-800/50 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon size={20} className={active ? 'text-amber-400' : ''} />
                <span className="font-bold text-sm">{item.label}</span>
                {item.id === 'third-party' && user.thirdPartyBlocked && (
                  <span className="ml-1 px-1.5 py-0.5 bg-red-500/20 text-red-300 text-[8px] font-black uppercase rounded border border-red-500/30">
                    Bloqueado
                  </span>
                )}
              </div>
              {item.badge > 0 && (
                <span className={`text-white text-[10px] font-black px-2 py-0.5 rounded-full ${
                  item.id === 'pending-approvals' ? 'bg-red-500' : 'bg-amber-500'
                }`}>{item.badge}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer usuário */}
      <div className="pt-5 border-t border-emerald-800/60 mt-4">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-emerald-800 border border-amber-400/30 flex items-center justify-center text-xs font-black text-amber-400 flex-shrink-0">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] text-emerald-400 uppercase font-black tracking-widest leading-none mb-1">{roleLabel}</p>
            <p className="text-xs font-bold truncate text-emerald-100/80">{user.email}</p>
          </div>
        </div>
        <div className="flex gap-2 mb-1">
          <button
            onClick={toggleTheme}
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-2xl text-emerald-100/50 hover:bg-emerald-800/50 hover:text-emerald-200 transition-all font-bold text-xs"
            title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
          </button>
          <button
            onClick={onLogout}
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-2xl text-emerald-100/40 hover:bg-red-900/30 hover:text-red-300 transition-all font-bold text-xs"
          >
            <LogOut size={16} />
            <span>Sair</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Sidebar desktop */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="fixed inset-y-0 w-64"><SidebarContent /></div>
      </aside>

      {/* Header mobile */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between shadow-lg sidebar-gradient">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-black tracking-tighter text-sm text-white">CREDPLUS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1 text-white">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Menu mobile overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full" onClick={e => e.stopPropagation()}><SidebarContent /></div>
        </div>
      )}

      {/* Conteúdo principal */}
      <main className="flex-1 px-4 pt-20 pb-10 lg:pt-8 lg:px-10 max-w-[1440px] mx-auto w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
