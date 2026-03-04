
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
  const [loanSearch, setLoanSearch] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'all' | 'vencidos' | 'vence-hoje'>('all');
  
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({ nome: '', telefone: '', observacoes: '' });
  
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingLoanId, setEditingLoanId] = useState<string | null>(null);
  const [loanForm, setLoanForm] = useState({ 
    clientId: '', 
    valorPrincipal: 0, 
    porcentagemJurosMensal: 10, 
    dataEmprestimo: new Date().toLocaleDateString('en-CA'),
    dataPagamentoJuros: new Date().toLocaleDateString('en-CA') 
  });

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    loanId: '',
    valor: 0,
    tipo: 'juros' as 'juros' | 'amortizacao',
    dataPagamento: new Date().toLocaleDateString('en-CA'),
    observacao: '',
    avancarVencimento: true
  });
  
  // Filter data by current user
  const myClients = (db.thirdPartyClients || []).filter((c: ThirdPartyClient) => c.userId === user.id);
  const myLoans = (db.thirdPartyLoans || []).filter((l: ThirdPartyLoan) => l.userId === user.id);
  const myPayments = (db.thirdPartyPayments || []).filter((p: ThirdPartyPayment) => p.userId === user.id);

  // Dashboard Stats
  const todayStr = new Date().toLocaleDateString('en-CA');
  const capitalEmAberto = myLoans.reduce((acc: number, l: any) => acc + (l.valorPrincipal > 0 ? l.valorPrincipal : 0), 0);
  const vencemHoje = myLoans.filter((l: any) => l.valorPrincipal > 0 && l.dataPagamentoJuros === todayStr).length;
  const vencidos = myLoans.filter((l: any) => l.valorPrincipal > 0 && l.dataPagamentoJuros < todayStr).length;

  const handleAddClient = (e: React.FormEvent) => {
    e.preventDefault();
    const newClient: ThirdPartyClient = {
      id: `tpc-${Date.now()}`,
      userId: user.id,
      nome: clientForm.nome,
      telefone: clientForm.telefone,
      observacoes: clientForm.observacoes,
      createdAt: Date.now()
    };

    setDb((prev: any) => ({
      ...prev,
      thirdPartyClients: [...(prev.thirdPartyClients || []), newClient]
    }));

    setShowClientModal(false);
    setClientForm({ nome: '', telefone: '', observacoes: '' });
  };

  const handleDeleteClient = (id: string) => {
    if (!confirm('Deseja realmente excluir este cliente? Todos os empréstimos vinculados também serão afetados.')) return;
    
    setDb((prev: any) => ({
      ...prev,
      thirdPartyClients: (prev.thirdPartyClients || []).filter((c: any) => c.id !== id),
      thirdPartyLoans: (prev.thirdPartyLoans || []).filter((l: any) => l.clientId !== id)
    }));
  };

  const handleAddLoan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loanForm.clientId) {
      alert("Selecione um cliente.");
      return;
    }

    const newLoan: ThirdPartyLoan = {
      id: editingLoanId || `tpl-${Date.now()}`,
      userId: user.id,
      clientId: loanForm.clientId,
      valorPrincipal: loanForm.valorPrincipal,
      porcentagemJurosMensal: loanForm.porcentagemJurosMensal,
      dataEmprestimo: loanForm.dataEmprestimo,
      dataPagamentoJuros: loanForm.dataPagamentoJuros,
      status: loanForm.valorPrincipal > 0 ? 'ativo' : 'encerrado',
      createdAt: editingLoanId ? (myLoans.find(l => l.id === editingLoanId)?.createdAt || Date.now()) : Date.now()
    };

    setDb((prev: any) => {
      const otherLoans = (prev.thirdPartyLoans || []).filter((l: any) => l.id !== editingLoanId);
      return {
        ...prev,
        thirdPartyLoans: [...otherLoans, newLoan]
      };
    });

    setShowLoanModal(false);
    setEditingLoanId(null);
    setLoanForm({ 
      clientId: '', 
      valorPrincipal: 0, 
      porcentagemJurosMensal: 10, 
      dataEmprestimo: new Date().toLocaleDateString('en-CA'),
      dataPagamentoJuros: new Date().toLocaleDateString('en-CA') 
    });
  };

  const handleEditLoan = (loan: ThirdPartyLoan) => {
    setEditingLoanId(loan.id);
    setLoanForm({
      clientId: loan.clientId,
      valorPrincipal: loan.valorPrincipal,
      porcentagemJurosMensal: loan.porcentagemJurosMensal,
      dataEmprestimo: loan.dataEmprestimo,
      dataPagamentoJuros: loan.dataPagamentoJuros
    });
    setShowLoanModal(true);
  };

  const handleAddPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.loanId) {
      alert("Selecione um empréstimo.");
      return;
    }

    const newPayment: ThirdPartyPayment = {
      id: `tpp-${Date.now()}`,
      userId: user.id,
      loanId: paymentForm.loanId,
      dataPagamento: paymentForm.dataPagamento,
      valor: paymentForm.valor,
      tipo: paymentForm.tipo,
      observacao: paymentForm.observacao,
      createdAt: Date.now()
    };

    setDb((prev: any) => {
      let updatedLoans = [...(prev.thirdPartyLoans || [])];
      
      updatedLoans = updatedLoans.map((l: any) => {
        if (l.id === newPayment.loanId) {
          // Calculate new principal if it's an amortization
          let newPrincipal = l.valorPrincipal;
          if (newPayment.tipo === 'amortizacao') {
            newPrincipal = Math.max(0, l.valorPrincipal - newPayment.valor);
          }

          // Advance due date by exactly one month if it's a interest payment and option is checked
          let nextDueDateStr = l.dataPagamentoJuros;
          if (newPayment.tipo === 'juros' && paymentForm.avancarVencimento) {
            const currentDueDate = new Date(l.dataPagamentoJuros + 'T12:00:00');
            const nextDueDate = new Date(currentDueDate);
            nextDueDate.setMonth(nextDueDate.getMonth() + 1);
            
            // If the day changed (e.g. Jan 31 -> Mar 3), cap it at the last day of the correct month
            if (nextDueDate.getDate() !== currentDueDate.getDate()) {
              nextDueDate.setDate(0);
            }
            nextDueDateStr = nextDueDate.toISOString().split('T')[0];
          }

          return { 
            ...l, 
            valorPrincipal: newPrincipal,
            dataPagamentoJuros: nextDueDateStr,
            status: newPrincipal === 0 ? 'encerrado' : 'ativo'
          };
        }
        return l;
      });

      return {
        ...prev,
        thirdPartyLoans: updatedLoans,
        thirdPartyPayments: [...(prev.thirdPartyPayments || []), newPayment]
      };
    });

    setShowPaymentModal(false);
    setPaymentForm({
      loanId: '',
      valor: 0,
      tipo: 'juros',
      dataPagamento: new Date().toLocaleDateString('en-CA'),
      observacao: '',
      avancarVencimento: true
    });
  };

  const handleDeletePayment = (id: string) => {
    if (!confirm('Excluir este registro de pagamento?')) return;
    setDb((prev: any) => ({
      ...prev,
      thirdPartyPayments: (prev.thirdPartyPayments || []).filter((p: any) => p.id !== id)
    }));
  };

  const handleDeleteLoan = (id: string) => {
    if (!confirm('Excluir este empréstimo permanentemente?')) return;
    setDb((prev: any) => ({
      ...prev,
      thirdPartyLoans: (prev.thirdPartyLoans || []).filter((l: any) => l.id !== id)
    }));
  };

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
                  {formatCurrency(capitalEmAberto)}
                </h3>
              </div>
              <div 
                onClick={() => { setActiveSubTab('loans'); setLoanStatusFilter('vence-hoje'); }}
                className="bg-white p-8 rounded-[2rem] border-2 border-blue-100 shadow-sm cursor-pointer hover:border-blue-300 transition-all active:scale-95"
              >
                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">VENCE HOJE</p>
                <h3 className="text-3xl font-black tracking-tighter text-blue-800">{vencemHoje}</h3>
              </div>
              <div 
                onClick={() => { setActiveSubTab('loans'); setLoanStatusFilter('vencidos'); }}
                className="bg-white p-8 rounded-[2rem] border-2 border-red-100 shadow-sm cursor-pointer hover:border-red-300 transition-all active:scale-95"
              >
                <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">Vencidos</p>
                <h3 className="text-3xl font-black tracking-tighter text-red-600">{vencidos}</h3>
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
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-blue-800 uppercase tracking-tighter">Meus Clientes</h3>
              <button 
                onClick={() => setShowClientModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                <Plus size={16} /> Novo Cliente
              </button>
            </div>

            {myClients.length === 0 ? (
              <div className="py-20 text-center bg-blue-50/30 rounded-[2rem] border-2 border-dashed border-blue-100">
                <Users size={48} className="mx-auto text-blue-200 mb-4" />
                <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Nenhum cliente cadastrado ainda.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {myClients.map(client => (
                  <div key={client.id} className="bg-white p-6 rounded-[2rem] border-2 border-blue-50 shadow-sm hover:border-blue-200 transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xl">
                        {client.nome.charAt(0).toUpperCase()}
                      </div>
                      <button 
                        onClick={() => handleDeleteClient(client.id)}
                        className="p-2 text-blue-200 hover:text-red-500 transition-colors"
                      >
                        <AlertCircle size={18} />
                      </button>
                    </div>
                    <h4 className="font-black text-blue-900 text-lg mb-1">{client.nome}</h4>
                    <div className="flex items-center gap-2 text-blue-400 mb-4">
                      <Phone size={14} />
                      <span className="text-xs font-bold">{client.telefone}</span>
                    </div>
                    <div className="pt-4 border-t border-blue-50 flex items-center justify-between">
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black text-blue-300 uppercase tracking-widest">Empréstimos</span>
                        <span className="text-sm font-black text-blue-600">{myLoans.filter(l => l.clientId === client.id).length} ativos</span>
                      </div>
                      <button 
                        onClick={() => {
                          setLoanSearch(client.nome);
                          setLoanStatusFilter('all');
                          setActiveSubTab('loans');
                        }}
                        className="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-600 hover:text-white transition-all"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL NOVO CLIENTE */}
        {showClientModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-900/40 backdrop-blur-md p-4">
            <div className="bg-white p-6 rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><Users size={24} /></div>
                <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Novo Cliente</h3>
              </div>
              
              <form onSubmit={handleAddClient} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Nome Completo</label>
                  <input 
                    required 
                    placeholder="Ex: João Silva" 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={clientForm.nome} 
                    onChange={e => setClientForm({...clientForm, nome: e.target.value})} 
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">WhatsApp / Telefone</label>
                  <input 
                    required 
                    placeholder="(00) 00000-0000" 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={clientForm.telefone} 
                    onChange={e => setClientForm({...clientForm, telefone: e.target.value})} 
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Observações (Opcional)</label>
                  <textarea 
                    placeholder="Alguma nota sobre o cliente..." 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none min-h-[80px]" 
                    value={clientForm.observacoes} 
                    onChange={e => setClientForm({...clientForm, observacoes: e.target.value})} 
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button" 
                    onClick={() => setShowClientModal(false)} 
                    className="flex-1 p-3 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="flex-1 p-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 border-b-4 border-blue-800 hover:bg-blue-700 transition-all"
                  >
                    Salvar Cliente
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {activeSubTab === 'loans' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
              <div className="flex flex-col md:flex-row md:items-center gap-4 flex-1">
                <div>
                  <h3 className="text-lg font-black text-blue-800 uppercase tracking-tighter">Empréstimos Ativos</h3>
                  <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Gerencie seus contratos ativos</p>
                </div>
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-300" size={16} />
                  <input 
                    type="text"
                    placeholder="Buscar por cliente..."
                    className="w-full pl-10 pr-4 py-2.5 bg-blue-50/50 border-2 border-transparent focus:border-blue-100 rounded-xl text-xs font-bold text-blue-900 outline-none transition-all"
                    value={loanSearch}
                    onChange={(e) => setLoanSearch(e.target.value)}
                  />
                </div>
              </div>
              <button 
                onClick={() => setShowLoanModal(true)}
                className="flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all active:scale-95"
              >
                <Plus size={16} /> Novo Empréstimo
              </button>
            </div>

            {loanStatusFilter !== 'all' && (
              <div className="flex items-center justify-between bg-blue-50 p-4 rounded-2xl border border-blue-100 animate-in slide-in-from-top-2 duration-300">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${loanStatusFilter === 'vencidos' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                    <AlertCircle size={18} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Filtrando por</p>
                    <p className={`text-sm font-black uppercase tracking-tighter ${loanStatusFilter === 'vencidos' ? 'text-red-600' : 'text-blue-800'}`}>
                      {loanStatusFilter === 'vencidos' ? 'Empréstimos Vencidos' : 'Vencimentos de Hoje'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setLoanStatusFilter('all')}
                  className="px-4 py-2 bg-white text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-blue-200 hover:bg-blue-50 transition-all shadow-sm"
                >
                  Limpar Filtro
                </button>
              </div>
            )}

            {myLoans.length === 0 ? (
              <div className="py-16 text-center bg-white rounded-[2rem] border-2 border-dashed border-blue-100">
                <FileText size={40} className="mx-auto text-blue-100 mb-3" />
                <p className="text-blue-300 font-black uppercase tracking-widest text-[9px]">Nenhum empréstimo registrado.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {myLoans
                  .filter(loan => {
                    const client = myClients.find(c => c.id === loan.clientId);
                    const matchesSearch = client?.nome.toLowerCase().includes(loanSearch.toLowerCase());
                    
                    if (loanStatusFilter === 'vencidos') {
                      return matchesSearch && loan.valorPrincipal > 0 && loan.dataPagamentoJuros < todayStr;
                    }
                    if (loanStatusFilter === 'vence-hoje') {
                      return matchesSearch && loan.valorPrincipal > 0 && loan.dataPagamentoJuros === todayStr;
                    }
                    
                    return matchesSearch;
                  })
                  .map(loan => {
                    const client = myClients.find(c => c.id === loan.clientId);
                    const isInactive = loan.valorPrincipal === 0;
                    const loanPayments = myPayments.filter(p => p.loanId === loan.id);
                    const jurosCount = loanPayments.filter(p => p.tipo === 'juros').length;
                    const totalJuros = loanPayments.filter(p => p.tipo === 'juros').reduce((acc, p) => acc + p.valor, 0);

                    return (
                      <div key={loan.id} className={`p-3 md:p-4 rounded-[1.25rem] border shadow-sm flex flex-col md:flex-row md:items-center gap-4 transition-all group ${isInactive ? 'bg-slate-50 border-slate-200 opacity-60 grayscale' : 'bg-white border-blue-50 hover:shadow-md hover:border-blue-200'}`}>
                        {/* Avatar e Nome */}
                        <div className="flex items-center gap-3 md:w-1/4">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${isInactive ? 'bg-slate-200 text-slate-500' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'}`}>
                            <DollarSign size={18} />
                          </div>
                          <div className="min-w-0">
                            <h4 className={`font-black truncate text-sm ${isInactive ? 'text-slate-500' : 'text-blue-900'}`}>{client?.nome || 'Cliente Excluído'}</h4>
                            <p className={`text-[8px] font-black uppercase tracking-widest ${isInactive ? 'text-slate-400' : 'text-blue-300'}`}>Desde {new Date(loan.dataEmprestimo).toLocaleDateString('pt-BR')}</p>
                            {jurosCount > 0 && (
                              <div className="mt-1 flex items-center gap-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                                <span className="text-[8px] font-black text-emerald-600 uppercase tracking-tighter">
                                  {jurosCount}x juros recebidos ({formatCurrency(totalJuros)})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                      {/* Dados Financeiros */}
                      <div className={`grid grid-cols-3 gap-2 flex-1 border-y md:border-y-0 md:border-x py-3 md:py-0 md:px-4 ${isInactive ? 'border-slate-200' : 'border-blue-50'}`}>
                        <div>
                          <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${isInactive ? 'text-slate-400' : 'text-blue-300'}`}>Principal</p>
                          <p className={`text-xs md:text-sm font-black ${isInactive ? 'text-slate-500' : 'text-blue-700'}`}>{formatCurrency(loan.valorPrincipal)}</p>
                        </div>
                        <div>
                          <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${isInactive ? 'text-slate-400' : 'text-blue-300'}`}>Juros</p>
                          <p className={`text-xs md:text-sm font-black leading-tight ${isInactive ? 'text-slate-400' : 'text-amber-600'}`}>
                            {loan.porcentagemJurosMensal}% 
                            <br />
                            <span className={`text-[10px] font-black ${isInactive ? 'text-slate-400' : 'text-emerald-600'}`}>
                              ({formatCurrency(loan.valorPrincipal * (loan.porcentagemJurosMensal / 100))})
                            </span>
                          </p>
                        </div>
                        <div>
                          <p className={`text-[7px] font-black uppercase tracking-widest mb-0.5 ${isInactive ? 'text-slate-400' : 'text-blue-300'}`}>Vencimento</p>
                          <p className={`text-xs md:text-sm font-black ${isInactive ? 'text-slate-500' : 'text-blue-900'}`}>{new Date(loan.dataPagamentoJuros).toLocaleDateString('pt-BR')}</p>
                        </div>
                      </div>

                      {/* Ações com Legendas */}
                      <div className="flex items-center justify-around md:justify-end gap-4 md:min-w-[180px]">
                        {!isInactive && (
                          <button 
                            onClick={() => {
                              setPaymentForm({ ...paymentForm, loanId: loan.id });
                              setShowPaymentModal(true);
                            }}
                            className="flex flex-col items-center gap-1 group/btn"
                          >
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover/btn:bg-emerald-600 group-hover/btn:text-white transition-all">
                              <DollarSign size={16} />
                            </div>
                            <span className="text-[7px] font-black text-emerald-600 uppercase tracking-tighter">Pagar</span>
                          </button>
                        )}
                        
                        <button 
                          onClick={() => handleEditLoan(loan)}
                          className="flex flex-col items-center gap-1 group/btn"
                        >
                          <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover/btn:bg-blue-600 group-hover/btn:text-white transition-all">
                            <FileText size={16} />
                          </div>
                          <span className="text-[7px] font-black text-blue-600 uppercase tracking-tighter">Editar</span>
                        </button>

                        <button 
                          onClick={() => handleDeleteLoan(loan.id)}
                          className="flex flex-col items-center gap-1 group/btn"
                        >
                          <div className="p-2 bg-red-50 text-red-400 rounded-lg group-hover/btn:bg-red-500 group-hover/btn:text-white transition-all">
                            <AlertCircle size={16} />
                          </div>
                          <span className="text-[7px] font-black text-red-400 uppercase tracking-tighter">Excluir</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeSubTab === 'payments' && (
          <div className="space-y-6 relative z-10">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-black text-blue-800 uppercase tracking-tighter">Extrato de Pagamentos</h3>
              <button 
                onClick={() => setShowPaymentModal(true)}
                className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-blue-100 hover:bg-blue-700 transition-all"
              >
                <Plus size={16} /> Novo Pagamento
              </button>
            </div>

            {myPayments.length === 0 ? (
              <div className="py-20 text-center bg-blue-50/30 rounded-[2rem] border-2 border-dashed border-blue-100">
                <DollarSign size={48} className="mx-auto text-blue-200 mb-4" />
                <p className="text-blue-400 font-black uppercase tracking-widest text-[10px]">Nenhum pagamento registrado.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-[10px] font-black text-blue-300 uppercase tracking-widest border-b border-blue-50">
                    <tr>
                      <th className="py-4 px-6 text-left">Data</th>
                      <th className="py-4 px-6 text-left">Cliente</th>
                      <th className="py-4 px-6 text-left">Tipo</th>
                      <th className="py-4 px-6 text-right">Valor</th>
                      <th className="py-4 px-6 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-blue-50/50">
                    {myPayments.sort((a: any, b: any) => new Date(b.dataPagamento).getTime() - new Date(a.dataPagamento).getTime()).map(payment => {
                      const loan = myLoans.find(l => l.id === payment.loanId);
                      const client = myClients.find(c => c.id === loan?.clientId);
                      return (
                        <tr key={payment.id} className="hover:bg-blue-50/20 transition-colors">
                          <td className="py-4 px-6 text-xs font-bold text-blue-900">{new Date(payment.dataPagamento).toLocaleDateString('pt-BR')}</td>
                          <td className="py-4 px-6 text-xs font-black text-blue-800">{client?.nome || 'N/A'}</td>
                          <td className="py-4 px-6">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${payment.tipo === 'juros' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                              {payment.tipo}
                            </span>
                          </td>
                          <td className="py-4 px-6 text-right text-sm font-black text-blue-700">{formatCurrency(payment.valor)}</td>
                          <td className="py-4 px-6 text-right">
                            <button onClick={() => handleDeletePayment(payment.id)} className="text-blue-200 hover:text-red-500 transition-colors">
                              <AlertCircle size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL NOVO CLIENTE */}
      {/* ... (código anterior do modal de cliente) ... */}

      {/* MODAL NOVO EMPRÉSTIMO */}
      {showLoanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-900/40 backdrop-blur-md p-4">
          <div className="bg-white p-6 rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><FileText size={24} /></div>
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">
                {editingLoanId ? 'Editar Empréstimo' : 'Novo Empréstimo'}
              </h3>
            </div>
            
            <form onSubmit={handleAddLoan} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Selecionar Cliente</label>
                <select 
                  required 
                  disabled={!!editingLoanId}
                  className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none appearance-none disabled:opacity-50"
                  value={loanForm.clientId}
                  onChange={e => setLoanForm({...loanForm, clientId: e.target.value})}
                >
                  <option value="">Escolha um cliente...</option>
                  {myClients.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Valor Principal</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="R$ 0,00" 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={loanForm.valorPrincipal || ''} 
                    onChange={e => setLoanForm({...loanForm, valorPrincipal: parseFloat(e.target.value)})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Juros Mensal (%)</label>
                  <input 
                    type="number" 
                    step="0.1"
                    required 
                    placeholder="10%" 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={loanForm.porcentagemJurosMensal || ''} 
                    onChange={e => setLoanForm({...loanForm, porcentagemJurosMensal: parseFloat(e.target.value)})} 
                  />
                </div>
              </div>

              {loanForm.valorPrincipal > 0 && loanForm.porcentagemJurosMensal > 0 && (
                <div className="bg-green-50/50 p-3 rounded-2xl flex justify-between items-center border border-green-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Valor dos Juros</span>
                    <span className="text-[9px] text-green-500 font-bold">({formatCurrency(loanForm.valorPrincipal)} x {loanForm.porcentagemJurosMensal}%)</span>
                  </div>
                  <span className="text-xl font-black text-green-700">
                    {formatCurrency((loanForm.valorPrincipal * loanForm.porcentagemJurosMensal) / 100)}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Data do Empréstimo</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={loanForm.dataEmprestimo} 
                    onChange={e => setLoanForm({...loanForm, dataEmprestimo: e.target.value})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Data do Pagamento dos Juros</label>
                  <input 
                    type="date" 
                    required 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={loanForm.dataPagamentoJuros} 
                    onChange={e => setLoanForm({...loanForm, dataPagamentoJuros: e.target.value})} 
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => { setShowLoanModal(false); setEditingLoanId(null); }} 
                  className="flex-1 p-3 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 p-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 border-b-4 border-blue-800 hover:bg-blue-700 transition-all"
                >
                  {editingLoanId ? 'Salvar Alterações' : 'Criar Empréstimo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL NOVO PAGAMENTO */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-blue-900/40 backdrop-blur-md p-4">
          <div className="bg-white p-6 rounded-[2rem] w-full max-w-md shadow-2xl animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-xl"><DollarSign size={24} /></div>
              <h3 className="text-xl font-black text-blue-900 uppercase tracking-tighter">Novo Pagamento</h3>
            </div>
            
            <form onSubmit={handleAddPayment} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Selecionar Empréstimo</label>
                <select 
                  required 
                  className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none appearance-none"
                  value={paymentForm.loanId}
                  onChange={e => setPaymentForm({...paymentForm, loanId: e.target.value})}
                >
                  <option value="">Escolha um empréstimo...</option>
                  {myLoans.map(l => {
                    const client = myClients.find(c => c.id === l.clientId);
                    return <option key={l.id} value={l.id}>{client?.nome} - {formatCurrency(l.valorPrincipal)}</option>;
                  })}
                </select>
              </div>

              {paymentForm.loanId && (
                <div className="bg-green-50/50 p-3 rounded-2xl flex justify-between items-center border border-green-100 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black text-green-600 uppercase tracking-widest">Juros Mensal</span>
                    {(() => {
                      const loan = myLoans.find(l => l.id === paymentForm.loanId);
                      return loan ? (
                        <span className="text-[9px] text-green-500 font-bold">
                          ({formatCurrency(loan.valorPrincipal)} x {loan.porcentagemJurosMensal}%)
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <span className="text-xl font-black text-green-700">
                    {(() => {
                      const loan = myLoans.find(l => l.id === paymentForm.loanId);
                      return loan ? formatCurrency((loan.valorPrincipal * loan.porcentagemJurosMensal) / 100) : 'R$ 0,00';
                    })()}
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Valor</label>
                  <input 
                    type="number" 
                    required 
                    placeholder="R$ 0,00" 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                    value={paymentForm.valor || ''} 
                    onChange={e => setPaymentForm({...paymentForm, valor: parseFloat(e.target.value)})} 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Tipo</label>
                  <select 
                    required 
                    className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none appearance-none"
                    value={paymentForm.tipo}
                    onChange={e => setPaymentForm({...paymentForm, tipo: e.target.value as any})}
                  >
                    <option value="juros">Juros</option>
                    <option value="amortizacao">Amortização</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Data do Pagamento</label>
                <input 
                  type="date" 
                  required 
                  className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                  value={paymentForm.dataPagamento} 
                  onChange={e => setPaymentForm({...paymentForm, dataPagamento: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-blue-400 uppercase ml-2 tracking-widest">Observação</label>
                <input 
                  placeholder="Opcional..." 
                  className="w-full p-3 bg-blue-50/50 rounded-2xl border-2 border-transparent focus:border-blue-200 focus:bg-white transition-all font-bold text-blue-900 outline-none" 
                  value={paymentForm.observacao} 
                  onChange={e => setPaymentForm({...paymentForm, observacao: e.target.value})} 
                />
              </div>

              {paymentForm.tipo === 'juros' && (
                <div className="flex items-center gap-3 p-3 bg-amber-50/50 rounded-2xl border border-amber-100">
                  <input 
                    type="checkbox" 
                    id="avancarVencimento"
                    className="w-5 h-5 rounded-lg border-2 border-amber-200 text-amber-600 focus:ring-amber-500 transition-all cursor-pointer"
                    checked={paymentForm.avancarVencimento}
                    onChange={e => setPaymentForm({...paymentForm, avancarVencimento: e.target.checked})}
                  />
                  <label htmlFor="avancarVencimento" className="text-[10px] font-black text-amber-700 uppercase tracking-widest cursor-pointer select-none">
                    Avançar vencimento para o próximo mês
                  </label>
                </div>
              )}

              <div className="flex gap-4 pt-4">
                <button 
                  type="button" 
                  onClick={() => setShowPaymentModal(false)} 
                  className="flex-1 p-3 bg-slate-100 text-slate-400 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="flex-1 p-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg shadow-blue-100 border-b-4 border-blue-800 hover:bg-blue-700 transition-all"
                >
                  Registrar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThirdPartyModule;
