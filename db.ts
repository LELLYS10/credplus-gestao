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

// Helper para converter objeto de camelCase para snake_case
const toSnakeCase = (obj: any) => {
  const snakeObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    snakeObj[snakeKey] = obj[key];
  }
  return snakeObj;
};

// Helper para converter objeto de snake_case para camelCase
const toCamelCase = (obj: any) => {
  const camelObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/(_\w)/g, m => m[1].toUpperCase());
    camelObj[camelKey] = obj[key];
  }
  return camelObj;
};

export const loadDB = async (): Promise<DBState> => {
  const localData = localStorage.getItem(STORAGE_KEY);
  let localState: DBState = localData ? JSON.parse(localData) : initialState;

  if (!supabase) return localState;

  try {
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

    // Mapear clientes do Supabase (snake_case) para o App (camelCase)
    const mappedClients = (clients || []).map(c => toCamelCase(c));
    const mappedGroups = (groups || []).map(g => toCamelCase(g));
    const mappedCompetences = (competences || []).map(cp => toCamelCase(cp));
    const mappedRequests = (requests || []).map(r => toCamelCase(r));
    const mappedReports = (reports || []).map(rp => toCamelCase(rp));
    const mappedTransactions = (transactions || []).map(t => toCamelCase(t));

    // Mesclar usuários com mapeamento manual para campos específicos
    const usersMap = new Map<string, any>();
    (users || []).forEach(u => {
      const userId = String(u.id);
      const mappedUser = toCamelCase(u);
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
      thirdPartyClients: tpClients !== null ? tpClients.map(c => toCamelCase(c)) : (localState.thirdPartyClients || []),
      thirdPartyLoans: tpLoans !== null ? tpLoans.map(l => toCamelCase(l)) : (localState.thirdPartyLoans || []),
      thirdPartyPayments: tpPayments !== null ? tpPayments.map(p => toCamelCase(p)) : (localState.thirdPartyPayments || [])
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
    const convertList = (list: any[]) => (list || []).map(item => toSnakeCase(item));

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
    await supabase.from(table).delete().eq('id', id);
  } catch (error) {
    console.error(`Erro ao deletar de ${table}:`, error);
  }
};

export const insertClient = async (client: Partial<Client>) => {
  if (!supabase) return null;
  
  try {
    const payload = toSnakeCase(client);

    const { data, error } = await supabase
      .from('clients')
      .insert([payload])
      .select();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error("Erro ao inserir cliente no Supabase:", error);
    throw error;
  }
};
