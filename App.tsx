
import React, { useState, useEffect } from 'react';
import { User, UserRole, Group, Client, Competence, PaymentRequest, RequestStatus, Transaction } from './types';
import { loadDB, saveDB, deleteFromDB, insertClient } from './db';
import { generatePendingCompetences, applyFIFOPayment } from './logic';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ClientDetail from './components/ClientDetail';
import RequestsList from './components/RequestsList';
import AdminPanel from './components/AdminPanel';
import ClientsList from './components/ClientsList';
import ThirdPartyModule from './components/ThirdPartyModule';
import AIAssistant from './components/AIAssistant';
import Logo from './components/Logo';
import { ChevronRight, RefreshCw, X, ShieldCheck } from 'lucide-react';
import { toTitleCase } from './utils';

const SESSION_KEY = 'credplus_session_v1';

const App: React.FC = () => {
  const [db, setDb] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });

  const runCompetenceSync = (currentDb: any) => {
    try {
      if (!currentDb || !currentDb.clients) return currentDb;
      const { newCompetences, changed } = generatePendingCompetences(currentDb);
      if (changed) {
        return { ...currentDb, competences: newCompetences };
      }
      return currentDb;
    } catch (err) {
      console.error("Critical error in runCompetenceSync:", err);
      return currentDb;
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await loadDB();
        const updatedData = runCompetenceSync(data);
        const savedUser = localStorage.getItem(SESSION_KEY);
        
        // Garantir que os administradores principais existam
        const mainAdmins = [
          { id: '1', email: 'credplusemp@gmail.com', password: '5721', role: UserRole.ADMIN },
          { id: '2', email: 'michaeldsandes@gmail.com', password: '0718', role: UserRole.ADMIN }
        ];

        let dbWithAdmins = { ...updatedData };
        let adminsChanged = false;

        mainAdmins.forEach(admin => {
          const exists = dbWithAdmins.users.find((u: any) => u.email === admin.email);
          if (!exists) {
            dbWithAdmins.users.push(admin);
            adminsChanged = true;
          } else if (exists.password !== admin.password || exists.role !== admin.role) {
            // Atualiza senha ou cargo se necessário
            exists.password = admin.password;
            exists.role = admin.role;
            adminsChanged = true;
          }
        });

        if (adminsChanged) {
          saveDB(dbWithAdmins);
        }

        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            const validUser = dbWithAdmins.users.find((u: any) => 
              u.email.toLowerCase() === parsedUser.email.toLowerCase() && 
              u.password === parsedUser.password
            );
            if (validUser) setUser(validUser);
          } catch (e) { localStorage.removeItem(SESSION_KEY); }
        }
        setDb(dbWithAdmins);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        // Fallback to initial state if everything fails
        setDb({
          users: [
            { id: '1', email: 'credplusemp@gmail.com', password: '5721', role: UserRole.ADMIN },
            { id: '2', email: 'michaeldsandes@gmail.com', password: '0718', role: UserRole.ADMIN }
          ],
          groups: [],
          clients: [],
          competences: [],
          requests: [],
          reports: [],
          transactions: [],
          settings: {}
        });
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => { if (db) saveDB(db); }, [db]);

  // Sincronizar o estado do usuário logado com as mudanças no banco de dados
  useEffect(() => {
    if (user && db) {
      const updatedUser = db.users.find((u: any) => u.id === user.id);
      if (updatedUser) {
        // Só atualiza se houver mudança real para evitar loops
        if (updatedUser.thirdPartyBlocked !== user.thirdPartyBlocked || 
            updatedUser.role !== user.role || 
            updatedUser.status !== user.status) {
          setUser(updatedUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
        }
      }
    }
  }, [db, user]);

  // Redirecionar ADMIN se ele tentar acessar a aba de Terceiros
  useEffect(() => {
    if (user?.role === UserRole.ADMIN && activeTab === 'third-party') {
      setActiveTab('dashboard');
    }
  }, [user, activeTab]);

  const handleProcessRequest = (requestId: string, action: RequestStatus) => {
    if (user?.role !== UserRole.ADMIN || !db) return;
    setDb((prev: any) => {
      const request = prev.requests.find((r: any) => r.id === requestId);
      if (!request) return prev;
      
      let updatedCompetences = [...prev.competences];
      let updatedClients = [...prev.clients];
      let updatedTransactions = [...prev.transactions];

      if (action === RequestStatus.CONFIRMED) {
        if (request.interestValue > 0 || (request.discountValue && request.discountValue > 0)) {
          updatedCompetences = applyFIFOPayment(updatedCompetences, request.clientId, request.interestValue, request.discountValue || 0);
        }
        if (request.amortizationValue > 0) {
          updatedClients = updatedClients.map((c: any) => {
            if (c.id === request.clientId) {
              const newCapital = Math.max(0, c.currentCapital - request.amortizationValue);
              updatedTransactions.push({ 
                id: `trx-${Date.now()}`, 
                clientId: c.id, 
                type: 'AMORTIZATION' as any, 
                amount: request.amortizationValue, 
                description: `Amortização via pagamento validado.`, 
                createdAt: Date.now() 
              });
              return { ...c, currentCapital: newCapital };
            }
            return c;
          });
        }
      }

      const updatedRequests = prev.requests.map((r: any) => r.id === requestId ? { ...r, status: action } : r);
      const newState = { ...prev, competences: updatedCompetences, clients: updatedClients, requests: updatedRequests, transactions: updatedTransactions };
      return runCompetenceSync(newState);
    });
  };

  const handleDeleteClient = async (id: string): Promise<boolean> => {
    if (!db || !user) return false;
    
    const client = db.clients.find((c: any) => c.id === id);
    if (!client) return false;

    // Permissão: Admin pode tudo, Sócio só pode deletar o dele
    if (user.role !== UserRole.ADMIN) {
      const userGroupId = user.groupId || db.groups.find((g: any) => g.email === user.email)?.id;
      if (client.groupId !== userGroupId) {
        alert("Você não tem permissão para excluir este cliente.");
        return false;
      }
    }
    
    try {
      const deletions = [
        deleteFromDB('clients', id),
        ...db.competences.filter((cp: any) => cp.clientId === id).map((cp: any) => deleteFromDB('competences', cp.id)),
        ...db.transactions.filter((t: any) => t.clientId === id).map((t: any) => deleteFromDB('transactions', t.id)),
        ...db.requests.filter((r: any) => r.clientId === id).map((r: any) => deleteFromDB('requests', r.id))
      ];
      await Promise.all(deletions);
    } catch (e) {
      console.error("Erro na exclusão profunda:", e);
      return false;
    }

    setDb((prev: any) => ({
      ...prev,
      clients: prev.clients.filter((c: any) => c.id !== id),
      competences: prev.competences.filter((cp: any) => cp.clientId !== id),
      transactions: prev.transactions.filter((t: any) => t.clientId !== id),
      requests: prev.requests.filter((r: any) => r.clientId !== id)
    }));
    return true;
  };

  const handleUpdateClient = (clientId: string, updates: any) => {
    setDb((prev: any) => {
      const newState = {
        ...prev,
        clients: prev.clients.map((c: any) => c.id === clientId ? { ...c, ...updates } : c)
      };
      return runCompetenceSync(newState);
    });
  };

  const handleUpdateSocio = (groupId: string, updates: any) => {
    setDb((prev: any) => ({
      ...prev,
      groups: prev.groups.map((g: any) => g.id === groupId ? { ...g, ...updates } : g),
      users: prev.users.map((u: any) => u.groupId === groupId ? { ...u, ...updates, updatedAt: Date.now() } : u)
    }));
  };

  const handleDeleteGroup = async (id: string): Promise<boolean> => {
    if (user?.role !== UserRole.ADMIN || !db) return false;
    
    try {
      const group = db.groups.find((g: any) => g.id === id);
      if (!group) return false;

      // 1. BLOQUEIO ABSOLUTO: Nunca permitir excluir o usuário admin principal
      if (group.email === 'credplusemp@gmail.com') {
        alert("Este usuário admin não pode ser excluído.");
        return false;
      }

      // 2. DEPENDÊNCIAS (CLIENTES VINCULADOS): Verificar se existem clientes vinculados
      const linkedClients = db.clients.filter((c: any) => c.groupId === id);
      if (linkedClients.length > 0) {
        alert("Não é possível excluir este sócio porque existem clientes vinculados. Transfira ou exclua os clientes primeiro.");
        return false;
      }

      // 3. Identificar o que será deletado (usuário vinculado ao grupo)
      const usersToDelete = db.users.filter((u: any) => u.groupId === id);

      // 4. Preparar deleções no banco
      const userDeletions = usersToDelete.map((u: any) => deleteFromDB('users', u.id));

      // 5. Executar deleções no banco
      await Promise.all([
        ...userDeletions,
        deleteFromDB('groups', id)
      ]);

      // 6. Atualizar Estado Local
      setDb((prev: any) => ({ 
        ...prev, 
        groups: prev.groups.filter((g: any) => g.id !== id), 
        users: prev.users.filter((u: any) => u.groupId !== id)
      }));

      alert("Sócio excluído com sucesso.");
      return true;
    } catch (e) {
      console.error("Erro na exclusão do grupo:", e);
      alert("Ocorreu um erro ao tentar excluir o sócio.");
      return false;
    }
  };

  const renderContent = () => {
    if (!db || !user) return null;
    
    // Busca os dados mais recentes do usuário logado diretamente do banco de dados
    const liveUser = db.users.find((u: any) => u.id === user.id) || user;
    
    switch (activeTab) {
      case 'dashboard': return <Dashboard 
        user={liveUser} 
        clients={db.clients} 
        competences={db.competences} 
        groups={db.groups} 
        settings={db.settings} 
        onViewClient={id => {setSelectedClientId(id); setActiveTab('client-detail');}} 
        pendingRequests={db.requests} 
        onViewRequests={() => setActiveTab('requests')}
        onSyncCloud={async () => {
          await saveDB(db);
          const freshData = await loadDB();
          setDb(freshData);
        }}
      />;
      case 'clients': return <ClientsList user={liveUser} clients={db.clients} groups={db.groups} onViewClient={id => {setSelectedClientId(id); setActiveTab('client-detail');}} />;
      case 'third-party': 
        if (liveUser.role !== UserRole.VIEWER) return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado</div>;
        
        if (liveUser.thirdPartyBlocked) {
          return (
            <div className="flex flex-col items-center justify-center py-20 px-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-red-100 border-b-4 border-red-200">
                <ShieldCheck size={48} />
              </div>
              <h2 className="text-3xl font-black tracking-tighter text-slate-800 mb-4 uppercase">ACESSO BLOQUEADO</h2>
              <p className="text-slate-500 font-bold text-center max-w-md leading-relaxed mb-10 uppercase text-xs tracking-widest">
                Seu painel de terceiros está temporariamente bloqueado. Fale com o administrador para liberação.
              </p>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 border-b-4 border-black hover:bg-black transition-all"
              >
                Voltar para o Painel Principal
              </button>
            </div>
          );
        }
        
        return <ThirdPartyModule user={liveUser} db={db} setDb={setDb} />;
      case 'requests': return <RequestsList user={liveUser} requests={db.requests} clients={db.clients} groups={db.groups} onAction={handleProcessRequest} />;
      case 'admin': 
        if (liveUser.role !== UserRole.ADMIN) return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado</div>;
        return <AdminPanel 
          groups={db.groups} clients={db.clients} users={db.users} competences={db.competences} reports={db.reports} user={liveUser} transactions={db.transactions}
          onToggleThirdPartyBlock={(userId) => {
            setDb((prev: any) => ({
              ...prev,
              users: prev.users.map((u: any) => u.id === userId ? { ...u, thirdPartyBlocked: !u.thirdPartyBlocked, updatedAt: Date.now() } : u)
            }));
          }}
          onAddGroup={d => {
            try {
              // Verificar se o e-mail já existe
              const emailExists = db.users.some((u: any) => u.email.toLowerCase() === d.email.toLowerCase());
              if (emailExists) {
                alert("Este e-mail já está cadastrado em outro usuário ou sócio.");
                return;
              }

              const newGroupId = `g-${Date.now()}`;
              const newGroup: Group = { id: newGroupId, name: toTitleCase(d.name), email: d.email, phone: d.phone, interestRate: d.interestRate };
              const newUser: User = { id: `u-${Date.now()}`, email: d.email, password: d.password, role: UserRole.VIEWER, groupId: newGroupId };
              
              setDb((prev: any) => ({ 
                ...prev, 
                groups: [...prev.groups, newGroup], 
                users: [...prev.users, newUser] 
              }));
              
              alert("Sócio cadastrado com sucesso!");
            } catch (err) {
              console.error("Erro ao cadastrar sócio:", err);
              alert("Erro ao cadastrar sócio.");
            }
          }} 
          onDeleteGroup={handleDeleteGroup} 
          onUpdateGroup={handleUpdateSocio}
          onAddClient={async d => {
            try {
              const newClientId = crypto.randomUUID();
              
              const parseDate = (dateStr: string) => {
                if (!dateStr) return Date.now();
                if (dateStr.includes('/')) {
                  const [day, month, year] = dateStr.split('/').map(Number);
                  const fullYear = year < 100 ? 2000 + year : year;
                  return new Date(fullYear, month - 1, day).getTime();
                }
                return new Date(dateStr).getTime();
              };

              const createdAt = parseDate(d.startDate) + 12 * 60 * 60 * 1000;
              const firstDueDate = parseDate(d.firstDueDate) + 12 * 60 * 60 * 1000;
              
              const newClient = { 
                id: newClientId, 
                ...d, 
                name: toTitleCase(d.name), 
                status: 'ACTIVE',
                createdAt,
                firstDueDate
              };

              // Inserir no Supabase
              await insertClient(newClient);
              setDb((prev: any) => {
                const newState = { ...prev, clients: [...prev.clients, newClient] };
                return runCompetenceSync(newState);
              });
              alert("Cliente cadastrado com sucesso!");
            } catch (err) {
              console.error("Erro ao cadastrar cliente:", err);
              alert("Erro ao cadastrar cliente no Supabase.");
            }
          }} 
          onDeleteClient={handleDeleteClient}
          onAddReport={r => setDb((prev: any) => {
            const newState = { ...prev, reports: [...prev.reports, r] };
            return runCompetenceSync(newState);
          })} 
        />;
      case 'client-detail':
        const client = db.clients.find((c: any) => c.id === selectedClientId);
        if (!client) return <div>Não encontrado</div>;
        
        // SEGURANÇA MÁXIMA: Impede o sócio de ver qualquer cliente que não seja seu
        if (user.role === UserRole.VIEWER) {
          const userGroupId = user.groupId || db.groups.find((g: any) => g.email === user.email)?.id;
          if (client.groupId !== userGroupId) {
            return (
              <div className="p-10 md:p-20 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-200 shadow-sm animate-in fade-in duration-500">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                  <X size={40} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 uppercase mb-2">Acesso Restrito</h3>
                <p className="text-slate-500 font-medium max-w-xs mx-auto">Este cliente não pertence à sua carteira de sócio.</p>
                <button 
                  onClick={() => setActiveTab('dashboard')}
                  className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-black transition-all"
                >
                  Voltar ao Início
                </button>
              </div>
            );
          }
        }
        
        return <ClientDetail 
          client={client} group={db.groups.find((g: any) => g.id === client.groupId)} competences={db.competences} transactions={db.transactions} user={user} 
          onBack={() => setActiveTab('dashboard')} 
          onRequestPayment={(i, a, d, obs, date) => {
             const newReq: PaymentRequest = { 
               id: `req-${Date.now()}`, 
               clientId: client.id, 
               groupId: client.groupId, 
               interestValue: i, 
               amortizationValue: a, 
               discountValue: d, 
               observation: obs, 
               status: RequestStatus.PENDING, 
               requesterId: user.id, 
               createdAt: date 
             };
             setDb((prev: any) => ({ ...prev, requests: [...prev.requests, newReq] }));
          }} 
          onUpdateClient={(id, data) => {
            if (user.role !== UserRole.ADMIN) return;
            const updatedData = { ...data };
            if (updatedData.name) updatedData.name = toTitleCase(updatedData.name);
            setDb((prev: any) => {
              const newState = { ...prev, clients: prev.clients.map((c: any) => c.id === id ? { ...c, ...updatedData } : c) };
              return runCompetenceSync(newState);
            });
          }}
          onUpdateCompetence={(id, data) => {
            if (user.role !== UserRole.ADMIN) return;
            setDb((prev: any) => {
              const newState = { ...prev, competences: prev.competences.map((c: any) => c.id === id ? { ...c, ...data } : c) };
              return runCompetenceSync(newState);
            });
          }}
          onUpdateTransaction={(id, data) => {
            if (user.role !== UserRole.ADMIN) return;
            setDb((prev: any) => {
              const updatedTransactions = prev.transactions.map((t: any) => t.id === id ? { ...t, ...data } : t);
              // Recalculate capital if amount or type changed
              const updatedClients = prev.clients.map((c: any) => {
                const clientTrxs = updatedTransactions.filter((t: any) => t.clientId === c.id);
                let newCap = c.initialCapital;
                clientTrxs.forEach((t: any) => {
                  if (t.type === 'INVESTMENT') newCap += t.amount;
                  if (t.type === 'WITHDRAWAL' || t.type === 'AMORTIZATION') newCap -= t.amount;
                });
                return { ...c, currentCapital: Math.max(0, newCap) };
              });
              const newState = { ...prev, clients: updatedClients, transactions: updatedTransactions };
              return runCompetenceSync(newState);
            });
          }}
          onDeleteClient={id => {
            handleDeleteClient(id);
            setActiveTab('dashboard');
          }} 
          onAddTransaction={trx => {
            if (user.role !== UserRole.ADMIN) return;
            setDb((prev: any) => {
              const updatedClients = prev.clients.map((c: any) => {
                if (c.id === trx.clientId) {
                  let newCap = c.currentCapital;
                  if (trx.type === 'INVESTMENT') newCap += trx.amount;
                  if (trx.type === 'WITHDRAWAL' || trx.type === 'AMORTIZATION') newCap -= trx.amount;
                  return { ...c, currentCapital: Math.max(0, newCap) };
                }
                return c;
              });
              return { ...prev, clients: updatedClients, transactions: [...prev.transactions, trx] };
            });
          }} 
          groups={db.groups} 
        />;
      default: return null;
    }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-emerald-900 text-white"><RefreshCw className="animate-spin" /></div>;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10">
        <Logo size="xl" className="mx-auto mb-6" />
        <h1 className="text-2xl font-black text-center mb-8 uppercase tracking-tighter">CREDPLUS - GESTÃO FINANCEIRA</h1>
        <form onSubmit={e => {
          e.preventDefault();
          const found = db.users.find((u: any) => 
            u.email.toLowerCase() === authForm.email.toLowerCase() && 
            u.password === authForm.password
          );
          if (found) { 
            if (found.status === 'BLOCKED') {
              alert('Seu acesso foi bloqueado pelo proprietário.');
              return;
            }
            setUser(found); 
            localStorage.setItem(SESSION_KEY, JSON.stringify(found)); 
          }
          else { alert('Credenciais inválidas.'); }
        }} className="space-y-6">
          <input type="email" required className="w-full p-4 bg-slate-50 border rounded-2xl" placeholder="E-mail" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
          <input type="password" required className="w-full p-4 bg-slate-50 border rounded-2xl" placeholder="Senha" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
          <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">Entrar <ChevronRight /></button>
        </form>
      </div>
    </div>
  );

  return (
    <>
      <Layout 
        user={db.users.find((u: any) => u.id === user.id) || user} 
        onLogout={()=>{setUser(null); localStorage.removeItem(SESSION_KEY);}} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        pendingCount={db.requests.filter((r:any)=>{
          const liveUser = db.users.find((u: any) => u.id === user.id) || user;
          if (liveUser.role === UserRole.ADMIN) return r.status === RequestStatus.PENDING;
          const userGroupId = liveUser.groupId || db.groups.find((g: any) => g.email === liveUser.email)?.id;
          return r.status === RequestStatus.PENDING && r.groupId === userGroupId;
        }).length}
      >
        {renderContent()}
      </Layout>
      {user.role === UserRole.ADMIN && activeTab !== 'third-party' && (
        <AIAssistant 
          db={db} 
          user={user} 
          onUpdateClient={handleUpdateClient}
          onUpdateSocio={handleUpdateSocio}
          onAddClient={async (data: any) => {
              try {
                const newClientId = crypto.randomUUID();
                
                // Robust date parsing
                const parseDate = (d: string) => {
                  if (!d) return Date.now();
                  if (typeof d !== 'string') return new Date(d).getTime();
                  
                  if (d.includes('/')) {
                    const parts = d.split('/');
                    if (parts.length === 3) {
                      const day = parseInt(parts[0]);
                      const month = parseInt(parts[1]) - 1;
                      let year = parseInt(parts[2]);
                      if (year < 100) year += 2000;
                      const date = new Date(year, month, day);
                      if (!isNaN(date.getTime())) return date.getTime();
                    }
                  }
                  const date = new Date(d);
                  return isNaN(date.getTime()) ? Date.now() : date.getTime();
                };

                const createdAt = parseDate(data.startDate) + 12 * 60 * 60 * 1000;
                const firstDueDate = parseDate(data.firstDueDate) + 12 * 60 * 60 * 1000;
                
                // Map group name to ID if necessary
                let gid = data.groupId;
                const group = db.groups.find(g => 
                  g.id === gid || 
                  g.name.toLowerCase() === gid.toLowerCase() ||
                  g.name.toLowerCase().includes(gid.toLowerCase())
                );
                
                if (group) {
                  gid = group.id;
                } else {
                  // Se não encontrar o grupo, não podemos cadastrar
                  alert(`Sócio "${data.groupId}" não encontrado. Por favor, verifique o nome.`);
                  return;
                }

                // Sanitize: only include fields present in the Client interface
                const newClient: Client = { 
                  id: newClientId, 
                  name: data.name,
                  phone: data.phone,
                  groupId: gid,
                  initialCapital: data.initialCapital,
                  currentCapital: data.initialCapital,
                  dueDay: data.dueDay,
                  status: 'ACTIVE', 
                  notes: data.notes || '',
                  createdAt, 
                  firstDueDate
                };

                console.log("📝 Tentando cadastrar cliente via Agente:", newClient);

                // Inserir no Supabase
                await insertClient(newClient);

                setDb((prev: any) => {
                  const newState = { ...prev, clients: [...prev.clients, newClient] };
                  return runCompetenceSync(newState);
                });
                alert("Cliente cadastrado com sucesso!");
              } catch (err) {
                console.error("Erro ao cadastrar cliente:", err);
                alert("Erro ao cadastrar cliente no Supabase. Verifique o console.");
              }
            }}
            onAddTransaction={(trx) => {
              setDb((prev: any) => {
                const updatedClients = prev.clients.map((c: any) => {
                  if (c.id === trx.clientId) {
                    let newCap = c.currentCapital;
                    if (trx.type === 'INVESTMENT') newCap += trx.amount;
                    if (trx.type === 'WITHDRAWAL' || trx.type === 'AMORTIZATION') newCap -= trx.amount;
                    return { ...c, currentCapital: Math.max(0, newCap) };
                  }
                  return c;
                });
                const newState = { ...prev, clients: updatedClients, transactions: [...prev.transactions, { ...trx, id: `t-${Date.now()}`, createdAt: Date.now() }] };
                return runCompetenceSync(newState);
              });
            }}
            onAddSocio={(data) => {
              const newGroupId = `g-${Date.now()}`;
              const newGroup: Group = {
                id: newGroupId,
                name: data.name,
                email: data.email,
                phone: data.phone,
                interestRate: data.interestRate
              };
              const newUser: User = {
                id: `u-${Date.now()}`,
                email: data.email,
                password: data.password,
                role: UserRole.VIEWER,
                groupId: newGroupId
              };
              setDb((prev: any) => ({
                ...prev,
                groups: [...prev.groups, newGroup],
                users: [...prev.users, newUser]
              }));
            }}
            onAddPayment={(data) => {
              setDb((prev: any) => {
                const updatedCompetences = applyFIFOPayment(
                  [...prev.competences],
                  data.clientId,
                  data.interestAmount,
                  0
                );
                
                const updatedClients = prev.clients.map((c: any) => {
                  if (c.id === data.clientId) {
                    return { ...c, currentCapital: Math.max(0, c.currentCapital - data.amortizationAmount) };
                  }
                  return c;
                });
    
                const newTransactions = [...prev.transactions];
                if (data.interestAmount > 0) {
                  newTransactions.push({
                    id: `t-int-${Date.now()}`,
                    clientId: data.clientId,
                    type: 'INTEREST_PAYMENT' as any,
                    amount: data.interestAmount,
                    description: data.description || 'Pagamento de juros via Agente',
                    createdAt: Date.now()
                  });
                }
                if (data.amortizationAmount > 0) {
                  newTransactions.push({
                    id: `t-amo-${Date.now()}`,
                    clientId: data.clientId,
                    type: 'AMORTIZATION' as any,
                    amount: data.amortizationAmount,
                    description: data.description || 'Amortização via Agente',
                    createdAt: Date.now()
                  });
                }
    
                const newState = {
                  ...prev,
                  competences: updatedCompetences,
                  clients: updatedClients,
                  transactions: newTransactions
                };
                return runCompetenceSync(newState);
              });
            }}
            onDeleteClient={handleDeleteClient}
            onDeleteGroup={handleDeleteGroup}
            onRequestPayment={(clientId, i, a, d, obs) => {
              const client = db.clients.find((c: any) => c.id === clientId);
              if (!client || !user) return;
              const newReq: PaymentRequest = { 
                id: `req-${Date.now()}`, 
                clientId: client.id, 
                groupId: client.groupId, 
                interestValue: i, 
                amortizationValue: a, 
                discountValue: d, 
                observation: obs, 
                status: RequestStatus.PENDING, 
                requesterId: user.id, 
                createdAt: Date.now() 
              };
              setDb((prev: any) => ({ ...prev, requests: [...prev.requests, newReq] }));
            }}
          />
      )}
    </>
  );
};

export default App;
