
import React from 'react';
import { PaymentRequest, Client, User, UserRole, RequestStatus, Group } from '../types';
import { formatCurrency } from '../utils';
// Fixed: Added CheckSquare to the lucide-react imports
import { Check, X, Search, User as UserIcon, CheckSquare } from 'lucide-react';

interface RequestsListProps {
  user: User;
  requests: PaymentRequest[];
  clients: Client[];
  groups: Group[]; 
  onAction: (requestId: string, action: RequestStatus) => void;
}

const RequestsList: React.FC<RequestsListProps> = ({ user, requests, clients, groups, onAction }) => {
  const [filter, setFilter] = React.useState<RequestStatus | 'ALL'>(RequestStatus.PENDING);

  const filteredRequests = React.useMemo(() => {
    let list = requests;
    if (user.role === UserRole.VIEWER) {
      list = list.filter(r => r.groupId === user.groupId);
    }
    if (filter !== 'ALL') {
      list = list.filter(r => r.status === filter);
    }
    return [...list].sort((a, b) => b.createdAt - a.createdAt);
  }, [requests, user, filter]);

  const RequestCard: React.FC<{ req: PaymentRequest }> = ({ req }) => {
    const client = clients.find(c => c.id === req.clientId);
    const partner = groups.find(g => g.id === req.groupId);
    const date = new Date(req.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    return (
      <div className={`bg-white p-6 rounded-[2rem] border transition-all ${req.status === RequestStatus.PENDING ? 'border-amber-400 shadow-xl shadow-amber-50' : 'border-slate-100 shadow-sm opacity-90'}`}>
        <div className="flex justify-between items-start mb-4">
          <div className="space-y-1">
            <h4 className="text-lg font-black text-slate-800 leading-tight tracking-tight">{client?.name || 'Cliente Desconhecido'}</h4>
            <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded uppercase tracking-widest border border-emerald-100">
              <UserIcon size={12} /> Sócio: {partner?.name || 'Sistema'}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-xl text-[9px] font-black tracking-widest uppercase border-b-2 ${
            req.status === RequestStatus.PENDING ? 'bg-amber-100 text-amber-700 border-amber-300' :
            req.status === RequestStatus.CONFIRMED ? 'bg-emerald-100 text-emerald-700 border-emerald-300' :
            'bg-red-100 text-red-700 border-red-300'
          }`}>
            {req.status === RequestStatus.PENDING ? 'Pendente' :
             req.status === RequestStatus.CONFIRMED ? 'Baixado' : 'Recusado'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-50 mb-4 bg-slate-50/50 rounded-xl px-2">
          <div>
            <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Juros</p>
            <p className="text-sm font-black text-slate-800 tracking-tight">{formatCurrency(req.interestValue)}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Abatimento</p>
            <p className="text-sm font-black text-amber-600 tracking-tight">{formatCurrency(req.discountValue || 0)}</p>
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-black uppercase mb-1 tracking-widest">Amortiz.</p>
            <p className="text-sm font-black text-emerald-600 tracking-tight">{formatCurrency(req.amortizationValue)}</p>
          </div>
        </div>

        {req.observation && (
          <div className="bg-emerald-50/30 p-3 rounded-2xl mb-4 border border-emerald-50">
             <p className="text-[9px] font-black text-emerald-600 uppercase mb-1 tracking-widest">Nota do Sócio:</p>
             <p className="text-sm text-slate-700 font-medium italic">"{req.observation}"</p>
          </div>
        )}

        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest mb-4">Sinalizado em {date}</p>

        {user.role === UserRole.ADMIN && req.status === RequestStatus.PENDING && (
          <div className="flex gap-3">
            <button
              onClick={() => onAction(req.id, RequestStatus.REJECTED)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-red-100 text-red-600 font-black hover:bg-red-50 transition-all text-xs tracking-widest uppercase"
            >
              <X size={16} /> Recusar
            </button>
            <button
              onClick={() => onAction(req.id, RequestStatus.CONFIRMED)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-black hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 text-xs tracking-widest uppercase border-b-4 border-emerald-800"
            >
              <Check size={16} /> Dar Baixa
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
            <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
              <CheckSquare size={28} />
            </div>
            {user.role === UserRole.ADMIN ? 'Fila de Validação Bancária' : 'Meus Avisos de Pagamento'}
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-2 px-1">
            {user.role === UserRole.ADMIN 
              ? 'Confirme o recebimento real antes de liquidar.' 
              : 'Lista de envios para conferência do administrador.'}
          </p>
        </div>
        <div className="flex bg-slate-200/50 p-1.5 rounded-2xl border border-slate-200">
          {(['ALL', RequestStatus.PENDING, RequestStatus.CONFIRMED, RequestStatus.REJECTED] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest uppercase transition-all ${
                filter === s ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:text-emerald-700'
              }`}
            >
              {s === 'ALL' ? 'Todos' : s === RequestStatus.PENDING ? 'Pendentes' : s === RequestStatus.CONFIRMED ? 'Baixados' : 'Recusados'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredRequests.length === 0 ? (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
            <Search size={48} className="mb-4 opacity-10" />
            <p className="font-black uppercase tracking-widest text-xs">Nenhuma sinalização encontrada.</p>
          </div>
        ) : (
          filteredRequests.map(r => <RequestCard key={r.id} req={r} />)
        )}
      </div>
    </div>
  );
};

export default RequestsList;
