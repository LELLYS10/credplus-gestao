
import React from 'react';
import { Client, Competence, Group, User, UserRole, PaymentRequest, RequestStatus, Transaction, TransactionType } from '../types';
import { formatCurrency, getMonthName, getEffectiveDueDay } from '../utils';
import { ArrowLeft, Plus, History, Calendar, X, DollarSign, Send, Edit3, Trash2, ArrowUpRight, ArrowDownLeft, CheckCircle2, Settings2, Bot } from 'lucide-react';

interface ClientDetailProps {
  client: Client;
  competences: Competence[];
  transactions: Transaction[];
  group: Group;
  groups: Group[];
  user: User;
  onBack: () => void;
  onRequestPayment: (interest: number, amortization: number, discount: number, obs: string, date: number) => void;
  onUpdateClient: (id: string, data: Partial<Client>) => void;
  onUpdateCompetence: (id: string, data: Partial<Competence>) => void;
  onUpdateTransaction: (id: string, data: Partial<Transaction>) => void;
  onDeleteClient: (id: string) => void;
  onAddTransaction: (trx: Transaction) => void;
  pendingRequests?: PaymentRequest[];
}

const ClientDetail: React.FC<ClientDetailProps> = ({ client, competences, transactions, group, groups, user, onBack, onRequestPayment, onUpdateClient, onUpdateCompetence, onUpdateTransaction, onDeleteClient, onAddTransaction, pendingRequests = [] }) => {
  const [activeTab, setActiveTab] = React.useState<'interest' | 'capital'>('interest');
  const [showRequestModal, setShowRequestModal] = React.useState(false);
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [showAdjModal, setShowAdjModal] = React.useState(false);
  const [showEditTrxModal, setShowEditTrxModal] = React.useState(false);
  const [showEditCompModal, setShowEditCompModal] = React.useState(false);
  
  const [formData, setFormData] = React.useState({ interest: 0, amortization: 0, discount: 0, observation: '', date: new Date().toISOString().split('T')[0] });
  const [editData, setEditData] = React.useState({ 
    name: client.name, 
    phone: client.phone, 
    groupId: client.groupId, 
    dueDay: client.dueDay,
    createdAt: new Date(client.createdAt).toISOString().split('T')[0]
  });
  const [adjData, setAdjData] = React.useState({ type: TransactionType.INVESTMENT, amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
  
  const [editTrxData, setEditTrxData] = React.useState<any>(null);
  const [editCompData, setEditCompData] = React.useState<any>(null);

  const isAdmin = user.role === UserRole.ADMIN;
  const sortedComps = React.useMemo(() => {
    return [...competences]
      .filter(c => c.clientId === client.id)
      .sort((a, b) => (b.year !== a.year ? b.year - a.year : b.month - a.month));
  }, [competences, client.id]);

  const sortedTrxs = React.useMemo(() => {
    return [...transactions]
      .filter(t => t.clientId === client.id)
      .sort((a, b) => b.createdAt - a.createdAt);
  }, [transactions, client.id]);

  const totalInterestOwed = React.useMemo(() => {
    return sortedComps.reduce((acc, c) => acc + (c.originalValue - c.paidAmount), 0);
  }, [sortedComps]);

  const handleSendWhatsAppReport = () => {
    const pendingMonths = sortedComps
      .filter(c => (c.originalValue - c.paidAmount) > 0.01)
      .map(c => `${getMonthName(c.month)}/${c.year}`).join(', ');
    const totalToLiquidate = client.currentCapital + totalInterestOwed;
    const message = `*EXTRATO FINANCEIRO - CREDPLUS*%0A%0A*Cliente:* ${client.name}%0A*Data:* ${new Date().toLocaleDateString('pt-BR')}%0A%0A--------------------------------%0A*Capital Atual:* ${formatCurrency(client.currentCapital)}%0A*Juros em Aberto:* ${formatCurrency(totalInterestOwed)}%0A${pendingMonths ? `*Meses Pendentes:* ${pendingMonths}%0A` : ''}--------------------------------%0A*TOTAL PARA QUITAÇÃO:* ${formatCurrency(totalToLiquidate)}%0A%0A_Por favor, realize o pagamento para manter seu cadastro em dia._`;
    window.open(`https://wa.me/55${client.phone.replace(/\D/g, '')}?text=${message}`, '_blank');
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateClient(client.id, { ...editData, createdAt: new Date(editData.createdAt).getTime() + 12 * 60 * 60 * 1000 });
    setShowEditModal(false);
  };

  const handleAdjSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    onAddTransaction({ 
      id: `trx-${Date.now()}`, 
      clientId: client.id, 
      type: adjData.type, 
      amount: adjData.amount, 
      description: adjData.description, 
      createdAt: new Date(adjData.date).getTime() + 12 * 60 * 60 * 1000 
    });
    setShowAdjModal(false);
    setAdjData({ type: TransactionType.INVESTMENT, amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
  };

  const handleEditTrxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editTrxData) return;
    onUpdateTransaction(editTrxData.id, {
      type: editTrxData.type,
      amount: editTrxData.amount,
      description: editTrxData.description,
      createdAt: new Date(editTrxData.date).getTime() + 12 * 60 * 60 * 1000
    });
    setShowEditTrxModal(false);
  };

  const handleEditCompSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editCompData) return;
    onUpdateCompetence(editCompData.id, {
      month: parseInt(editCompData.month),
      year: parseInt(editCompData.year),
      originalValue: parseFloat(editCompData.originalValue),
      paidAmount: parseFloat(editCompData.paidAmount),
      dueDate: new Date(editCompData.dueDate).getTime() + 12 * 60 * 60 * 1000
    });
    setShowEditCompModal(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between px-2">
        <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-emerald-700 transition-all font-black uppercase text-xs tracking-widest"><ArrowLeft size={18} /> Voltar</button>
        <div className="flex gap-2">
          <button 
            onClick={() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { message: `Qual a situação atual do cliente ${client.name}?` } }))}
            className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm border border-emerald-100 flex items-center gap-2 font-black uppercase text-[10px] tracking-widest"
          >
            <Bot size={18} /> IA
          </button>
          <button onClick={() => setShowEditModal(true)} className="p-2.5 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-200 transition-all shadow-sm border border-slate-200"><Edit3 size={18} /></button>
          <button onClick={handleSendWhatsAppReport} className="flex items-center gap-2 bg-green-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-green-600 transition-all shadow-md border-b-4 border-green-700"><Send size={14} /> Enviar Extrato</button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-lg overflow-hidden border-b-8 border-slate-300">
        <div className="bg-emerald-800 p-8 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="relative z-10">
            <h2 className="text-2xl md:text-4xl font-black tracking-tighter mb-2">{client.name}</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-2 text-emerald-100 font-bold uppercase text-[10px] tracking-widest opacity-80"><p>Sócio: <span className="text-amber-400">{group.name}</span></p><p>FONE: <span className="text-amber-400">{client.phone}</span></p><p>Vencimento: <span className="text-amber-400">Todo dia {client.dueDay}</span></p></div>
          </div>
          <div className="flex gap-8 relative z-10"><div className="text-right"><p className="text-[10px] text-emerald-300 uppercase font-black tracking-widest mb-1 opacity-70">Capital Atual</p><p className="text-xl md:text-3xl font-black tracking-tight">{formatCurrency(client.currentCapital)}</p></div><div className="text-right"><p className="text-[10px] text-emerald-300 uppercase font-black tracking-widest mb-1 opacity-70">Juros em Aberto</p><p className="text-xl md:text-3xl font-black tracking-tight text-amber-400">{formatCurrency(totalInterestOwed)}</p></div></div>
        </div>

        <div className="p-4 md:p-8">
          <div className="flex border-b border-slate-100 mb-8 overflow-x-auto">
            <button onClick={() => setActiveTab('interest')} className={`px-6 py-4 font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'interest' ? 'text-emerald-600 border-b-4 border-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>Extrato de Juros</button>
            <button onClick={() => setActiveTab('capital')} className={`px-6 py-4 font-black uppercase text-[10px] tracking-widest transition-all whitespace-nowrap ${activeTab === 'capital' ? 'text-emerald-600 border-b-4 border-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}>Razão de Capital</button>
          </div>

          {activeTab === 'interest' ? (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-black tracking-tighter flex items-center gap-3"><Calendar size={22} className="text-slate-400" /> HISTÓRICO DE MENSALIDADES</h3>
                <button 
                  disabled={client.currentCapital <= 0 && totalInterestOwed <= 0}
                  onClick={() => setShowRequestModal(true)} 
                  className={`px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 transition-all shadow-xl border-b-4 ${
                    (client.currentCapital <= 0 && totalInterestOwed <= 0) 
                    ? 'bg-slate-200 text-slate-400 border-slate-300 cursor-not-allowed shadow-none' 
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-emerald-100 border-emerald-800'
                  }`}
                >
                  <DollarSign size={18} /> Informar Pagamento
                </button>
              </div>
              {client.currentCapital <= 0 && totalInterestOwed <= 0 && (
                <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex items-center gap-3 text-emerald-700 text-xs font-bold">
                  <CheckCircle2 size={20} /> Empréstimo totalmente quitado. Não há valores pendentes.
                </div>
              )}
              <div className="rounded-3xl border border-slate-100 overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital Base</th>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Juros</th>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Recebido</th>
                        <th className="text-right py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                        {isAdmin && <th className="text-right py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedComps.map(comp => {
                        const displayDate = comp.dueDate 
                          ? new Date(comp.dueDate).toLocaleDateString('pt-BR')
                          : `${getEffectiveDueDay(client.dueDay, comp.month, comp.year)}/${String(comp.month + 1).padStart(2, '0')}/${comp.year}`;
                        
                        return (
                          <tr key={comp.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-5 px-6 font-black text-slate-800 text-sm">{displayDate}</td>
                            <td className="py-5 px-6 text-slate-400 font-bold text-sm">{formatCurrency(comp.capitalAtTime || 0)}</td>
                          <td className="py-5 px-6 text-slate-500 font-bold text-sm">{formatCurrency(comp.originalValue)}</td>
                          <td className="py-5 px-6 text-emerald-600 font-black text-sm">{formatCurrency(comp.paidAmount)}</td>
                          <td className="py-5 px-6 text-right">
                            {(comp.originalValue - comp.paidAmount) < 0.01 
                              ? <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-emerald-200">LIQUIDADO</span> 
                              : <span className="bg-amber-50 text-amber-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-amber-200">PENDENTE</span>}
                          </td>
                          {isAdmin && (
                            <td className="py-5 px-6 text-right">
                              <button 
                                onClick={() => {
                                  const defaultDate = new Date(comp.year, comp.month, getEffectiveDueDay(client.dueDay, comp.month, comp.year)).toISOString().split('T')[0];
                                  setEditCompData({ 
                                    ...comp, 
                                    month: comp.month.toString(), 
                                    year: comp.year.toString(),
                                    dueDate: comp.dueDate ? new Date(comp.dueDate).toISOString().split('T')[0] : defaultDate
                                  });
                                  setShowEditCompModal(true);
                                }}
                                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                              >
                                <Edit3 size={16} />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-50">
                  {sortedComps.map(comp => {
                    const displayDate = comp.dueDate 
                      ? new Date(comp.dueDate).toLocaleDateString('pt-BR')
                      : `${getEffectiveDueDay(client.dueDay, comp.month, comp.year)}/${String(comp.month + 1).padStart(2, '0')}/${comp.year}`;
                    
                    return (
                      <div key={comp.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="font-black text-slate-800 text-sm">{displayDate}</span>
                          {(comp.originalValue - comp.paidAmount) < 0.01 
                            ? <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">LIQUIDADO</span> 
                            : <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">PENDENTE</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-xl">
                          <div>
                            <p className="text-[8px] text-slate-400 uppercase font-black">Valor Juros</p>
                            <p className="text-xs font-black text-slate-600">{formatCurrency(comp.originalValue)}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-[8px] text-slate-400 uppercase font-black">Recebido</p>
                            <p className="text-xs font-black text-emerald-600">{formatCurrency(comp.paidAmount)}</p>
                          </div>
                        </div>
                        {isAdmin && (
                          <button 
                            onClick={() => {
                              const defaultDate = new Date(comp.year, comp.month, getEffectiveDueDay(client.dueDay, comp.month, comp.year)).toISOString().split('T')[0];
                              setEditCompData({ 
                                ...comp, 
                                month: comp.month.toString(), 
                                year: comp.year.toString(),
                                dueDate: comp.dueDate ? new Date(comp.dueDate).toISOString().split('T')[0] : defaultDate
                              });
                              setShowEditCompModal(true);
                            }}
                            className="w-full py-2 bg-slate-50 text-slate-400 font-black uppercase text-[9px] tracking-widest rounded-lg border border-slate-100 flex items-center justify-center gap-2"
                          >
                            <Edit3 size={12} /> Editar Mensalidade
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h3 className="text-lg font-black tracking-tighter flex items-center gap-3"><History size={22} className="text-slate-400" /> MOVIMENTAÇÕES DE CAPITAL</h3>
                {isAdmin && (
                  <div className="flex gap-3">
                    <button 
                      onClick={() => {
                        setAdjData({ type: TransactionType.INVESTMENT, amount: 0, description: 'Novo Empréstimo', date: new Date().toISOString().split('T')[0] });
                        setShowAdjModal(true);
                      }} 
                      className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 border-b-4 border-emerald-800"
                    >
                      <Plus size={18} /> Novo Empréstimo
                    </button>
                    <button 
                      onClick={() => {
                        setAdjData({ type: TransactionType.INVESTMENT, amount: 0, description: '', date: new Date().toISOString().split('T')[0] });
                        setShowAdjModal(true);
                      }} 
                      className="bg-slate-800 text-white px-6 py-3 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-black transition-all shadow-xl shadow-slate-200 border-b-4 border-black"
                    >
                      <Settings2 size={18} /> Ajuste Manual
                    </button>
                  </div>
                )}
              </div>
              <div className="rounded-3xl border border-slate-100 overflow-hidden">
                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50/50">
                      <tr>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Tipo</th>
                        <th className="text-left py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
                        <th className="text-right py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</th>
                        {isAdmin && <th className="text-right py-5 px-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {sortedTrxs.length === 0 ? (
                        <tr><td colSpan={isAdmin ? 5 : 4} className="py-10 text-center text-slate-400 text-xs font-black uppercase">Sem movimentações.</td></tr>
                      ) : (
                        sortedTrxs.map(trx => (
                          <tr key={trx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="py-5 px-6 font-bold text-slate-500 text-xs">{new Date(trx.createdAt).toLocaleDateString()}</td>
                            <td className="py-5 px-6">
                              <span className={`inline-flex items-center gap-1.5 font-black text-[9px] uppercase tracking-widest ${trx.type === TransactionType.INVESTMENT ? 'text-emerald-600' : 'text-amber-600'}`}>
                                {trx.type === TransactionType.INVESTMENT ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                {trx.type === TransactionType.INVESTMENT ? 'Aporte' : trx.type === TransactionType.WITHDRAWAL ? 'Retirada' : 'Amortização'}
                              </span>
                            </td>
                            <td className="py-5 px-6 text-slate-600 font-medium text-xs">{trx.description}</td>
                            <td className={`py-5 px-6 text-right font-black text-sm ${trx.type === TransactionType.INVESTMENT ? 'text-emerald-600' : 'text-red-500'}`}>
                              {trx.type === TransactionType.INVESTMENT ? '+' : '-'}{formatCurrency(trx.amount)}
                            </td>
                            {isAdmin && (
                              <td className="py-5 px-6 text-right">
                                <button 
                                  onClick={() => {
                                    setEditTrxData({ ...trx, date: new Date(trx.createdAt).toISOString().split('T')[0] });
                                    setShowEditTrxModal(true);
                                  }}
                                  className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
                                >
                                  <Edit3 size={16} />
                                </button>
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden divide-y divide-slate-50">
                  {sortedTrxs.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 text-[10px] font-black uppercase">Sem movimentações.</div>
                  ) : (
                    sortedTrxs.map(trx => (
                      <div key={trx.id} className="p-4 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-slate-400">{new Date(trx.createdAt).toLocaleDateString()}</span>
                          <span className={`font-black text-sm ${trx.type === TransactionType.INVESTMENT ? 'text-emerald-600' : 'text-red-500'}`}>
                            {trx.type === TransactionType.INVESTMENT ? '+' : '-'}{formatCurrency(trx.amount)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[8px] font-black uppercase tracking-widest ${trx.type === TransactionType.INVESTMENT ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {trx.type === TransactionType.INVESTMENT ? 'Aporte' : trx.type === TransactionType.WITHDRAWAL ? 'Retirada' : 'Amortização'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-medium italic truncate max-w-[150px]">{trx.description}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {isAdmin && showAdjModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
           <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><DollarSign /> Ajuste de Capital</h3>
              <form onSubmit={handleAdjSubmit} className="space-y-6">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data da Operação</label><input type="date" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={adjData.date} onChange={e=>setAdjData({...adjData, date: e.target.value})} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operação</label><select className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={adjData.type} onChange={e=>setAdjData({...adjData, type: e.target.value as TransactionType})}><option value={TransactionType.INVESTMENT}>Aporte (+) </option><option value={TransactionType.WITHDRAWAL}>Retirada (-) </option></select></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</label><input type="number" step="0.01" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={adjData.amount} onChange={e=>setAdjData({...adjData, amount: parseFloat(e.target.value)})} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label><input placeholder="Ex: Novo investimento de R$ 5k." className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={adjData.description} onChange={e=>setAdjData({...adjData, description: e.target.value})} /></div>
                <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setShowAdjModal(false)} className="flex-1 p-4 border rounded-2xl font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button><button type="submit" className="flex-1 p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl border-b-4 border-emerald-800">Confirmar</button></div>
              </form>
           </div>
        </div>
      )}

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
           <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Edit3 /> {isAdmin ? 'Editar Cadastro' : 'Gerenciar Cliente'}</h3>
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nome do Cliente</label><input disabled={!isAdmin} placeholder="Nome" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold disabled:opacity-50" value={editData.name} onChange={e=>setEditData({...editData, name: e.target.value})} /></div>
                <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">WhatsApp</label><input disabled={!isAdmin} placeholder="WhatsApp" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold disabled:opacity-50" value={editData.phone} onChange={e=>setEditData({...editData, phone: e.target.value})} /></div>
                <div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Sócio Responsável</label><select disabled={!isAdmin} className="w-full p-4 bg-slate-50 rounded-2xl border font-bold disabled:opacity-50" value={editData.groupId} onChange={e=>setEditData({...editData, groupId: e.target.value})}><option value="">Selecione o Sócio</option>{groups.map(g=><option key={g.id} value={g.id}>{g.name}</option>)}</select></div>
                <div className="grid grid-cols-2 gap-4"><div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Dia Vencimento</label><input disabled={!isAdmin} type="number" min="1" max="31" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold disabled:opacity-50" value={editData.dueDay} onChange={e=>setEditData({...editData, dueDay: parseInt(e.target.value)})} /></div><div><label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Data Início</label><input disabled={!isAdmin} type="date" className="w-full p-4 bg-slate-50 rounded-2xl border font-bold disabled:opacity-50" value={editData.createdAt} onChange={e=>setEditData({...editData, createdAt: e.target.value})} /></div></div>
                <div className="pt-4 space-y-3">
                  {isAdmin && <button type="submit" className="w-full p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg border-b-4 border-emerald-800">Salvar Alterações</button>}
                  <button type="button" onClick={() => { if(confirm('Excluir cliente e todo histórico?')) onDeleteClient(client.id); }} className="w-full p-4 bg-red-50 text-red-600 rounded-2xl font-black uppercase text-xs tracking-widest border border-red-100 hover:bg-red-100 transition-all flex items-center justify-center gap-2"><Trash2 size={16}/> Excluir Cliente Permanente</button>
                  <button type="button" onClick={()=>setShowEditModal(false)} className="w-full p-4 border rounded-2xl font-black text-slate-400 uppercase text-xs tracking-widest">Fechar</button>
                </div>
              </form>
           </div>
        </div>
      )}

      {isAdmin && showEditTrxModal && editTrxData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
           <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Edit3 /> Editar Movimentação</h3>
              <form onSubmit={handleEditTrxSubmit} className="space-y-6">
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</label><input type="date" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editTrxData.date} onChange={e=>setEditTrxData({...editTrxData, date: e.target.value})} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Operação</label><select className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editTrxData.type} onChange={e=>setEditTrxData({...editTrxData, type: e.target.value as TransactionType})}><option value={TransactionType.INVESTMENT}>Aporte (+) </option><option value={TransactionType.WITHDRAWAL}>Retirada (-) </option><option value={TransactionType.AMORTIZATION}>Amortização (-) </option></select></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor</label><input type="number" step="0.01" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editTrxData.amount} onChange={e=>setEditTrxData({...editTrxData, amount: parseFloat(e.target.value)})} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</label><input className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editTrxData.description} onChange={e=>setEditTrxData({...editTrxData, description: e.target.value})} /></div>
                <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setShowEditTrxModal(false)} className="flex-1 p-4 border rounded-2xl font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button><button type="submit" className="flex-1 p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl border-b-4 border-emerald-800">Salvar</button></div>
              </form>
           </div>
        </div>
      )}

      {isAdmin && showEditCompModal && editCompData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md">
           <div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300">
              <h3 className="text-2xl font-black text-slate-800 uppercase mb-6 flex items-center gap-2"><Edit3 /> Editar Mensalidade</h3>
              <form onSubmit={handleEditCompSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mês (0-11)</label><input type="number" min="0" max="11" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editCompData.month} onChange={e=>setEditCompData({...editCompData, month: e.target.value})} /></div>
                  <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano</label><input type="number" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editCompData.year} onChange={e=>setEditCompData({...editCompData, year: e.target.value})} /></div>
                </div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data de Vencimento</label><input type="date" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editCompData.dueDate} onChange={e=>setEditCompData({...editCompData, dueDate: e.target.value})} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Juros</label><input type="number" step="0.01" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editCompData.originalValue} onChange={e=>setEditCompData({...editCompData, originalValue: e.target.value})} /></div>
                <div><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Recebido</label><input type="number" step="0.01" required className="w-full p-4 bg-slate-50 rounded-2xl border font-bold mt-1" value={editCompData.paidAmount} onChange={e=>setEditCompData({...editCompData, paidAmount: e.target.value})} /></div>
                <div className="flex gap-4 pt-4"><button type="button" onClick={()=>setShowEditCompModal(false)} className="flex-1 p-4 border rounded-2xl font-black text-slate-400 uppercase text-xs tracking-widest">Cancelar</button><button type="submit" className="flex-1 p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl border-b-4 border-emerald-800">Salvar</button></div>
              </form>
           </div>
        </div>
      )}

      {showRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-emerald-900/40 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg my-auto animate-in fade-in zoom-in duration-300 border-b-8 border-slate-300 flex flex-col max-h-[95vh]">
            <div className="p-8 bg-emerald-700 text-white flex items-center justify-between shrink-0"><div className="flex items-center gap-3"><DollarSign size={24}/><h3 className="text-2xl font-black tracking-tighter uppercase">Baixa no Recebimento</h3></div><button onClick={() => setShowRequestModal(false)}><X size={24} /></button></div>
            <form onSubmit={(e) => { e.preventDefault(); onRequestPayment(formData.interest, formData.amortization, formData.discount, formData.observation, new Date(formData.date).getTime() + 12 * 60 * 60 * 1000); setShowRequestModal(false); }} className="p-10 space-y-6 overflow-y-auto">
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Data do Pagamento</label><input type="date" required className="w-full p-4 bg-slate-50 border rounded-2xl font-black" value={formData.date} onChange={e=>setFormData({...formData, date: e.target.value})} /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Juros</label><input type="number" step="0.01" className="w-full p-4 bg-slate-50 border rounded-2xl font-black" value={formData.interest} onChange={e=>setFormData({...formData, interest: parseFloat(e.target.value)||0})} /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Abatimento/Desconto de Juros</label><input type="number" step="0.01" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-amber-600" value={formData.discount} onChange={e=>setFormData({...formData, discount: parseFloat(e.target.value)||0})} /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Amortização de Capital</label><input type="number" step="0.01" className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-emerald-600" value={formData.amortization} onChange={e=>setFormData({...formData, amortization: parseFloat(e.target.value)||0})} /></div>
              <textarea placeholder="Observação..." className="w-full p-4 bg-slate-50 border rounded-2xl h-24 font-medium" value={formData.observation} onChange={e=>setFormData({...formData, observation: e.target.value})}></textarea>
              <button type="submit" className="w-full p-4 bg-emerald-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-xl border-b-4 border-emerald-800">Sinalizar Pagamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientDetail;
