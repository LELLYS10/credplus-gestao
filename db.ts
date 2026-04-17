import { createClient } from '@supabase/supabase-js';
import { User, Group, Client, Competence, PaymentRequest, UserRole, UserGroupType, ApprovalStatus, RequestStatus, DBState, Report, Transaction } from './types';
 
const STORAGE_KEY = 'loan_management_db_v1';
 
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
 
if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase: Chaves não encontradas. O sistema funcionará apenas em modo LOCAL (navegador).");
}
 
export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const initialState: DBState = {
  users: [{ id: '1', email: 'credplusemp@gmail.com', password: '123456', role: UserRole.ADMIN, groupType: UserGroupType.GRUPO_ESPECIAL, canCreateClient: true, canCreateContract: true, canApprove: true, canDelete: true, canManageAll: true }],
  groups: [],
  clients: [],
  competences: [],
  requests: [],
  reports: [],
  transactions: [],
  settings: {},
  thirdPartyClients: [],
  thirdPartyLoans: [],
  thirdPartyPayments: []
};
 
// Helper para converter objeto (removido conversão automática para evitar erros de schema)
const prepareForSupabase = (obj: any, table?: string) => {
  if (!obj) return obj;
  
  // Se soubermos a tabela, podemos filtrar campos que não existem no banco
  if (table === 'users') {
    const { id, email, password, role, groupId, status, thirdPartyBlocked, updatedAt, groupType, canCreateClient, canCreateContract, canApprove, canDelete, canManageAll, commissionVisibility } = obj;
    return { id, email, password, role, groupId, status, thirdPartyBlocked, updatedAt, groupType, canCreateClient, canCreateContract, canApprove, canDelete, canManageAll, commissionVisibility };
  }

  if (table === 'groups') {
    const { id, name, email, phone, interestRate } = obj;
    return { id, name, email, phone, interestRate };
  }

  if (table === 'clients') {
    const { id, name, phone, groupId, initialCapital, currentCapital, dueDay, status, notes, createdAt, firstDueDate, approvalStatus, createdBy, approvedBy, approvedAt, assignedGroupType, contractValue, contractRate, contractCommission, contractDueDate, contractNotes } = obj;
    return { id, name, phone, groupId, initialCapital, currentCapital, dueDay, status, notes, createdAt, firstDueDate, approvalStatus, createdBy, approvedBy, approvedAt, assignedGroupType, contractValue, contractRate, contractCommission, contractDueDate, contractNotes };
  }
 
  // Para outras tabelas ou se não especificado, retorna como está
  return obj;
};
 
// Helper para converter objeto vindo do Supabase
const prepareFromSupabase = (obj: any) => {
  return obj;
};
 
export const loadDB = async (): Promise<DBState> => {
  const localData = localStorage.getItem(STORAGE_KEY);
  let localState: DBState = localData ? JSON.parse(localData) : initialState;
 
  if (!supabase) {
    console.log("ℹ️ Supabase não inicializado. Usando dados locais.");
    return localState;
  }
 
  try {
    console.log("🔄 Carregando dados do Supabase...");
    const [
      { data: users, error: uErr },
      { data: groups, error: gErr },
      { data: clients, error: cErr },
      { data: competences, error: cpErr },
      { data: requests, error: rErr },
      { data: reports, error: rpErr },
      { data: transactions, error: tErr },
      { data: tpClients },
      { data: tpLoans },
      { data: tpPayments }
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('competences').select('*'),
      supabase.from('requests').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('transactions').select('*'),
      supabase.from('third_party_clients').select('*'),
      supabase.from('third_party_loans').select('*'),
      supabase.from('third_party_payments').select('*')
    ]);
 
    if (uErr || gErr || cErr) {
      console.error("❌ Erro ao carregar tabelas principais:", { uErr, gErr, cErr });
    }
 
    // Mapear dados do Supabase
    const mappedClients = (clients || []).map(c => prepareFromSupabase(c));
    const mappedGroups = (groups || []).map(g => prepareFromSupabase(g));
    const mappedCompetences = (competences || []).map(cp => prepareFromSupabase(cp));
    const mappedRequests = (requests || []).map(r => prepareFromSupabase(r));
    const mappedReports = (reports || []).map(rp => prepareFromSupabase(rp));
    const mappedTransactions = (transactions || []).map(t => prepareFromSupabase(t));
 
    console.log(`✅ Dados carregados: ${mappedClients.length} clientes, ${mappedGroups.length} sócios.`);
 
    // Mesclar usuários
    const usersMap = new Map<string, any>();
    (users || []).forEach(u => {
      const userId = String(u.id);
      const mappedUser = prepareFromSupabase(u);
      const localUser = localState.users.find(lu => String(lu.id) === userId);
      
      usersMap.set(userId, {
        ...(localUser || {}),
        ...mappedUser,
        id: userId
      });
    });
 
    const mergedUsers = Array.from(usersMap.values());
 
    return {
      users: mergedUsers.length > 0 ? mergedUsers : localState.users,
      groups: groups !== null ? mappedGroups : localState.groups,
      clients: (clients !== null && !cErr) ? mappedClients : localState.clients,
      competences: (competences !== null && !cpErr) ? mappedCompetences : localState.competences,
      requests: (requests !== null && !rErr) ? mappedRequests : localState.requests,
      reports: (reports !== null && !rpErr) ? mappedReports : localState.reports,
      transactions: (transactions !== null && !tErr) ? mappedTransactions : localState.transactions,
      settings: localState.settings || {},
      thirdPartyClients: tpClients !== null ? tpClients.map(c => prepareFromSupabase(c)) : (localState.thirdPartyClients || []),
      thirdPartyLoans: tpLoans !== null ? tpLoans.map(l => prepareFromSupabase(l)) : (localState.thirdPartyLoans || []),
      thirdPartyPayments: tpPayments !== null ? tpPayments.map(p => prepareFromSupabase(p)) : (localState.thirdPartyPayments || [])
    };
  } catch (error) {
    console.error("Erro crítico ao carregar do Supabase:", error);
    return localState;
  }
};
 
