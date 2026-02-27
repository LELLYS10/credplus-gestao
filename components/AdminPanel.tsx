
import React from 'react';
import { Group, Client, UserRole, User, Competence, Report } from '../types';
import { formatCurrency, getMonthName, getToday, getEffectiveDueDay } from '../utils';
import { Plus, UserPlus, Trash2, Settings2, FileText, Loader2, Users, ShieldCheck, Download } from 'lucide-react';

interface AdminPanelProps {
  groups: Group[];
  clients: Client[];
  users: User[];
  competences: Competence[];
  reports: Report[];
  user: User;
  onAddGroup: (data: any) => void;
  onDeleteGroup: (id: string) => void;
  onAddClient: (data: any) => void;
  onDeleteClient: (id: string) => void;
  onAddReport: (report: Report) => void;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ groups, clients, users, competences, reports, user, onAddGroup, onDeleteGroup, onAddClient, onDeleteClient, onAddReport }) => {
  const [activeSubTab, setActiveSubTab] = React.useState<'partners' | 'clients' | 'reports'>('partners');
  const [showGroupModal, setShowGroupModal] = React.useState(false);
  const [showClientModal, setShowClientModal] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);
  
  const [groupFormData, setGroupFormData] = React.useState({ name: '', email: '', phone: '', interestRate: 6, password: '' });
  const [clientFormData, setClientFormData] = React.useState({ name: '', phone: '', groupId: '', initialCapital: 0, dueDay: 1, startDate: new Date().toISOString().split('T')[0] });

  const handleGenerateReport = async () => {
    if (!confirm('Deseja realizar o fechamento mensal agora? Isso irá gerar um novo relatório com os saldos atuais.')) return;
    setIsGenerating(true);
    
    // Calculate totals for the report
    const totalCapital = clients.reduce((acc, c) => acc + c.currentCapital, 0);
    const totalInterest = competences.reduce((acc, c) => acc + (c.originalValue - c.paidAmount), 0);
    
    const newReport: Report = {
      id: `rep-${Date.now()}`,
      name: `Fechamento ${getMonthName(new Date().getMonth())}/${new Date().getFullYear()}`,
      createdAt: Date.now(),
      totalCapital,
      totalInterest,
      dataJson: {
        clientsCount: clients.length,
        groupsCount: groups.length,
        timestamp: new Date().toISOString()
      }
    };

    setTimeout(() => {
      onAddReport(newReport);
      setIsGenerating(false);
      setActiveSubTab('reports');
    }, 1000);
  };

  const downloadPDF = (report: Report) => {
    const { jsPDF } = (window as any).jspdf;
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105); // emerald-600
    doc.text("CREDPLUS - GESTÃO FINANCEIRA", 14, 22);
    
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text("RELATÓRIO DE FECHAMENTO MENSAL", 14, 32);
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(`Referência: ${report.name}`, 14, 42);
    doc.text(`Gerado em: ${new Date(report.createdAt).toLocaleString('pt-BR')}`, 14, 48);
    
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(14, 55, 196, 55);
    
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text("RESUMO FINANCEIRO", 14, 65);
    
    doc.setFontSize(10);
    doc.text(`Capital Total Emprestado: ${formatCurrency(report.totalCapital)}`, 14, 75);
    doc.text(`Juros Totais Pendentes: ${formatCurrency(report.totalInterest)}`, 14, 83);
    doc.text(`Total de Clientes Ativos: ${report.dataJson.clientsCount}`, 14, 91);
    doc.text(`Total de Sócios: ${report.dataJson.groupsCount}`, 14, 99);
    
    doc.line(14, 110, 196, 110);
    
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Este documento é um registro digital do sistema CREDPLUS - GESTÃO FINANCEIRA.", 14, 280);
    
    doc.save(`CREDPLUS-${report.name.replace(/\//g, '-')}.pdf`);
  };

  return (
    <div className="space-y-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-3xl font-black tracking-tighter flex items-center gap-3 text-slate-800">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl"><Settings2 size={32} /></div>
          PAINEL ADMINISTRATIVO
        </h2>
        <button onClick={handleGenerateReport} disabled={isGenerating} className="flex items-center gap-2 bg-emerald-900 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all shadow-xl shadow-emerald-200 border-b-4 border-emerald-800 disabled:opacity-50">
          {isGenerating ? <Loader2 size={18} className="animate-spin" /> : <FileText size={18} />} Fechamento Mensal
        </button>
      </div>

      <div className="flex flex-wrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200 self-start w-fit">
        {['partners', 'clients', 'reports'].map((tab: any) => (
          <button key={tab} onClick={() => setActiveSubTab(tab)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === tab ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-400'}`}>
            {tab === 'partners' ? 'Sócios' : tab === 'clients' ? 'Clientes' : 'Relatórios'}
          </button>
        ))}
      </div>

      {activeSubTab === 'partners' && (
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
           {groups.map(g => (
             <div key={g.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm relative group overflow-hidden">
                <div className="absolute top-0 right-0 p-4">
                  <button onClick={() => { if(confirm('Isso excluirá o sócio e TODOS os seus clientes e dados vinculados. Confirmar?')) onDeleteGroup(g.id); }} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 size={18}/></button>
                </div>
                <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xl mb-4">
                  {g.name.charAt(0).toUpperCase()}
                </div>
                <h4 className="text-lg font-black text-slate-800">{g.name}</h4>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{g.email}</p>
                  <div className="flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                    <ShieldCheck size={10} className="text-emerald-500" />
                    <span className="text-[9px] font-black text-slate-600 tracking-widest">SENHA: {users.find(u => u.groupId === g.id)?.password || '****'}</span>
                  </div>
                </div>
                <div className="pt-4 border-t border-slate-50 flex items-center justify-between mt-4">
                  <span className="bg-emerald-50 text-emerald-700 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">{g.interestRate}% JUROS</span>
                  <div className="flex -space-x-2">
                     <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center text-[8px] font-black">{clients.filter(c => c.groupId === g.id).length}</div>
                  </div>
                </div>
             </div>
           ))}
           <button onClick={()=>setShowGroupModal(true)} className="border-2 border-dashed border-slate-200 rounded-[2rem] flex flex-col items-center justify-center py-12 text-slate-300 hover:text-emerald-500 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group">
             <div className="w-16 h-16 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center group-hover:border-emerald-500 group-hover:scale-110 transition-all">
                <Plus size={32} />
             </div>
             <span className="font-black text-[11px] uppercase tracking-widest mt-4">Novo Sócio</span>
           </button>
        </section>
      )}

      {activeSubTab === 'clients' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-500">Gestão Global</h3>
            <button onClick={() => setShowClientModal(true)} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg border-b-4 border-emerald-800"><UserPlus size={18} /> Novo Cliente</button>
          </div>
          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 text-left">Nome</th>
                    <th className="py-4 px-6 text-left">Início</th>
                    <th className="py-4 px-6 text-left">Capital</th>
                    <th className="py-4 px-6 text-left">Sócio</th>
                    <th className="py-4 px-6 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {clients.map(c => (
                    <tr key={c.id}>
                      <td className="py-4 px-6 font-black text-slate-700">{c.name}</td>
                      <td className="py-4 px-6 text-slate-400 font-bold text-xs">{new Date(c.createdAt).toLocaleDateString('pt-BR')}</td>
                      <td className="py-4 px-6 text-emerald-600 font-bold">{formatCurrency(c.currentCapital)}</td>
                      <td className="py-4 px-6 text-slate-500 font-bold">{groups.find(g=>g.id===c.groupId)?.name || 'N/A'}</td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full text-[9px] font-black uppercase">Ativo</span>
                          <button onClick={() => { if(confirm(`Excluir cliente ${c.name}?`)) onDeleteClient(c.id); }} className="text-slate-300 hover:text-red-500 p-1 transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {clients.map(c => (
                <div key={c.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-black text-slate-800">{c.name}</h4>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Desde {new Date(c.createdAt).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <button onClick={() => { if(confirm(`Excluir cliente ${c.name}?`)) onDeleteClient(c.id); }} className="text-red-400 p-2">
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-black">Capital</p>
                      <p className="text-sm font-black text-emerald-600">{formatCurrency(c.currentCapital)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 uppercase font-black">Sócio</p>
                      <p className="text-sm font-bold text-slate-600">{groups.find(g=>g.id===c.groupId)?.name || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {activeSubTab === 'reports' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-lg font-black uppercase tracking-widest text-slate-500">Relatórios de Fechamento</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.length === 0 ? (
              <div className="col-span-full py-20 text-center bg-white rounded-[2rem] border border-dashed border-slate-200 text-slate-400 font-black uppercase tracking-widest">Nenhum relatório gerado.</div>
            ) : (
              reports.map(report => (
                <div key={report.id} className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className="flex items-center justify-between mb-6">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><FileText size={24} /></div>
                    <div className="flex gap-2">
                      <button onClick={() => downloadPDF(report)} className="p-2 bg-slate-100 text-slate-500 rounded-xl hover:bg-emerald-100 hover:text-emerald-700 transition-all"><Download size={18} /></button>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest self-center">{new Date(report.createdAt).toLocaleDateString('pt-BR')}</span>
                    </div>
                  </div>
                  <h4 className="text-xl font-black text-slate-800 mb-4">{report.name}</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Capital Total</p>
                      <p className="text-lg font-black text-emerald-700">{formatCurrency(report.totalCapital)}</p>
                    </div>
                    <div className="bg-slate-50 p-4 rounded-2xl">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Juros Pendentes</p>
                      <p className="text-lg font-black text-amber-600">{formatCurrency(report.totalInterest)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {/* MODAL NOVO SÓCIO - RESTAURADO */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4">
           <div className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl animate-in zoom-in">
              <h3 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><ShieldCheck size={28} className="text-emerald-600" /> Cadastro de Sócio</h3>
              <form onSubmit={e=>{e.preventDefault(); onAddGroup(groupFormData); setShowGroupModal(false);}} className="space-y-4">
                 <input required placeholder="Nome do Sócio" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={groupFormData.name} onChange={e=>setGroupFormData({...groupFormData, name: e.target.value})} />
                 <input required placeholder="E-mail de Acesso" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={groupFormData.email} onChange={e=>setGroupFormData({...groupFormData, email: e.target.value})} />
                 <input required placeholder="Telefone/WhatsApp" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={groupFormData.phone} onChange={e=>setGroupFormData({...groupFormData, phone: e.target.value})} />
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Taxa de Juros (%)</label><input type="number" step="0.1" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={groupFormData.interestRate} onChange={e=>setGroupFormData({...groupFormData, interestRate: parseFloat(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Senha Inicial</label><input type="password" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={groupFormData.password} onChange={e=>setGroupFormData({...groupFormData, password: e.target.value})} /></div>
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={()=>setShowGroupModal(false)} className="flex-1 p-4 border rounded-2xl font-black text-slate-400 uppercase text-xs">Cancelar</button>
                    <button type="submit" className="flex-1 p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg border-b-4 border-emerald-800">Salvar Sócio</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE */}
      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-900/40 backdrop-blur-md p-4">
           <div className="bg-white p-10 rounded-[3rem] w-full max-w-md shadow-2xl animate-in zoom-in">
              <h3 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Users /> Novo Cliente</h3>
              <form onSubmit={e=>{e.preventDefault(); onAddClient({ ...clientFormData, currentCapital: clientFormData.initialCapital, createdAt: new Date(clientFormData.startDate).getTime() + 12 * 60 * 60 * 1000 }); setShowClientModal(false);}} className="space-y-4">
                 <input required placeholder="Nome Completo" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={clientFormData.name} onChange={e=>setClientFormData({...clientFormData, name: e.target.value})} />
                 <input required placeholder="WhatsApp" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={clientFormData.phone} onChange={e=>setClientFormData({...clientFormData, phone: e.target.value})} />
                 <select required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={clientFormData.groupId} onChange={e=>setClientFormData({...clientFormData, groupId: e.target.value})}>
                    <option value="">Selecione o Sócio</option>
                    {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                 </select>
                 <div className="grid grid-cols-2 gap-4">
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Capital Inicial</label><input type="number" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={clientFormData.initialCapital} onChange={e=>setClientFormData({...clientFormData, initialCapital: parseFloat(e.target.value)})} /></div>
                    <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Vencimento (Dia)</label><input type="number" min="1" max="31" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={clientFormData.dueDay} onChange={e=>setClientFormData({...clientFormData, dueDay: parseInt(e.target.value)})} /></div>
                 </div>
                 <div>
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Data de Início do Empréstimo</label>
                    <input type="date" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold" value={clientFormData.startDate} onChange={e=>setClientFormData({...clientFormData, startDate: e.target.value})} />
                 </div>
                 <div className="flex gap-4 pt-4">
                    <button type="button" onClick={()=>setShowClientModal(false)} className="flex-1 p-4 border rounded-2xl font-black text-slate-400 uppercase text-xs">Cancelar</button>
                    <button type="submit" className="flex-1 p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs shadow-lg border-b-4 border-emerald-800">Criar Cliente</button>
                 </div>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
