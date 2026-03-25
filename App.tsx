import React, { useState, useEffect } from 'react';
import { User, UserRole, Group, Client, Competence, PaymentRequest, RequestStatus, Transaction, TransactionType, ClientApprovalStatus, getUserPermissions } from './types';
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
import X4Dashboard from './components/X4Dashboard';

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
      // Só sincroniza clientes ATIVOS aprovados
      const activeClients = currentDb.clients.filter((c: any) =>
        c.status === 'ACTIVE' && (!c.approvalStatus || c.approvalStatus === ClientApprovalStatus.ATIVO)
      );
      const { newCompetences, changed } = generatePendingCompetences({ ...currentDb, clients: activeClients });
      if (changed) return { ...currentDb, competences: newCompetences };
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
            exists.password = admin.password;
            exists.role = admin.role;
            adminsChanged = true;
          }
        });

        if (adminsChanged) saveDB(dbWithAdmins);

        if (savedUser) {
          try {
            const parsedUser = JSON.parse(savedUser);
            const validUser = dbWithAdmins.users.find((u: any) =>
              u.email.toLowerCase() === parsedUser.email.toLowerCase() && u.password === parsedUser.password
            );
            if (validUser) setUser(validUser);
          } catch (e) { localStorage.removeItem(SESSION_KEY); }
        }
        setDb(dbWithAdmins);
      } catch (error) {
        console.error("Failed to initialize app:", error);
        setDb({
          users: [
            { id: '1', email: 'credplusemp@gmail.com', password: '5721', role: UserRole.ADMIN },
            { id: '2', email: 'michaeldsandes@gmail.com', password: '0718', role: UserRole.ADMIN }
          ],
          groups: [], clients: [], competences: [], requests: [], reports: [], transactions: [], settings: {}
        });
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => { if (db) saveDB(db); }, [db]);

  useEffect(() => {
    if (user && db) {
      const updatedUser = db.users.find((u: any) => u.id === user.id);
      if (updatedUser) {
        if (updatedUser.thirdPartyBlocked !== user.thirdPartyBlocked ||
          updatedUser.role !== user.role || updatedUser.status !== user.status) {
          setUser(updatedUser);
          localStorage.setItem(SESSION_KEY, JSON.stringify(updatedUser));
        }
      }
    }
  }, [db, user]);

  // Redirecionar ADMIN de abas não permitidas
  useEffect(() => {
    if (user?.role === UserRole.ADMIN && activeTab === 'third-party') setActiveTab('dashboard');
    // Bloquear X4 para não-admin
    if (user && user.role !== UserRole.ADMIN && activeTab === 'x4') setActiveTab('dashboard');
    // Bloquear pending-approvals para não-admin
    if (user && user.role !== UserRole.ADMIN && activeTab === 'pending-approvals') setActiveTab('dashboard');
  }, [user, activeTab]);

  useEffect(() => {
    const handleSyncCloud = async () => {
      const freshData = await loadDB();
      setDb(freshData);
    };
    window.addEventListener('sync-cloud', handleSyncCloud as any);
    return () => window.removeEventListener('sync-cloud', handleSyncCloud as any);
  }, []);

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
              updatedTransactions.push({ id: `trx-${Date.now()}`, clientId: c.id, type: 'AMORTIZATION' as any, amount: request.amortizationValue, description: `Amortização via pagamento validado.`, createdAt: Date.now() });
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

  // X3: Aprovar pré-cadastro e completar contrato
  const handleApproveClient = (clientId: string, contractData: any) => {
    if (!db || user?.role !== UserRole.ADMIN) return;
    const parseDate = (d: string) => {
      if (!d) return Date.now();
      const date = new Date(d);
      return isNaN(date.getTime()) ? Date.now() : date.getTime() + 12 * 60 * 60 * 1000;
    };

    setDb((prev: any) => {
      const newState = {
        ...prev,
        clients: prev.clients.map((c: any) => c.id === clientId ? {
          ...c,
          groupId: contractData.groupId || c.groupId,
          initialCapital: contractData.contractValue,
          currentCapital: contractData.contractValue,
          dueDay: contractData.dueDay,
          firstDueDate: parseDate(contractData.firstDueDate),
          status: 'ACTIVE',
          approvalStatus: ClientApprovalStatus.ATIVO,
          approvedBy: user.id,
          approvedAt: Date.now(),
          contractValue: contractData.contractValue,
          contractRate: contractData.contractRate,
          contractCommission: contractData.contractCommission,
          contractDueDate: contractData.firstDueDate,
          contractNotes: contractData.contractNotes,
          notes: contractData.contractNotes || c.notes,
        } : c)
      };
      return runCompetenceSync(newState);
    });
    alert(`Contrato aprovado e ativado com sucesso!`);
  };

  // X3: Rejeitar pré-cadastro
  const handleRejectClient = (clientId: string, reason: string) => {
    if (!db || user?.role !== UserRole.ADMIN) return;
    setDb((prev: any) => ({
      ...prev,
      clients: prev.clients.map((c: any) => c.id === clientId ? {
        ...c,
        approvalStatus: ClientApprovalStatus.REJEITADO,
        status: 'INACTIVE',
        notes: reason ? `[REJEITADO] ${reason}` : '[REJEITADO pelo ADM]',
      } : c)
    }));
    alert('Cadastro rejeitado.');
  };

  // X3: Pré-cadastro por sócio (Grupo A ou B)
  const handlePreRegisterClient = async (data: any) => {
    if (!db || !user) return;
    const liveUser = db.users.find((u: any) => u.id === user.id) || user;
    const userGroupId = liveUser.groupId || db.groups.find((g: any) => g.email === liveUser.email)?.id;

    if (!userGroupId) {
      alert('Erro: seu usuário não está vinculado a um grupo. Contate o ADM.');
      return;
    }

    const newClientId = crypto.randomUUID();
    const newClient: Client = {
      id: newClientId,
      name: toTitleCase(data.name),
      phone: data.phone || '',
      groupId: userGroupId,
      initialCapital: 0,
      currentCapital: 0,
      dueDay: 1,
      status: 'INACTIVE',
      notes: data.notes || '',
      createdAt: Date.now(),
      approvalStatus: ClientApprovalStatus.PRE_CADASTRO,
      createdBy: liveUser.id,
      assignedGroupType: liveUser.groupType,
    };

    try {
      await insertClient(newClient);
      setDb((prev: any) => ({ ...prev, clients: [...prev.clients, newClient] }));
      alert('Pré-cadastro enviado com sucesso! Aguardando aprovação do ADM.');
    } catch (err) {
      console.error('Erro no pré-cadastro:', err);
      alert('Erro ao enviar pré-cadastro. Tente novamente.');
    }
  };

  const handleDeleteClient = async (id: string): Promise<boolean> => {
    if (!db || !user) return false;
    const client = db.clients.find((c: any) => c.id === id);
    if (!client) return false;

    if (user.role !== UserRole.ADMIN) {
      const userGroupId = user.groupId || db.groups.find((g: any) => g.email === user.email)?.id;
      if (client.groupId !== userGroupId) {
        alert("Você não tem permissão para excluir este cliente.");
        return false;
      }
    }

    try {
      await Promise.all([
        deleteFromDB('clients', id),
        ...db.competences.filter((cp: any) => cp.clientId === id).map((cp: any) => deleteFromDB('competences', cp.id)),
        ...db.transactions.filter((t: any) => t.clientId === id).map((t: any) => deleteFromDB('transactions', t.id)),
        ...db.requests.filter((r: any) => r.clientId === id).map((r: any) => deleteFromDB('requests', r.id))
      ]);
    } catch (e) { console.error("Erro na exclusão profunda:", e); return false; }

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
      const newState = { ...prev, clients: prev.clients.map((c: any) => c.id === clientId ? { ...c, ...updates } : c) };
      return runCompetenceSync(newState);
    });
  };

  const handleUpdateSocio = (groupId: string, updates: any) => {
    setDb((prev: any) => ({
      ...prev,
      groups: prev.groups.map((g: any) => g.id === groupId ? { ...g, ...updates } : g),
      users: prev.users.map((u: any) => {
        if (u.groupId === groupId) {
          const userUpdates: any = { updatedAt: Date.now() };
          if (updates.email) userUpdates.email = updates.email;
          if (updates.password) userUpdates.password = updates.password;
          return { ...u, ...userUpdates };
        }
        return u;
      })
    }));
  };

  const handleDeleteGroup = async (id: string): Promise<boolean> => {
    if (user?.role !== UserRole.ADMIN || !db) return false;
    try {
      const group = db.groups.find((g: any) => g.id === id);
      if (!group) return false;
      if (group.email === 'credplusemp@gmail.com') { alert("Este usuário admin não pode ser excluído."); return false; }
      const linkedClients = db.clients.filter((c: any) => c.groupId === id);
      if (linkedClients.length > 0) { alert("Não é possível excluir este sócio porque existem clientes vinculados. Transfira ou exclua os clientes primeiro."); return false; }
      const usersToDelete = db.users.filter((u: any) => u.groupId === id);
      await Promise.all([...usersToDelete.map((u: any) => deleteFromDB('users', u.id)), deleteFromDB('groups', id)]);
      setDb((prev: any) => ({ ...prev, groups: prev.groups.filter((g: any) => g.id !== id), users: prev.users.filter((u: any) => u.groupId !== id) }));
      alert("Sócio excluído com sucesso.");
      return true;
    } catch (e) { console.error("Erro na exclusão do grupo:", e); alert("Ocorreu um erro ao tentar excluir o sócio."); return false; }
  };

  const renderContent = () => {
    if (!db || !user) return null;
    const liveUser = db.users.find((u: any) => u.id === user.id) || user;
    const perms = getUserPermissions(liveUser);

    // ========================
    // BLOQUEIOS DE SEGURANÇA
    // ========================
    if (activeTab === 'x4' && !perms.canAccessX4) {
      return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado — Exclusivo ADM</div>;
    }
    if (activeTab === 'pending-approvals' && !perms.isAdmin) {
      return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado</div>;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard
          user={liveUser} clients={db.clients} competences={db.competences} groups={db.groups}
          settings={db.settings} onViewClient={id => { setSelectedClientId(id); setActiveTab('client-detail'); }}
          pendingRequests={db.requests} onViewRequests={() => setActiveTab('requests')}
          onSyncCloud={async () => { await saveDB(db); const freshData = await loadDB(); setDb(freshData); }}
        />;

      case 'clients':
        return <ClientsList
          user={liveUser} clients={db.clients} groups={db.groups}
          onViewClient={id => { setSelectedClientId(id); setActiveTab('client-detail'); }}

        />;

      case 'requests':
        return <RequestsList user={liveUser} requests={db.requests} clients={db.clients} groups={db.groups} onAction={handleProcessRequest} />;

      case 'x4':
        return <X4Dashboard user={liveUser} clients={db.clients} groups={db.groups} competences={db.competences} />;

      case 'third-party':
        if (liveUser.role !== UserRole.VIEWER) return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado</div>;
        if (liveUser.thirdPartyBlocked) {
          return (
            <div className="flex flex-col items-center justify-center py-20 px-4">
              <div className="w-24 h-24 bg-red-100 text-red-600 rounded-[2rem] flex items-center justify-center mb-8 shadow-xl shadow-red-100 border-b-4 border-red-200"><ShieldCheck size={48} /></div>
              <h2 className="text-3xl font-black tracking-tighter text-slate-800 mb-4 uppercase">ACESSO BLOQUEADO</h2>
              <p className="text-slate-500 font-bold text-center max-w-md leading-relaxed mb-10 uppercase text-xs tracking-widest">Seu painel de terceiros está temporariamente bloqueado. Fale com o administrador para liberação.</p>
              <button onClick={() => setActiveTab('dashboard')} className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-slate-200 border-b-4 border-black hover:bg-black transition-all">Voltar para o Painel Principal</button>
            </div>
          );
        }
        return <ThirdPartyModule user={liveUser} db={db} setDb={setDb} />;

      case 'admin':
        if (liveUser.role !== UserRole.ADMIN) return <div className="p-10 text-center font-black uppercase text-red-500">Acesso Negado</div>;
        return <AdminPanel
          groups={db.groups} clients={db.clients} users={db.users} competences={db.competences}
          reports={db.reports} user={liveUser} transactions={db.transactions}
          onToggleThirdPartyBlock={(userId) => {
            setDb((prev: any) => ({ ...prev, users: prev.users.map((u: any) => u.id === userId ? { ...u, thirdPartyBlocked: !u.thirdPartyBlocked, updatedAt: Date.now() } : u) }));
          }}
          onAddGroup={d => {
            try {
              const emailExists = db.users.some((u: any) => u.email.toLowerCase() === d.email.toLowerCase());
              if (emailExists) {
                alert("Este e-mail já está cadastrado.");
                return;
              }
              const newGroupId = `g-${Date.now()}`;
              const newGroup = { id: newGroupId, name: toTitleCase(d.name), email: d.email, phone: d.phone, interestRate: d.interestRate };
              const newUser = { id: `u-${Date.now()}`, email: d.email, password: d.password, role: UserRole.VIEWER, groupId: newGroupId };
              setDb((prev: any) => ({ ...prev, groups: [...prev.groups, newGroup], users: [...prev.users, newUser] }));
              alert("Sócio cadastrado com sucesso!");
            } catch (err) {
              console.error(err);
            }
          }}
          onDeleteClient={id => { handleDeleteClient(id); setActiveTab('dashboard'); }}
          onDeleteGroup={handleDeleteGroup}
          onUpdateGroup={handleUpdateSocio}
          onAddClient={async d => {
            const newClientId = crypto.randomUUID();
            const newClient = {
              id: newClientId,
              name: toTitleCase(d.name),
              phone: d.phone,
              groupId: d.groupId,
              initialCapital: d.initialCapital,
              currentCapital: d.initialCapital,
              dueDay: d.dueDay,
              status: 'ACTIVE' as const,
              notes: d.notes || '',
              createdAt: Date.now()
            };
            setDb((prev: any) => {
              const newState = { ...prev, clients: [...prev.clients, newClient] };
              return runCompetenceSync(newState);
            });
            alert("Cliente cadastrado com sucesso!");
          }}
          onAddReport={r => setDb((prev: any) => {
            const newState = { ...prev, reports: [...prev.reports, r] };
            return runCompetenceSync(newState);
          })}
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
          const found = db.users.find((u: any) => u.email.toLowerCase() === authForm.email.toLowerCase() && u.password === authForm.password);
          if (found) {
            if (found.status === 'BLOCKED') { alert('Seu acesso foi bloqueado pelo proprietário.'); return; }
            setUser(found); localStorage.setItem(SESSION_KEY, JSON.stringify(found));
          } else { alert('Credenciais inválidas.'); }
        }} className="space-y-6">
          <input type="email" required className="w-full p-4 bg-slate-50 border rounded-2xl" placeholder="E-mail" value={authForm.email} onChange={e => setAuthForm({ ...authForm, email: e.target.value })} />
          <input type="password" required className="w-full p-4 bg-slate-50 border rounded-2xl" placeholder="Senha" value={authForm.password} onChange={e => setAuthForm({ ...authForm, password: e.target.value })} />
          <button type="submit" className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-2">Entrar <ChevronRight /></button>
        </form>
      </div>
    </div>
  );

  const liveUserForLayout = db.users.find((u: any) => u.id === user.id) || user;

  // Contar pré-cadastros pendentes para badge no menu
  const pendingApprovalsCount = db.clients.filter((c: any) =>
    c.approvalStatus === ClientApprovalStatus.PRE_CADASTRO ||
    c.approvalStatus === ClientApprovalStatus.AGUARDANDO_ADM
  ).length;

  return (
    <>
      <Layout
        user={liveUserForLayout}
        onLogout={() => { setUser(null); localStorage.removeItem(SESSION_KEY); }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        pendingCount={db.requests.filter((r: any) => {
          if (liveUserForLayout.role === UserRole.ADMIN) return r.status === RequestStatus.PENDING;
          const userGroupId = liveUserForLayout.groupId || db.groups.find((g: any) => g.email === liveUserForLayout.email)?.id;
          return r.status === RequestStatus.PENDING && r.groupId === userGroupId;
        }).length}
        pendingApprovalsCount={pendingApprovalsCount}
      >
        {renderContent()}
      </Layout>
      {user && (
        <AIAssistant
          db={db} user={user}
          onUpdateClient={handleUpdateClient}
          onUpdateSocio={handleUpdateSocio}
          onAddClient={async (data: any) => {
            try {
              const newClientId = crypto.randomUUID();
              const parseDate = (d: string) => {
                if (!d) return Date.now();
                if (typeof d !== 'string') return new Date(d).getTime();
                if (d.includes('/')) {
                  const parts = d.split('/');
                  if (parts.length === 3) {
                    const day = parseInt(parts[0]); const month = parseInt(parts[1]) - 1; let year = parseInt(parts[2]);
                    if (year < 100) year += 2000;
                    const date = new Date(year, month, day);
                    if (!isNaN(date.getTime())) return date.getTime();
                  }
                }
                const date = new Date(d); return isNaN(date.getTime()) ? Date.now() : date.getTime();
              };
              const createdAt = parseDate(data.startDate) + 12 * 60 * 60 * 1000;
              const firstDueDate = parseDate(data.firstDueDate) + 12 * 60 * 60 * 1000;
              let gid = data.groupId;
              if (!gid) throw new Error("O ID ou nome do Sócio é obrigatório.");
              const group = db.groups.find((g: any) => { const search = String(gid).toLowerCase(); const name = g.name.toLowerCase(); return g.id === gid || name === search || name.includes(search) || search.includes(name); });
              if (group) gid = group.id;
              else throw new Error(`Sócio "${gid}" não encontrado.`);
              const parseCurrency = (val: any) => { if (typeof val === 'number') return val; if (typeof val !== 'string') return 0; const cleaned = val.replace(/\./g, '').replace(',', '.'); const parsed = parseFloat(cleaned); return isNaN(parsed) ? 0 : parsed; };
              const initialCapital = parseCurrency(data.initialCapital);
              const dueDay = typeof data.dueDay === 'string' ? parseInt(data.dueDay) : data.dueDay;
              const newClient: Client = { id: newClientId, name: toTitleCase(data.name), phone: data.phone, groupId: gid, initialCapital: isNaN(initialCapital) ? 0 : initialCapital, currentCapital: isNaN(initialCapital) ? 0 : initialCapital, dueDay: isNaN(dueDay) ? 1 : dueDay, status: 'ACTIVE', notes: data.notes || '', createdAt, firstDueDate, approvalStatus: ClientApprovalStatus.ATIVO, approvedBy: user.id, approvedAt: Date.now() };
              await insertClient(newClient);
              setDb((prev: any) => { const newState = { ...prev, clients: [...prev.clients, newClient] }; return runCompetenceSync(newState); });
              alert("Cliente cadastrado com sucesso!");
            } catch (err: any) { console.error("❌ Erro ao cadastrar cliente:", err); alert(`Erro ao cadastrar cliente: ${err?.message || 'Erro desconhecido'}`); throw err; }
          }}
          onAddTransaction={(trx) => {
            if (user.role !== UserRole.ADMIN) return;
            setDb((prev: any) => {
              const updatedClients = prev.clients.map((c: any) => { if (c.id === trx.clientId) { let newCap = c.currentCapital; if (trx.type === 'INVESTMENT') newCap += trx.amount; if (trx.type === 'WITHDRAWAL' || trx.type === 'AMORTIZATION') newCap -= trx.amount; return { ...c, currentCapital: Math.max(0, newCap) }; } return c; });
              const newState = { ...prev, clients: updatedClients, transactions: [...prev.transactions, { ...trx, id: `t-${Date.now()}`, createdAt: Date.now() }] };
              return runCompetenceSync(newState);
            });
          }}
          onAddSocio={(data) => {
            if (user.role !== UserRole.ADMIN) return;
            const newGroupId = `g-${Date.now()}`;
            const newGroup: Group = { id: newGroupId, name: toTitleCase(data.name), email: data.email, phone: data.phone, interestRate: data.interestRate };
            const newUser: User = { id: `u-${Date.now()}`, email: data.email, password: data.password, role: UserRole.VIEWER, groupId: newGroupId };
            setDb((prev: any) => ({ ...prev, groups: [...prev.groups, newGroup], users: [...prev.users, newUser] }));
          }}
          onAddPayment={(data) => {
            if (user.role !== UserRole.ADMIN) return;
            setDb((prev: any) => {
              const updatedCompetences = applyFIFOPayment([...prev.competences], data.clientId, data.interestAmount, 0);
              const updatedClients = prev.clients.map((c: any) => { if (c.id === data.clientId) return { ...c, currentCapital: Math.max(0, c.currentCapital - data.amortizationAmount) }; return c; });
              const newTransactions = [...prev.transactions];
              if (data.interestAmount > 0) newTransactions.push({ id: `t-int-${Date.now()}`, clientId: data.clientId, type: TransactionType.AMORTIZATION, amount: data.interestAmount, description: data.description || 'Pagamento de juros via Agente', createdAt: Date.now() });
              if (data.amortizationAmount > 0) newTransactions.push({ id: `t-amo-${Date.now()}`, clientId: data.clientId, type: TransactionType.AMORTIZATION, amount: data.amortizationAmount, description: data.description || 'Amortização via Agente', createdAt: Date.now() });
              const newState = { ...prev, competences: updatedCompetences, clients: updatedClients, transactions: newTransactions };
              return runCompetenceSync(newState);
            });
          }}
          onDeleteClient={handleDeleteClient}
          onDeleteGroup={handleDeleteGroup}
          onRequestPayment={(clientId, i, a, d, obs) => {
            const client = db.clients.find((c: any) => c.id === clientId);
            if (!client || !user) return;
            const newReq: PaymentRequest = { id: `req-${Date.now()}`, clientId: client.id, groupId: client.groupId, interestValue: i, amortizationValue: a, discountValue: d, observation: obs, status: RequestStatus.PENDING, requesterId: user.id, createdAt: Date.now() };
            setDb((prev: any) => ({ ...prev, requests: [...prev.requests, newReq] }));
          }}
        />
      )}
    </>
  );
};

export default App;
