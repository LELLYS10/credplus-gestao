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
  settings: {}
};

export const loadDB = async (): Promise<DBState> => {
  if (!supabase) {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : initialState;
  }

  try {
    const [
      { data: users, error: uErr },
      { data: groups, error: gErr },
      { data: clients, error: cErr },
      { data: competences, error: cpErr },
      { data: requests, error: rErr },
      { data: reports, error: rpErr },
      { data: transactions, error: tErr }
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('competences').select('*'),
      supabase.from('requests').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('transactions').select('*')
    ]);

    if (uErr) console.error("Erro na tabela users:", uErr);
    if (gErr) console.error("Erro na tabela groups:", gErr);
    if (cErr) console.error("Erro na tabela clients:", cErr);
    if (tErr) console.error("Erro na tabela transactions:", tErr);

    return {
      users: users || initialState.users,
      groups: groups || [],
      clients: clients || [],
      competences: competences || [],
      requests: requests || [],
      reports: reports || [],
      transactions: transactions || [],
      settings: {}
    };
  } catch (error) {
    console.error("Erro crítico ao carregar do Supabase:", error);
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : initialState;
  }
};

export const saveDB = async (state: DBState) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!supabase) return;

  try {
    await Promise.all([
      state.users.length > 0 ? supabase.from('users').upsert(state.users) : Promise.resolve(),
      state.groups.length > 0 ? supabase.from('groups').upsert(state.groups) : Promise.resolve(),
      state.clients.length > 0 ? supabase.from('clients').upsert(state.clients) : Promise.resolve(),
      state.competences.length > 0 ? supabase.from('competences').upsert(state.competences) : Promise.resolve(),
      state.requests.length > 0 ? supabase.from('requests').upsert(state.requests) : Promise.resolve(),
      state.reports.length > 0 ? supabase.from('reports').upsert(state.reports) : Promise.resolve(),
      state.transactions.length > 0 ? supabase.from('transactions').upsert(state.transactions) : Promise.resolve(),
    ]);
  } catch (error) {
    console.error("Erro ao sincronizar:", error);
  }
};
