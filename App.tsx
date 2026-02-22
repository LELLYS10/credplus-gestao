
import React, { useState, useEffect } from 'react';
import { User, UserRole, Group, Client, Competence, PaymentRequest, RequestStatus, Transaction } from './types';
import { loadDB, saveDB, deleteFromDB } from './db';
import { generatePendingCompetences, applyFIFOPayment } from './logic';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import ClientDetail from './components/ClientDetail';
import RequestsList from './components/RequestsList';
import AdminPanel from './components/AdminPanel';
import ClientsList from './components/ClientsList';
import AIAssistant from './components/AIAssistant';
import Logo from './components/Logo';
import { ChevronRight, RefreshCw } from 'lucide-react';

const SESSION_KEY = 'credplus_session_v1';

const App: React.FC = () => {
  const [db, setDb] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });

  const runCompetenceSync = (currentDb: any) => {
    const { newCompetences, changed } = generatePendingCompetences(currentDb);
    if (changed) {
      return { ...currentDb, competences: newCompetences };
    }
    return currentDb;
  };

  useEffect(() => {
    const init = async () => {
      try {
        const data = await loadDB();
        const updatedData = runCompetenceSync(data);
        const savedUser = localStorage.getItem(SESSION_KEY);
        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            const validUser = updatedData.users.find((u: any) => u.email === parsedUser.email && u.password === parsedUser.password);
            if (validUser) setUser(validUser);
          } catch (e) { localStorage.removeItem(SESSION_KEY); }
        }
        setDb(updatedData);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        // Fallback to initial state if everything fails
        setDb({
          users: [{ id: '1', email: 'credplusemp@gmail.com', password: '123456', role: UserRole.ADMIN }],
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

  const handleDeleteClient = (id: string) => {
    if (user?.role !== UserRole.ADMIN || !db) return;
    
    // Limpeza profunda no Supabase (Remover resquícios de teste)
    deleteFromDB('clients', id);
    
    const competencesToDelete = db.competences.filter((cp: any) => cp.clientId === id);
    competencesToDelete.forEach((cp: any) => deleteFromDB('competences', cp.id));
    
    const transactionsToDelete = db.transactions.filter((t: any) => t.clientId === id);
    transactionsToDelete.forEach((t: any) => deleteFromDB('transactions', t.id));
    
    const requestsToDelete = db.requests.filter((r: any) => r.clientId === id);
    requestsToDelete.forEach((r: any) => deleteFromDB('requests', r.id));

    setDb((prev: any) => ({ 
      ...prev, 
      clients: prev.clients.filter((c: any) => c.id !== id),
      competences: prev.competences.filter((cp: any) => cp.clientId !== id),
      transactions: prev.transactions.filter((t: any) => t.clientId !== id),
      requests: prev.requests.filter((r: any) => r.clientId !== id)
    }));
  };

  const handleDeleteGroup = (id: string) => {
    if (user?.role !== UserRole.ADMIN || !db) return;
    if (!confirm('Isso excluirá o sócio e TODOS os seus clientes e dados vinculados. Confirmar?')) return;
    
    // 1. Deletar Usuários do Sócio
    const usersToDelete = db.users.filter((u: any) => u.groupId === id);
    usersToDelete.forEach((u: any) => deleteFromDB('users', u.id));
    
    // 2. Deletar Clientes e seus dados (Juros, Transações, etc)
    const clientsToDelete = db.clients.filter((c: any) => c.groupId === id);
    clientsToDelete.forEach(client => {
      deleteFromDB('clients', client.id);
      db.competences.filter((cp: any) => cp.clientId === client.id).forEach((cp: any) => deleteFromDB('competences', cp.id));
      db.transactions.filter((t: any) => t.clientId === client.id).forEach((t: any) => deleteFromDB('transactions', t.id));
      db.requests.filter((r: any) => r.clientId === client.id).forEach((r: any) => deleteFromDB('requests', r.id));
    });

    // 3. Deletar o Grupo
    deleteFromDB('groups', id);

    setDb((prev: any) => ({ 
      ...prev, 
      groups: prev.groups.filter((g: any) => g.id !== id), 
      users: prev.users.filter((u: any) => u.groupId !== id),
      clients: prev.clients.filter((c: any) => c.groupId !== id),
      competences: prev.competences.filter((cp: any) => {
        const client = prev.clients.find((c: any) => c.id === cp.clientId);
        return client?.groupId !== id;
      }),
      transactions: prev.transactions.filter((t: any) => {
        const client = prev.clients.find((c: any) => c.id === t.clientId);
        return client?.groupId !== id;
      }),
      requests: prev.requests.filter((r: any) => {
        const client = prev.clients.find((c: any) => c.id === r.clientId);
        return client?.groupId !== id;
      })
    }));
  };

  const renderContent = () => {
    if (!db || !user) return null;
    switch (activeTab) {
      case 'dashboard': return <Dashboard 
        user={user} 
        clients={db.clients} 
        competences={db.competences} 
        groups={db.groups} 
        settings={db.settings} 
        onViewClient={id => {setSelectedClientId(id); setActiveTab('client-detail');}} 
        pendingRequests={db.requests} 
        onSyncCloud={async () => {
          await saveDB(db);
          const freshData = await loadDB();
          setDb(freshData);
        }}
      />;
      case 'clients': return <ClientsList user={user} clients={db.clients} groups={db.groups} onViewClient={id => {setSelectedClientId(id); setActiveTab('client-detail');}} />;
      case 'requests': return <RequestsList user={user} requests={db.requests} clients={db.clients} groups={db.groups} onAction={handleProcessRequest} />;
      case 'admin': 
        if (user.role !== UserRole.ADMIN) return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado</div>;
        return <AdminPanel 
          groups={db.groups} clients={db.clients} users={db.users} competences={db.competences} reports={db.reports} user={user} 
          onAddGroup={d => {
            const newGroupId = `g-${Date.now()}`;
            const newGroup: Group = { id: newGroupId, name: d.name, email: d.email, phone: d.phone, interestRate: d.interestRate };
            const newUser: User = { id: `u-${Date.now()}`, email: d.email, password: d.password, role: UserRole.VIEWER, groupId: newGroupId };
            setDb((prev: any) => ({ ...prev, groups: [...prev.groups, newGroup], users: [...prev.users, newUser] }));
          }} 
          onDeleteGroup={handleDeleteGroup} 
          onAddClient={d => {
            const newClientId = `c-${Date.now()}`;
            const newClient = { id: newClientId, ...d, status: 'ACTIVE' };
            setDb((prev: any) => {
              const newState = { ...prev, clients: [...prev.clients, newClient] };
              return runCompetenceSync(newState);
            });
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
        if (user.role === UserRole.VIEWER && client.groupId !== user.groupId) {
           return <div className="p-20 text-center font-black uppercase text-red-500 bg-white rounded-3xl border-2 border-dashed">Acesso Restrito à sua carteira.</div>;
        }
        return <ClientDetail 
          client={client} group={db.groups.find((g: any) => g.id === client.groupId)} competences={db.competences} transactions={db.transactions} user={user} 
          onBack={() => setActiveTab('dashboard')} 
          onRequestPayment={(i, a, d, obs) => {
             const newReq: PaymentRequest = { id: `req-${Date.now()}`, clientId: client.id, groupId: client.groupId, interestValue: i, amortizationValue: a, discountValue: d, observation: obs, status: RequestStatus.PENDING, requesterId: user.id, createdAt: Date.now() };
             setDb((prev: any) => ({ ...prev, requests: [...prev.requests, newReq] }));
          }} 
          onUpdateClient={(id, data) => {
            if (user.role !== UserRole.ADMIN) return;
            setDb((prev: any) => ({ ...prev, clients: prev.clients.map((c: any) => c.id === id ? { ...c, ...data } : c) }));
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

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-emerald-950 text-white"><RefreshCw className="animate-spin" /></div>;

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-10">
        <Logo size="xl" className="mx-auto mb-6" />
        <h1 className="text-3xl font-black text-center mb-8">CREDPLUS</h1>
        <form onSubmit={e => {
          e.preventDefault();
          const found = db.users.find((u: any) => u.email === authForm.email && u.password === authForm.password);
          if (found) { setUser(found); localStorage.setItem(SESSION_KEY, JSON.stringify(found)); }
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
      <Layout user={user} onLogout={()=>{setUser(null); localStorage.removeItem(SESSION_KEY);}} activeTab={activeTab} setActiveTab={setActiveTab} pendingCount={db.requests.filter((r:any)=>r.status === RequestStatus.PENDING).length}>
        {renderContent()}
      </Layout>
      <AIAssistant 
        db={db} 
        user={user} 
        onAddClient={(data) => {
          const newClientId = `c-${Date.now()}`;
          const newClient = { id: newClientId, ...data, status: 'ACTIVE' as const, createdAt: Date.now(), currentCapital: data.initialCapital };
          setDb((prev: any) => {
            const newState = { ...prev, clients: [...prev.clients, newClient] };
            return runCompetenceSync(newState);
          });
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
            return { ...prev, clients: updatedClients, transactions: [...prev.transactions, { ...trx, id: `t-${Date.now()}`, createdAt: Date.now() }] };
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

            return {
              ...prev,
              competences: updatedCompetences,
              clients: updatedClients,
              transactions: newTransactions
            };
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
    </>
  );
};

export default App;
