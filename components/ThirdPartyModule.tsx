
import React, { useState } from 'react';
import { User, ThirdPartyClient, ThirdPartyLoan, ThirdPartyPayment } from '../types';
import { Briefcase, Plus, Users, LayoutDashboard, FileText, ChevronRight, Search, Phone, Calendar, DollarSign, Percent, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils';

interface ThirdPartyModuleProps {
  user: User;
  db: any;
  setDb: (db: any) => void;
}

const ThirdPartyModule: React.FC<ThirdPartyModuleProps> = ({ user, db, setDb }) => {
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'clients' | 'loans' | 'payments'>('dashboard');
  
  // Filter data by current user
  const myClients = (db.thirdPartyClients || []).filter((c: ThirdPartyClient) => c.userId === user.id);
  const myLoans = (db.thirdPartyLoans || []).filter((l: ThirdPartyLoan) => l.userId === user.id);
  const myPayments = (db.thirdPartyPayments || []).filter((p: ThirdPartyPayment) => p.userId === user.id);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-blue-800">
          <div className="p-2 bg-blue-100 text-blue-700 rounded-xl"><Briefcase size={32} /></div>
          EMPRÉSTIMOS DE TERCEIROS
        </h2>
        <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-2xl border border-blue-100">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Módulo Privado: {user.email}</span>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-wrap bg-blue-50/50 p-1.5 rounded-2xl border border-blue-100 self-start w-fit">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'clients', label: 'Meus Clientes', icon: Users },
          { id: 'loans', label: 'Empréstimos', icon: FileText },
          { id: 'payments', label: 'Extrato', icon: DollarSign },
        ].map((tab: any) => (
          <button 
            key={tab.id} 
            onClick={() => setActiveSubTab(tab.id)} 
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'text-blue-400 hover:text-blue-600'}`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2.5rem] border-2 border-blue-50 p-8 min-h-[400px] shadow-sm relative overflow-hidden">
        {/* Background Decoration */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-blue-50 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
        
        {activeSubTab === 'dashboard' && (
          <div className="space-y-8 relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-600 p-8 rounded-[2rem] text-white shadow-xl shadow-blue-100 border-b-8 border-blue-800">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80 mb-2">Capital em Aberto</p>
                <h3 className="text-3xl font-black tracking-tighter">
                  {formatCurrency(myLoans.reduce((acc: number, l: any) => acc + (l.status === 'ativo' ? l.valorPrincipal : 0), 0))}
                </h3>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border-2 border-blue-100 shadow-sm">
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Vencem Hoje</p>
                <h3 className="text-3xl font-black tracking-tighter text-blue-800">0</h3>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border-2 border-red-100 shadow-sm">
                <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">Vencidos</p>
                <h3 className="text-3xl font-black tracking-tighter text-red-600">0</h3>
              </div>
            </div>

            <div className="p-10 text-center border-2 border-dashed border-blue-100 rounded-[2.5rem] bg-blue-50/30">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus size={32} />
              </div>
              <h4 className="text-xl font-black text-blue-800 uppercase mb-2">Inicie sua Gestão Privada</h4>
              <p className="text-blue-500 font-medium text-sm max-w-xs mx-auto mb-6">Cadastre seus clientes e empréstimos particulares que não aparecem para ninguém.</p>
              <button 
                onClick={() => setActiveSubTab('clients')}
                className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
              >
                Começar Agora
              </button>
            </div>
          </div>
        )}

        {activeSubTab === 'clients' && (
          <div className="text-center py-20">
            <Users size={48} className="mx-auto text-blue-200 mb-4" />
            <p className="text-blue-400 font-black uppercase tracking-widest text-xs">Área de Clientes em Desenvolvimento</p>
          </div>
        )}

        {activeSubTab === 'loans' && (
          <div className="text-center py-20">
            <FileText size={48} className="mx-auto text-blue-200 mb-4" />
            <p className="text-blue-400 font-black uppercase tracking-widest text-xs">Área de Empréstimos em Desenvolvimento</p>
          </div>
        )}

        {activeSubTab === 'payments' && (
          <div className="text-center py-20">
            <DollarSign size={48} className="mx-auto text-blue-200 mb-4" />
            <p className="text-blue-400 font-black uppercase tracking-widest text-xs">Área de Extrato em Desenvolvimento</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ThirdPartyModule;
