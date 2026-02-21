
// @ts-ignore
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';
import { User, Group, Client, Competence, PaymentRequest, UserRole, RequestStatus, DBState, Report, Transaction } from './types';

const STORAGE_KEY = 'loan_management_db_v1';

const getEnv = (key: string): string => {
  try {
    // Standard Vite access
    const metaEnv = (import.meta as any).env;
    if (key === 'SUPABASE_URL') return metaEnv.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
    if (key === 'SUPABASE_ANON_KEY') return metaEnv.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
    
    // Fallback for other keys
    const viteKey = `VITE_${key}`;
    if (metaEnv && metaEnv[viteKey]) return metaEnv[viteKey];
    const processEnv = (typeof process !== 'undefined') ? process.env : null;
    return (processEnv?.[key] as string) || '';
  } catch {
    return '';
  }
};

const supabaseUrl = getEnv('SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_ANON_KEY');

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
      { data: users },
      { data: groups },
      { data: clients },
      { data: competences },
      { data: requests },
      { data: reports },
      { data: transactions }
    ] = await Promise.all([
      supabase.from('users').select('*'),
      supabase.from('groups').select('*'),
      supabase.from('clients').select('*'),
      supabase.from('competences').select('*'),
      supabase.from('requests').select('*'),
      supabase.from('reports').select('*'),
      supabase.from('transactions').select('*')
    ]);

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
    console.error("Erro ao carregar:", error);
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
