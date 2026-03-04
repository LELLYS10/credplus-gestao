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

    if (uErr) console.error("Erro na tabela users:", uErr);
    if (gErr) console.error("Erro na tabela groups:", gErr);
    if (cErr) console.error("Erro na tabela clients:", cErr);
    if (tErr) console.error("Erro na tabela transactions:", tErr);

    // Mesclar dados do Supabase com dados locais para preservar campos extras (como thirdPartyBlocked)
    // que podem não existir nas colunas do Supabase ainda.
    const mergedUsers = (users || []).map(u => {
      const localUser = localState.users.find(lu => lu.id === u.id);
      
      // Tenta pegar o valor tanto em camelCase quanto snake_case (comum no Supabase)
      const supabaseValue = u.thirdPartyBlocked !== undefined ? u.thirdPartyBlocked : u.third_party_blocked;
      
      if (!localUser) return { ...u, thirdPartyBlocked: supabaseValue };

      return { 
        ...localUser, 
        ...u,
        // Preserva o valor local se o do Supabase for nulo/indefinido (coluna pode não existir no DB)
        thirdPartyBlocked: (supabaseValue !== null && supabaseValue !== undefined) 
          ? supabaseValue 
          : localUser.thirdPartyBlocked 
      };
    });

    // Adicionar usuários que existem localmente mas não no Supabase (ex: admins recém criados)
    localState.users.forEach(lu => {
      if (!mergedUsers.find(mu => mu.id === lu.id)) {
        mergedUsers.push(lu);
      }
    });

    return {
      users: mergedUsers.length > 0 ? mergedUsers : initialState.users,
      groups: groups || localState.groups,
      clients: clients || localState.clients,
      competences: competences || localState.competences,
      requests: requests || localState.requests,
      reports: reports || localState.reports,
      transactions: transactions || localState.transactions,
      settings: localState.settings || {},
      thirdPartyClients: tpClients || localState.thirdPartyClients || [],
      thirdPartyLoans: tpLoans || localState.thirdPartyLoans || [],
      thirdPartyPayments: tpPayments || localState.thirdPartyPayments || []
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
    alert("O armazenamento local está cheio ou desabilitado. Seus dados podem não ser salvos.");
  }
  
  if (!supabase) return;

  try {
    // Preparar dados para o Supabase, incluindo mapeamento para snake_case se necessário
    const usersToSave = state.users.map(u => ({
      ...u,
      third_party_blocked: u.thirdPartyBlocked // Mapeia para snake_case para compatibilidade com DB
    }));

    await Promise.all([
      usersToSave.length > 0 ? supabase.from('users').upsert(usersToSave) : Promise.resolve(),
      state.groups.length > 0 ? supabase.from('groups').upsert(state.groups) : Promise.resolve(),
      state.clients.length > 0 ? supabase.from('clients').upsert(state.clients) : Promise.resolve(),
      state.competences.length > 0 ? supabase.from('competences').upsert(state.competences) : Promise.resolve(),
      state.requests.length > 0 ? supabase.from('requests').upsert(state.requests) : Promise.resolve(),
      state.reports.length > 0 ? supabase.from('reports').upsert(state.reports) : Promise.resolve(),
      state.transactions.length > 0 ? supabase.from('transactions').upsert(state.transactions) : Promise.resolve(),
      (state.thirdPartyClients && state.thirdPartyClients.length > 0) ? supabase.from('third_party_clients').upsert(state.thirdPartyClients) : Promise.resolve(),
      (state.thirdPartyLoans && state.thirdPartyLoans.length > 0) ? supabase.from('third_party_loans').upsert(state.thirdPartyLoans) : Promise.resolve(),
      (state.thirdPartyPayments && state.thirdPartyPayments.length > 0) ? supabase.from('third_party_payments').upsert(state.thirdPartyPayments) : Promise.resolve(),
    ]);
  } catch (error) {
    console.error("Erro ao sincronizar:", error);
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