export const saveDB = async (state: DBState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error("Erro ao salvar no localStorage:", e);
  }
  
  if (!supabase) return;
 
  try {
    const results = await Promise.all([
      state.users.length > 0 ? supabase.from('users').upsert(state.users.map(i => prepareForSupabase(i, 'users'))) : Promise.resolve({ error: null }),
      state.groups.length > 0 ? supabase.from('groups').upsert(state.groups.map(i => prepareForSupabase(i, 'groups'))) : Promise.resolve({ error: null }),
      state.clients.length > 0 ? supabase.from('clients').upsert(state.clients.map(i => prepareForSupabase(i, 'clients'))) : Promise.resolve({ error: null }),
      state.competences.length > 0 ? supabase.from('competences').upsert(state.competences.map(i => prepareForSupabase(i, 'competences'))) : Promise.resolve({ error: null }),
      state.requests.length > 0 ? supabase.from('requests').upsert(state.requests.map(i => prepareForSupabase(i, 'requests'))) : Promise.resolve({ error: null }),
      state.reports.length > 0 ? supabase.from('reports').upsert(state.reports.map(i => prepareForSupabase(i, 'reports'))) : Promise.resolve({ error: null }),
      state.transactions.length > 0 ? supabase.from('transactions').upsert(state.transactions.map(i => prepareForSupabase(i, 'transactions'))) : Promise.resolve({ error: null }),
      (state.thirdPartyClients && state.thirdPartyClients.length > 0) ? supabase.from('third_party_clients').upsert(state.thirdPartyClients.map(i => prepareForSupabase(i, 'third_party_clients'))) : Promise.resolve({ error: null }),
      (state.thirdPartyLoans && state.thirdPartyLoans.length > 0) ? supabase.from('third_party_loans').upsert(state.thirdPartyLoans.map(i => prepareForSupabase(i, 'third_party_loans'))) : Promise.resolve({ error: null }),
      (state.thirdPartyPayments && state.thirdPartyPayments.length > 0) ? supabase.from('third_party_payments').upsert(state.thirdPartyPayments.map(i => prepareForSupabase(i, 'third_party_payments'))) : Promise.resolve({ error: null }),
    ]);
 
    const tableNames = [
      'users', 'groups', 'clients', 'competences', 'requests', 
      'reports', 'transactions', 'third_party_clients', 
      'third_party_loans', 'third_party_payments'
    ];
 
    results.forEach((res, index) => {
      if (res && (res as any).error) {
        console.error(`❌ Erro Supabase [Tabela: ${tableNames[index]}]:`, (res as any).error);
      }
    });
 
  } catch (error) {
    console.error("Erro ao sincronizar com Supabase:", error);
  }
};
 
export const deleteFromDB = async (table: string, id: string) => {
  if (!supabase) return;
  try {
    console.log(`🗑️ Tentando deletar de ${table} id: ${id}`);
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) {
      console.error(`❌ Erro ao deletar de ${table}:`, error);
      throw error;
    }
    console.log(`✅ Deletado de ${table} com sucesso.`);
  } catch (error) {
    console.error(`Erro fatal ao deletar de ${table}:`, error);
    throw error;
  }
};
 
export const insertClient = async (client: Partial<Client>) => {
  if (!supabase) {
    console.warn("⚠️ Supabase não disponível para insertClient.");
    return null;
  }
  
  try {
    const payload = prepareForSupabase(client, 'clients');
    console.log("🚀 Enviando payload para Supabase (clients):", payload);
 
    const { data, error } = await supabase
      .from('clients')
      .insert([payload])
      .select();
 
    if (error) {
      console.error("❌ Erro detalhado do Supabase (insertClient):", error);
      throw error;
    }
    
    console.log("✅ Cliente inserido com sucesso no Supabase:", data);
    return data;
  } catch (error) {
    console.error("Erro ao inserir cliente no Supabase:", error);
    throw error;
  }
};
 
export const checkHealth = async () => {
  if (!supabase) return { status: 'LOCAL', message: 'Sistema operando localmente (Supabase não configurado).' };
  
  try {
    const { data, error } = await supabase.from('users').select('count', { count: 'exact', head: true });
    if (error) throw error;
    return { status: 'ONLINE', message: 'Conexão com Supabase está ativa e estável.' };
  } catch (error: any) {
    console.error("Erro de saúde do Supabase:", error);
    return { status: 'ERROR', message: `Erro na conexão com Supabase: ${error.message || 'Erro desconhecido'}` };
  }
};
