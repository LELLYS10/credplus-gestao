import React, { useState, useEffect } from 'react';
import { Client, Competence, Group, User, UserRole, UserGroupType, PaymentRequest, RequestStatus, AppSettings, getUserPermissions } from '../types';
import { formatCurrency, getToday, getEffectiveDueDay } from '../utils';
import { TrendingUp, AlertCircle, Clock, CheckCircle2, ChevronRight, DollarSign, AlertTriangle, X, ArrowRight, Calendar, Bot, Sparkles } from 'lucide-react';

interface DashboardProps {
  user: User | null;
  clients: Client[];
  competences: Competence[];
  groups: Group[];
  settings: AppSettings;
  onViewClient: (clientId: string) => void;
  onSyncCloud?: () => Promise<void>;
  pendingRequests?: PaymentRequest[];
  onViewRequests?: () => void;
  onPayOverdue?: (clientId: string, amount: number) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ user, clients, competences, groups, settings, onViewClient, onSyncCloud, pendingRequests = [], onViewRequests, onPayOverdue }) => {
  const [showOverdueModal, setShowOverdueModal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [payingClientId, setPayingClientId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const { day: todayDay, month: todayMonth, year: todayYear } = getToday();
  const todayDate = new Date(todayYear, todayMonth, todayDay);
  todayDate.setHours(0, 0, 0, 0);
  const tomorrowDate = new Date(todayYear, todayMonth, todayDay + 1);
  tomorrowDate.setHours(0, 0, 0, 0);

  // FILTRO PRIVACIDADE: Garante que o sócio não veja nada de outros sócios
  const filteredClients = React.useMemo(() => {
    if (!user) return [];
    if (user.role === UserRole.ADMIN) return clients.filter(c => c.status === 'ACTIVE');
    
    const userGroupId = user.groupId || groups.find(g => g.email === user.email)?.id;
    return clients.filter(c => c.status === 'ACTIVE' && c.groupId === userGroupId);
  }, [clients, user, groups]);

  const activePendingRequests = React.useMemo(() => {
    if (!user) return [];
    const userGroupId = user.groupId || groups.find(g => g.email === user.email)?.id;
    return pendingRequests.filter(r => r.status === RequestStatus.PENDING && (user.role === UserRole.ADMIN || r.groupId === userGroupId));
  }, [pendingRequests, user, groups]);

  // LÓGICA DE CLASSIFICAÇÃO AUTOMÁTICA: Distribui os clientes nos cards baseada em todas as competências pendentes
  const agenda = React.useMemo(() => {
    const overdue: (Client & { nextDate: Date })[] = [];
    const dueToday: (Client & { nextDate: Date })[] = [];
    const dueTomorrow: (Client & { nextDate: Date })[] = [];

    filteredClients.forEach(client => {
      // Filtra todas as competências pendentes do cliente
      const pendingComps = competences
        .filter(c => c.clientId === client.id && (c.originalValue - c.paidAmount) > 0.01)
        .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month));
      
      // Verifica cada competência para ver em qual card o cliente se encaixa
      // Um cliente pode aparecer em mais de um card se tiver múltiplas pendências (ex: uma vencida e uma hoje)
      let addedToOverdue = false;
      let addedToToday = false;
      let addedToTomorrow = false;

      pendingComps.forEach(comp => {
        const dDate = comp.dueDate 
          ? new Date(comp.dueDate) 
          : new Date(comp.year, comp.month, getEffectiveDueDay(client.dueDay, comp.month, comp.year));
        
        dDate.setHours(0, 0, 0, 0);
        const clientWithDate = { ...client, nextDate: dDate };

        const dTime = dDate.getTime();
        const todayTime = todayDate.getTime();
        const tomorrowTime = tomorrowDate.getTime();

        if (todayTime > dTime) {
          if (!addedToOverdue) {
            overdue.push(clientWithDate);
            addedToOverdue = true;
          }
        } else if (todayTime === dTime) {
          if (!addedToToday) {
            dueToday.push(clientWithDate);
            addedToToday = true;
          }
        } else if (tomorrowTime === dTime) {
          if (!addedToTomorrow) {
            dueTomorrow.push(clientWithDate);
            addedToTomorrow = true;
          }
        }
      });
    });

    return { overdue, dueToday, dueTomorrow };
  }, [filteredClients, competences, todayDate, tomorrowDate]);

  const criticalOverdueClients = agenda.overdue;

  useEffect(() => {
    if (criticalOverdueClients.length > 0 && user?.role === UserRole.ADMIN) {
      setShowOverdueModal(true);
    } else {
      setShowOverdueModal(false);
    }
  }, [criticalOverdueClients.length, user]);

  const stats = React.useMemo(() => {
    const totalCapital = filteredClients.reduce((acc, c) => acc + c.currentCapital, 0);
    const overdueInterest = competences
      .filter(comp => {
        const client = filteredClients.find(c => c.id === comp.clientId);
        if (!client) return false;
        const dDate = comp.dueDate 
          ? new Date(comp.dueDate) 
          : new Date(comp.year, comp.month, getEffectiveDueDay(client.dueDay, comp.month, comp.year));
        
        dDate.setHours(0, 0, 0, 0);
        // Ajuste de precisão: garante que qualquer data anterior a hoje (00:00) seja considerada atrasada
        return dDate.getTime() < todayDate.getTime() && (comp.originalValue - comp.paidAmount) > 0.01;
      })
      .reduce((acc, comp) => acc + (comp.originalValue - comp.paidAmount), 0);

    const dueTodayInterest = competences
      .filter(comp => {
        const client = filteredClients.find(c => c.id === comp.clientId);
        if (!client) return false;
        const dDate = comp.dueDate 
          ? new Date(comp.dueDate) 
          : new Date(comp.year, comp.month, getEffectiveDueDay(client.dueDay, comp.month, comp.year));
        
        dDate.setHours(0, 0, 0, 0);
        return dDate.getTime() === todayDate.getTime() && (comp.originalValue - comp.paidAmount) > 0.01;
      })
      .reduce((acc, comp) => acc + (comp.originalValue - comp.paidAmount), 0);

    const receivedThisMonth = competences
      .filter(comp => {
        const isClientRelevant = filteredClients.some(c => c.id === comp.clientId);
        return isClientRelevant && comp.lastUpdated >= new Date(todayYear, todayMonth, 1).getTime();
      })
      .reduce((acc, comp) => acc + comp.paidAmount, 0);

    const dueTomorrowInterest = competences
      .filter(comp => {
        const client = filteredClients.find(c => c.id === comp.clientId);
        if (!client) return false;
        const dDate = comp.dueDate 
          ? new Date(comp.dueDate) 
          : new Date(comp.year, comp.month, getEffectiveDueDay(client.dueDay, comp.month, comp.year));
        
        dDate.setHours(0, 0, 0, 0);
        return dDate.getTime() === tomorrowDate.getTime() && (comp.originalValue - comp.paidAmount) > 0.01;
      })
      .reduce((acc, comp) => acc + (comp.originalValue - comp.paidAmount), 0);

    return { totalCapital, overdueInterest, dueTodayInterest, dueTomorrowInterest, receivedThisMonth };
  }, [filteredClients, competences, todayDate, tomorrowDate, todayMonth, todayYear, todayDay]);
  // Comissão para Grupo B
  const perms = user ? getUserPermissions(user) : null;
  const userGroup = user ? groups.find((g: any) => g.id === user.groupId || g.email === user.email) : null;
  const commissionRate = userGroup?.commissionRate ?? 0;
  const commissionParcial = (perms?.canViewCommission && !perms?.isAdmin)
    ? stats.receivedThisMonth * (commissionRate / 100)
    : 0;
  const commissionTotal = (perms?.canViewCommission && !perms?.isAdmin)
    ? competences.filter(comp => filteredClients.some(cl => cl.id === comp.clientId) && comp.paidAmount > 0).reduce((acc, comp) => acc + comp.paidAmount, 0) * (commissionRate / 100)
    : 0;

  const StatCard = ({ title, value, icon: Icon, colorClass, highlight, highlightColor = 'red', dark, onClick }: any) => (
    <div 
      onClick={onClick}
      className={`p-4 md:p-5 lg:p-3.5 xl:p-4 rounded-2xl border transition-all duration-300 shadow-sm flex items-center gap-3 lg:gap-3 cursor-pointer group w-full min-w-0 overflow-hidden ${
        dark 
        ? 'bg-slate-900 border-slate-800 shadow-xl shadow-slate-900/20' 
        : 'bg-white border-slate-100 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-500/5'
      } ${
        highlight 
        ? (highlightColor === 'blue' ? 'border-blue-400 ring-4 ring-blue-50' : 'border-red-400 ring-4 ring-red-50 animate-pulse-subtle')
        : ''
      }`}
    >
      <div className={`p-2.5 md:p-3 lg:p-1.5 xl:p-3 rounded-xl shrink-0 transition-transform group-hover:scale-110 ${colorClass}`}>
        <Icon size={18} className="md:w-5 md:h-5 lg:w-5 lg:h-5 xl:w-6 xl:h-6" />
      </div>
      <div className="min-w-0 flex-1 flex flex-col justify-center">
        <p className={`text-[10px] md:text-[11px] lg:text-[9px] xl:text-[11px] font-black uppercase tracking-widest leading-tight mb-0.5 ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{title}</p>
        <p className={`text-sm sm:text-base md:text-lg lg:text-sm xl:text-xl font-black tracking-tight break-words ${highlight ? (highlightColor === 'blue' ? 'text-blue-600' : 'text-red-600') : (dark ? 'text-white' : 'text-slate-900')}`}>
          {formatCurrency(value)}
        </p>
      </div>
    </div>
  );

  const ClientAgendaCard = ({ client, colorClass, subtitle }: { client: Client & { nextDate: Date }, colorClass: string, subtitle: string }) => {
    const pendingValue = competences
      .filter(c => c.clientId === client.id && (c.originalValue - c.paidAmount) > 0.01)
      .reduce((acc, c) => acc + (c.originalValue - c.paidAmount), 0);

    return (
      <div 
        key={client.id} 
        className="flex items-center justify-between p-4 bg-white rounded-2xl border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all cursor-pointer group w-full min-w-0 overflow-hidden" 
        onClick={() => onViewClient(client.id)}
      >
        <div className="min-w-0 flex-1 mr-2">
          <h4 className="font-black text-slate-800 group-hover:text-emerald-700 transition-colors text-sm leading-tight">{client.name}</h4>
          <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{client.nextDate.toLocaleDateString('pt-BR')}</p>
        </div>
        <div className="text-right shrink-0">
          <p className={`font-black text-sm whitespace-nowrap ${colorClass}`}>{formatCurrency(pendingValue)}</p>
          <div className="flex justify-end mt-0.5">
            <ChevronRight size={12} className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
          </div>
        </div>
      </div>
    );
  };

  const handleSync = async () => {
    if (!onSyncCloud) return;
    setIsSyncing(true);
    try {
      await onSyncCloud();
      alert("✅ Sincronização concluída com sucesso!");
    } catch (error) {
      console.error(error);
      alert("❌ Erro ao sincronizar dados.");
    } finally {
      setIsSyncing(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* PAINEL DASHBOARD VISÍVEL PARA TODOS (FILTRADO POR PRIVACIDADE) */}
      <div className="space-y-4">
        {user.role === UserRole.ADMIN && (
          <div className="flex justify-end">
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border-b-4 ${
                isSyncing 
                ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' 
                : 'bg-white text-emerald-600 border-emerald-100 hover:bg-emerald-50 shadow-sm'
              }`}
            >
              <TrendingUp size={14} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Sincronizando...' : 'Sincronizar com Nuvem'}
            </button>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-2 xl:gap-4">
          <StatCard title="Capital Emprestado" value={stats.totalCapital} icon={TrendingUp} colorClass="bg-emerald-500/20 text-emerald-400" dark />
          <StatCard 
            title="Juros Atrasados" 
            value={stats.overdueInterest} 
            icon={AlertCircle} 
            colorClass="bg-red-500 text-white shadow-lg shadow-red-200" 
            highlight={stats.overdueInterest > 0} 
            onClick={() => stats.overdueInterest > 0 && setShowOverdueModal(true)}
          />
          <StatCard 
            title="Vence Hoje" 
            value={stats.dueTodayInterest} 
            icon={Clock} 
            colorClass="bg-amber-400 text-amber-950 shadow-lg shadow-amber-100" 
            highlight={stats.dueTodayInterest > 0} 
            highlightColor="blue"
          />
          <StatCard 
            title="Vence Amanhã" 
            value={stats.dueTomorrowInterest} 
            icon={Calendar} 
            colorClass="bg-blue-100 text-blue-600" 
            highlight={stats.dueTomorrowInterest > 0}
            highlightColor="blue"
          />
          <StatCard title="Recebido no Mês" value={stats.receivedThisMonth} icon={CheckCircle2} colorClass="bg-green-100 text-green-600" />
              {perms?.canViewCommission && !perms?.isAdmin && (
                <StatCard title={`Comissão Mês (${commissionRate}%)`} value={commissionParcial} icon={DollarSign} colorClass="bg-purple-100 text-purple-600" />
              )}
              {perms?.canViewCommission && !perms?.isAdmin && (
                <StatCard title="Comissão Total Acum." value={commissionTotal} icon={DollarSign} colorClass="bg-indigo-100 text-indigo-600" />
              )}
        </div>
      </div>

      {showOverdueModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-emerald-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border-b-8 border-red-200 animate-in zoom-in duration-300">
            <div className="bg-red-600 p-8 text-white relative">
              <button onClick={() => setShowOverdueModal(false)} className="absolute top-6 right-6 p-2 hover:bg-white/20 rounded-full transition-colors"><X size={24}/></button>
              <div className="flex items-center gap-4 mb-2">
                <div className="p-3 bg-white/20 rounded-2xl border border-white/30"><AlertTriangle size={32}/></div>
                <h3 className="text-2xl font-black uppercase tracking-tighter">Clientes Vencidos</h3>
              </div>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {criticalOverdueClients.map(client => {
                const pendingAmt = competences.filter(c => c.clientId === client.id && (c.originalValue - c.paidAmount) > 0.01).reduce((acc, c) => acc + (c.originalValue - c.paidAmount), 0);
                const isPaying = payingClientId === client.id;
                return (
                  <div key={client.id} className="bg-slate-50 rounded-2xl border border-slate-100 hover:border-red-200 transition-all">
                    <div className="flex items-center justify-between p-4">
                      <div className="min-w-0 flex-1">
                        <h4 className="font-black text-slate-800">{client.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Vencimento: {client.nextDate.toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <p className="font-black text-red-600 text-sm mr-1">{formatCurrency(pendingAmt)}</p>
                        <button
                          onClick={() => { setPayingClientId(isPaying ? null : client.id); setPayAmount(pendingAmt.toFixed(2).replace('.', ',')); }}
                          className="px-3 py-2 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase hover:bg-emerald-600 transition-all flex items-center gap-1"
                        ><DollarSign size={13} /> Pagar</button>
                        <button
                          onClick={() => { setShowOverdueModal(false); onViewClient(client.id); }}
                          className="p-2 bg-white text-red-600 rounded-xl shadow-sm border border-red-100 hover:bg-red-600 hover:text-white transition-all"
                        ><ArrowRight size={16} /></button>
                      </div>
                    </div>
                    {isPaying && (
                      <div className="px-4 pb-4">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2">
                          <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Registrar Pagamento</p>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={payAmount}
                              onChange={e => setPayAmount(e.target.value)}
                              placeholder="Valor (ex: 60,00)"
                              className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                            />
                            <button
                              onClick={() => {
                                const amt = parseFloat(payAmount.replace(',', '.'));
                                if (!amt || amt <= 0) { alert('Valor inválido.'); return; }
                                if (onPayOverdue) onPayOverdue(client.id, amt);
                                setPayingClientId(null);
                                setPayAmount('');
                                if (criticalOverdueClients.length <= 1) setShowOverdueModal(false);
                              }}
                              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-black uppercase hover:bg-emerald-700 transition-all"
                            >OK</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {user.role === UserRole.ADMIN && activePendingRequests.length > 0 && (
        <div 
          onClick={onViewRequests}
          className="bg-amber-400 rounded-[2.5rem] p-8 text-amber-950 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl border-b-8 border-amber-600 cursor-pointer hover:scale-[1.01] transition-all animate-bounce-subtle"
        >
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-white/40 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/50 shadow-inner">
              <AlertTriangle size={32} className="text-amber-900" />
            </div>
            <div>
              <h3 className="text-2xl font-black tracking-tighter uppercase leading-none">Atenção: Pagamentos Pendentes</h3>
              <p className="text-amber-900/70 mt-1 font-bold uppercase text-[10px] tracking-widest">Existem sinalizações de sócios aguardando sua conferência</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white/50 rounded-2xl px-8 py-4 border-b-4 border-white/30 flex items-center gap-3">
              <span className="font-black text-4xl text-amber-950">{activePendingRequests.length}</span>
              <span className="text-[10px] uppercase font-black tracking-widest text-amber-900 leading-tight">Solicitações<br/>para Validar</span>
            </div>
            <div className="w-12 h-12 bg-amber-950 text-white rounded-full flex items-center justify-center shadow-lg">
              <ArrowRight size={24} />
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-red-500 rounded-full"></span> Vencidos
            </h3>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { message: 'Quem são os clientes vencidos?' } }))}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 hover:text-emerald-700 transition-all"
            >
              <Bot size={12} /> Consultar IA
            </button>
          </div>
          <div className="space-y-3">{agenda.overdue.length === 0 ? <p className="text-center text-slate-400 py-10 bg-white rounded-3xl border border-dashed border-slate-300 text-[10px] font-black uppercase tracking-widest">Tudo em dia!</p> : agenda.overdue.map(c => <div key={c.id}><ClientAgendaCard client={c} colorClass="text-red-600" subtitle={`Vencido`} /></div>)}</div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-amber-500 rounded-full"></span> Vence Hoje
            </h3>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { message: 'Quem vence hoje?' } }))}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 hover:text-emerald-700 transition-all"
            >
              <Bot size={12} /> Consultar IA
            </button>
          </div>
          <div className="space-y-3">{agenda.dueToday.length === 0 ? <p className="text-center text-slate-400 py-10 bg-white rounded-3xl border border-dashed border-slate-300 text-[10px] font-black uppercase tracking-widest">Nada hoje.</p> : agenda.dueToday.map(c => <div key={c.id}><ClientAgendaCard client={c} colorClass="text-amber-600" subtitle="Pagamento Hoje" /></div>)}</div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <h3 className="font-black text-sm uppercase tracking-widest text-slate-500 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full"></span> Vence Amanhã
            </h3>
            <button 
              onClick={() => window.dispatchEvent(new CustomEvent('open-ai', { detail: { message: 'Quem vence amanhã?' } }))}
              className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-emerald-100 hover:text-emerald-700 transition-all"
            >
              <Bot size={12} /> Consultar IA
            </button>
          </div>
          <div className="space-y-3">{agenda.dueTomorrow.length === 0 ? <p className="text-center text-slate-400 py-10 bg-white rounded-3xl border border-dashed border-slate-300 text-[10px] font-black uppercase tracking-widest italic">Livre para amanhã.</p> : agenda.dueTomorrow.map(c => <div key={c.id}><ClientAgendaCard client={c} colorClass="text-emerald-600" subtitle="Vence Amanhã" /></div>)}</div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
