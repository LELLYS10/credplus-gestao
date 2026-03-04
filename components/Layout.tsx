
import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, Home, Users, CheckSquare, Settings, Menu, X, Briefcase, ShieldCheck } from 'lucide-react';
import Logo from './Logo';

interface LayoutProps {
  user: User | null;
  onLogout: () => void;
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  pendingCount: number;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children, activeTab, setActiveTab, pendingCount }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  if (!user) return <div className="p-10 text-center">Carregando sessão...</div>;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, roles: [UserRole.ADMIN, UserRole.VIEWER] },
    { id: 'clients', label: 'Clientes', icon: Users, roles: [UserRole.ADMIN, UserRole.VIEWER] },
    { id: 'requests', label: 'Solicitações', icon: CheckSquare, roles: [UserRole.ADMIN, UserRole.VIEWER], badge: pendingCount },
    { id: 'third-party', label: 'Terceiros', icon: Briefcase, roles: [UserRole.VIEWER] },
    { id: 'admin', label: 'Administração', icon: Settings, roles: [UserRole.ADMIN] },
  ].filter(item => item.roles.includes(user.role));

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
            onClick={() => {
              setActiveTab(item.id);
              setIsMobileMenuOpen(false);
            }}
            className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
              activeTab === item.id 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-800/40 border-b-2 border-emerald-700' 
                : 'text-emerald-100/60 hover:bg-emerald-800/50 hover:text-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <item.icon size={20} className={activeTab === item.id ? 'text-amber-400' : ''} />
              <span className="font-semibold">{item.label}</span>
            </div>
            {item.badge && item.badge > 0 && (
              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-md animate-pulse">
                {item.badge}
              </span>
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
              {user.role === UserRole.ADMIN ? 'Administrador' : 'Sócio Ativo'}
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
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0">
        <div className="fixed inset-y-0 w-64">
          <SidebarContent />
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 bg-emerald-900 text-white z-40 px-4 py-3 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Logo size="sm" />
          <span className="font-black tracking-tighter text-sm">CREDPLUS - GESTÃO FINANCEIRA</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-1">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)}>
          <div className="w-64 h-full" onClick={e => e.stopPropagation()}>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:ml-0 px-4 pt-20 pb-10 lg:pt-8 lg:px-10 max-w-[1440px] mx-auto w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
};

export default Layout;
