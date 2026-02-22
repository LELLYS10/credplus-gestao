
import React from 'react';
import { Client, Group, User, UserRole } from '../types';
import { formatCurrency } from '../utils';
import { Search, ChevronRight, Users } from 'lucide-react';

interface ClientsListProps {
  user: User;
  clients: Client[];
  groups: Group[];
  onViewClient: (id: string) => void;
}

const ClientsList: React.FC<ClientsListProps> = ({ user, clients, groups, onViewClient }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filtered = React.useMemo(() => {
    let list = clients.filter(c => c.status === 'ACTIVE');
    if (user.role === UserRole.VIEWER) {
      list = list.filter(c => c.groupId === user.groupId);
    }
    if (searchTerm) {
      list = list.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [clients, user, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h2 className="text-2xl font-black tracking-tighter flex items-center gap-3">
          <div className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
            <Users size={28} />
          </div>
          Carteira de Clientes
        </h2>
        <div className="relative w-full md:w-80">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            placeholder="Buscar por nome..." 
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl font-medium focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all outline-none"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
        {filtered.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
             <Users size={40} className="mx-auto mb-3 opacity-10" />
             <p className="font-black uppercase tracking-widest text-[10px]">Nenhum cliente encontrado.</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                    <th className="py-4 px-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Sócio</th>
                    <th className="py-4 px-6 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Vencimento</th>
                    <th className="py-4 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Capital</th>
                    <th className="py-4 px-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filtered.map(client => (
                    <tr 
                      key={client.id} 
                      className="hover:bg-emerald-50/30 transition-colors cursor-pointer group"
                      onClick={() => onViewClient(client.id)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center font-black text-xs">
                            {client.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-black text-slate-800 tracking-tight group-hover:text-emerald-700 transition-colors">{client.name}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {groups.find(g => g.id === client.groupId)?.name || 'N/A'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="bg-emerald-50 text-emerald-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                          Dia {client.dueDay}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <span className="font-black text-slate-800">{formatCurrency(client.currentCapital)}</span>
                      </td>
                      <td className="py-4 px-6 text-right">
                        <div className="flex justify-end">
                          <ChevronRight size={18} className="text-slate-300 group-hover:text-emerald-500 transform group-hover:translate-x-1 transition-all" />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {filtered.map(client => (
                <div 
                  key={client.id} 
                  className="p-4 space-y-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onViewClient(client.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-sm">
                        {client.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-800 tracking-tight">{client.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                          {groups.find(g => g.id === client.groupId)?.name || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={20} className="text-slate-300" />
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-black">Vencimento</p>
                      <p className="text-xs font-black text-emerald-600">Dia {client.dueDay}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 uppercase font-black">Capital</p>
                      <p className="text-sm font-black text-slate-900">{formatCurrency(client.currentCapital)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ClientsList;
