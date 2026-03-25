import React, { useState } from 'react';
import { Client, Group, Competence, User } from '../types';
import { LayoutGrid, Star, Users, UsersRound, Check, Edit2 } from 'lucide-react';

interface X4DashboardProps {
  user: User;
  clients: Client[];
  groups: Group[];
  competences: Competence[];
}

const clrs: any = {
  "LELLYS FLÁVIO": "#10b981", "JAILTON": "#ffffff", "RICARDO": "#f97316", "MANGU": "#1d4ed8",
  "MATHEUS TUK": "#a855f7", "SANNY": "#ec4899", "MARCOS": "#0ea5e9", "JEAN": "#fbbf24"
};

const formatCurrency = (val: number) => "R$ " + (val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const X4Dashboard: React.FC<X4DashboardProps> = ({ user, clients, groups, competences }) => {
  const [view, setView] = useState('ADM');
  const [sub, setSub] = useState('TODOS');
  const [search, setSearch] = useState('');

  const handleSubChange = (s: string) => { setSub(s); };

  const getSubBtns = () => {
    if (view === 'GRUPO ESPECIAL') return ['TODOS', 'LELLYS FLÁVIO'];
    if (view === 'GRUPO A') return ['TODOS', 'JAILTON', 'RICARDO', 'MANGU', 'MATHEUS TUK'];
    if (view === 'GRUPO B') return ['TODOS', 'SANNY', 'MARCOS', 'JEAN'];
    return [];
  };

  const getGroupName = (cli: Client) => {
    // In a real scenario we'd check the user table to see groupType, but here we can approximate
    // based on Gestor name (group name) for the HTML compatibility
    const g = groups.find(x => x.id === cli.groupId);
    if (!g) return 'DESCONHECIDO';
    const gn = g.name.toUpperCase();
    if (gn.includes('LELLYS')) return 'GRUPO ESPECIAL';
    if (['JAILTON', 'RICARDO', 'MANGU', 'MATHEUS TUK'].includes(gn)) return 'GRUPO A';
    if (['SANNY', 'MARCOS', 'JEAN'].includes(gn)) return 'GRUPO B';
    return gn; // Fallback
  };

  return (
    <div className="bg-[#0a0f1e] text-slate-100 min-h-[85vh] p-6 rounded-[2.5rem] border border-emerald-900/30 font-inter">
      
      <div className="flex items-center gap-4 mb-8 pb-4 border-b border-white/10">
        <LayoutGrid color="#22c55e" size={32} />
        <h1 className="text-3xl font-black tracking-tighter">PAINEL <span className="text-emerald-500">X4</span> GERAL</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 mb-6 overflow-x-auto pb-2">
        <button onClick={() => { setView('ADM'); setSub('TODOS'); }} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${view === 'ADM' ? 'bg-emerald-500 text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
          <LayoutGrid size={18} /> 1. VISÃO GERAL
        </button>
        <button onClick={() => { setView('GRUPO ESPECIAL'); setSub('TODOS'); }} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${view === 'GRUPO ESPECIAL' ? 'bg-emerald-500 text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
          <Star size={18} /> 2. GRUPO ESPECIAL
        </button>
        <button onClick={() => { setView('GRUPO A'); setSub('TODOS'); }} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${view === 'GRUPO A' ? 'bg-emerald-500 text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
          <Users size={18} /> 3. GRUPO A
        </button>
        <button onClick={() => { setView('GRUPO B'); setSub('TODOS'); }} className={`flex items-center gap-2 px-6 py-3 rounded-2xl font-bold whitespace-nowrap transition-all ${view === 'GRUPO B' ? 'bg-emerald-500 text-slate-900' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10'}`}>
          <UsersRound size={18} /> 4. GRUPO B
        </button>
      </div>

      {/* Sub-tabs */}
      {view !== 'ADM' && (
        <div className="flex gap-2 mb-8 bg-black/20 p-2.5 rounded-2xl border border-white/10 flex-wrap">
          {getSubBtns().map(btn => (
            <button key={btn} onClick={() => handleSubChange(btn)} className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all ${sub === btn ? 'bg-slate-700/80 text-white shadow-lg border border-white/10' : 'text-slate-500 hover:text-white'}`}>
              {btn === 'TODOS' ? `DASHBOARD GERAL ${view.replace('GRUPO ', '')}` : btn}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
          <span className="text-slate-400 text-xs font-bold uppercase block mb-3">Carteira em Aberto</span>
          <div className="text-3xl font-black">{formatCurrency(clients.reduce((a,c) => a + c.currentCapital, 0))}</div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
          <span className="text-slate-400 text-xs font-bold uppercase block mb-3">Juros à Receber (Mensal)</span>
          <div className="text-3xl font-black text-emerald-400">{formatCurrency(
            clients.reduce((a,c) => {
              const g = groups.find(x => x.id === c.groupId);
              return a + (c.currentCapital * ((g?.interestRate || 8) / 100));
            }, 0)
          )}</div>
        </div>
        <div className="bg-slate-800/40 backdrop-blur-xl border border-white/5 p-6 rounded-3xl">
          <span className="text-slate-400 text-xs font-bold uppercase block mb-3">Clientes Ativos</span>
          <div className="text-3xl font-black">{clients.length}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#1e293b] rounded-[2rem] border border-white/5 p-6 shadow-2xl">
        <input 
          type="text" 
          placeholder="🔎 Pesquisar cliente..." 
          className="w-full md:w-96 p-4 mb-6 bg-black/30 border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500 transition-colors"
          value={search} onChange={e => setSearch(e.target.value)} 
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-3">
            <thead>
              <tr>
                <th className="text-slate-400 text-[10px] font-black uppercase tracking-widest pl-4 pb-2">Cliente / Gestor</th>
                <th className="text-slate-400 text-[10px] font-black uppercase tracking-widest pb-2">Capital</th>
                <th className="text-slate-400 text-[10px] font-black uppercase tracking-widest pb-2">Juros</th>
                <th className="text-slate-400 text-[10px] font-black uppercase tracking-widest pb-2">Situação</th>
              </tr>
            </thead>
            <tbody>
              {clients.filter(c => {
                const gName = getGroupName(c);
                const gObj = groups.find(x => x.id === c.groupId);
                const gestor = gObj ? gObj.name.toUpperCase() : 'DESCONHECIDO';
                
                const vMatch = (view === 'ADM' || gName === view);
                const sMatch = (sub === 'TODOS' || gestor === sub);
                const nMatch = c.name.toUpperCase().includes(search.toUpperCase());

                return vMatch && sMatch && nMatch;
              }).map(c => {
                const g = groups.find(x => x.id === c.groupId);
                const gestor = g ? g.name.toUpperCase() : 'DESCONHECIDO';
                const color = clrs[gestor] || '#94a3b8';
                const juros = c.currentCapital * ((g?.interestRate || 8) / 100);

                return (
                  <tr key={c.id} className="bg-white/5 hover:bg-white/10 transition-colors group">
                    <td className="p-4 rounded-l-2xl border-l-[6px]" style={{ borderColor: color }}>
                      <div className="flex flex-col">
                        <span className="font-extrabold text-lg" style={{ color: color }}>{c.name}</span>
                        <span className="text-[10px] font-bold text-slate-500 tracking-wide mt-1">
                          GEST: {gestor} ({(g?.interestRate || 8)}%) | INÍCIO: {new Date(c.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 font-black">{formatCurrency(c.currentCapital)}</td>
                    <td className="p-4 font-black" style={{ color: color }}>{formatCurrency(juros)}</td>
                    <td className="p-4 rounded-r-2xl">
                      <span className="px-4 py-1.5 bg-blue-500/20 text-blue-300 font-bold text-[10px] uppercase tracking-widest rounded-xl border border-blue-500/30">
                        {c.status === 'ACTIVE' ? 'EM DIA' : c.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
export default X4Dashboard;
