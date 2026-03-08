import { createClient } from '@supabase/supabase-js';
import { User, Group, Client, Competence, PaymentRequest, UserRole, RequestStatus, DBState, Report, Transaction } from './types';

const STORAGE_KEY = 'loan_management_db_v1';

const getEnv = (key: string): string => {
  try {
    // Standard Vite access via import.meta.env
    const metaEnv = (import.meta as any).env;
    const viteKey = `VITE_${key}`;
    
    // 1. Try VITE_ prefix (standard for Vite/Vercel)
    if (metaEnv && metaEnv[viteKey]) return metaEnv[viteKey];
    
    // 2. Try direct key from process.env (injected by vite.config.ts)
    const processEnv = (typeof process !== 'undefined') ? process.env : null;
    if (processEnv && processEnv[key]) return processEnv[key] as string;
    if (processEnv && processEnv[viteKey]) return processEnv[viteKey] as string;

    return '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

if (!supabaseUrl || !supabaseKey) {
  console.warn("⚠️ Supabase: Chaves não encontradas. O sistema funcionará apenas em modo LOCAL (navegador).");
}

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

const initialState: DBState = {
  users: [{ id: '1', email: 'credplusemp@gmail.com', password: '123456', role: UserRole.ADMIN }],
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
const prepareForSupabase = (obj: any) => {
  // Retorna o objeto como está, pois o Supabase parece estar usando camelCase no schema do usuário
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
    const convertList = (list: any[]) => (list || []).map(item => prepareForSupabase(item));

    const results = await Promise.all([
      state.users.length > 0 ? supabase.from('users').upsert(convertList(state.users)) : Promise.resolve({ error: null }),
      state.groups.length > 0 ? supabase.from('groups').upsert(convertList(state.groups)) : Promise.resolve({ error: null }),
      state.clients.length > 0 ? supabase.from('clients').upsert(convertList(state.clients)) : Promise.resolve({ error: null }),
      state.competences.length > 0 ? supabase.from('competences').upsert(convertList(state.competences)) : Promise.resolve({ error: null }),
      state.requests.length > 0 ? supabase.from('requests').upsert(convertList(state.requests)) : Promise.resolve({ error: null }),
      state.reports.length > 0 ? supabase.from('reports').upsert(convertList(state.reports)) : Promise.resolve({ error: null }),
      state.transactions.length > 0 ? supabase.from('transactions').upsert(convertList(state.transactions)) : Promise.resolve({ error: null }),
      (state.thirdPartyClients && state.thirdPartyClients.length > 0) ? supabase.from('third_party_clients').upsert(convertList(state.thirdPartyClients)) : Promise.resolve({ error: null }),
      (state.thirdPartyLoans && state.thirdPartyLoans.length > 0) ? supabase.from('third_party_loans').upsert(convertList(state.thirdPartyLoans)) : Promise.resolve({ error: null }),
      (state.thirdPartyPayments && state.thirdPartyPayments.length > 0) ? supabase.from('third_party_payments').upsert(convertList(state.thirdPartyPayments)) : Promise.resolve({ error: null }),
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
    const payload = prepareForSupabase(client);
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
