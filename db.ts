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

    if (users && users.length > 0) {
      console.log("🔍 Estrutura do usuário no Supabase:", Object.keys(users[0]));
      console.log("🔍 Exemplo de valor third_party_blocked:", (users[0] as any).third_party_blocked);
      console.log("🔍 Exemplo de valor thirdPartyBlocked:", (users[0] as any).thirdPartyBlocked);
    }

    // Mesclar dados do Supabase com dados locais para preservar campos extras
    // que podem não existir nas colunas do Supabase ainda.
    const usersMap = new Map<string, any>();

    (users || []).forEach(u => {
      const userId = String(u.id);
      const localUser = localState.users.find(lu => String(lu.id) === userId);
      
      // Mapeamento de campos do Supabase (snake_case) para o App (camelCase)
      const supabaseBlocked = u.third_party_blocked !== undefined ? u.third_party_blocked : u.thirdPartyBlocked;
      const supabaseUpdatedAt = u.updated_at !== undefined ? u.updated_at : u.updatedAt;
      
      // Lógica de Conflito: Quem tiver o updatedAt maior vence.
      const localUpdatedAt = localUser?.updatedAt || 0;
      const finalBlockedStatus = (supabaseUpdatedAt >= localUpdatedAt || !localUser)
        ? (supabaseBlocked !== null && supabaseBlocked !== undefined ? supabaseBlocked : (localUser?.thirdPartyBlocked ?? false))
        : (localUser?.thirdPartyBlocked ?? false);

      const userWithMappedFields = {
        ...(localUser || {}),
        ...u,
        id: userId, // Garante que o ID seja string
        thirdPartyBlocked: finalBlockedStatus,
        updatedAt: Math.max(Number(supabaseUpdatedAt) || 0, localUpdatedAt)
      };

      if ((userWithMappedFields as any).third_party_blocked !== undefined) {
        delete (userWithMappedFields as any).third_party_blocked;
      }
      if ((userWithMappedFields as any).updated_at !== undefined) {
        delete (userWithMappedFields as any).updated_at;
      }

      // Se já existe no mapa, mescla (o do Supabase mais recente/último ganha)
      const existing = usersMap.get(userId);
      usersMap.set(userId, { ...(existing || {}), ...userWithMappedFields });
    });

    const mergedUsers = Array.from(usersMap.values());
    
    mergedUsers.forEach(u => {
      if (u.role === UserRole.VIEWER || u.groupId) {
        console.log(`👤 Sócio: ${u.email} | Bloqueado: ${u.thirdPartyBlocked} | ID: ${u.id}`);
      }
    });

    // Adicionar usuários que existem localmente mas não no Supabase (ex: admins recém criados)
    localState.users.forEach(lu => {
      if (!mergedUsers.find(mu => mu.id === lu.id)) {
        mergedUsers.push(lu);
      }
    });

    return {
      users: mergedUsers.length > 0 ? mergedUsers : localState.users,
      groups: groups !== null ? groups : localState.groups,
      clients: clients !== null ? clients : [], // Prioritize Supabase, ignore local if Supabase is active
      competences: competences !== null ? competences : localState.competences,
      requests: requests !== null ? requests : localState.requests,
      reports: reports !== null ? reports : localState.reports,
      transactions: transactions !== null ? transactions : localState.transactions,
      settings: localState.settings || {},
      thirdPartyClients: tpClients !== null ? tpClients : (localState.thirdPartyClients || []),
      thirdPartyLoans: tpLoans !== null ? tpLoans : (localState.thirdPartyLoans || []),
      thirdPartyPayments: tpPayments !== null ? tpPayments : (localState.thirdPartyPayments || [])
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
    // Preparar dados para o Supabase
    // Garantimos que apenas campos conhecidos e necessários sejam enviados
    // para evitar erros de "coluna não existe" no Supabase.
    const usersToSave = state.users.map(u => {
      const payload: any = {
        id: String(u.id),
        email: u.email,
        role: u.role,
        third_party_blocked: u.thirdPartyBlocked ?? false,
        thirdPartyBlocked: u.thirdPartyBlocked ?? false,
        updated_at: u.updatedAt || Date.now(),
        updatedAt: u.updatedAt || Date.now()
      };
      
      // Só inclui campos opcionais se eles existirem
      if (u.password) payload.password = u.password;
      if (u.groupId) payload.groupId = u.groupId;
      if (u.status) payload.status = u.status;
      
      return payload;
    });

    console.log("🔄 Sincronizando com Supabase...");
    const blockedUsers = usersToSave.filter(u => u.third_party_blocked);
    if (blockedUsers.length > 0) {
      console.log("🚫 Salvando usuários bloqueados:", blockedUsers.map(u => u.email));
    }

    const results = await Promise.all([
      usersToSave.length > 0 ? supabase.from('users').upsert(usersToSave) : Promise.resolve({ error: null, data: null }),
      state.groups.length > 0 ? supabase.from('groups').upsert(state.groups) : Promise.resolve({ error: null, data: null }),
      state.clients.length > 0 ? supabase.from('clients').upsert(state.clients) : Promise.resolve({ error: null, data: null }),
      state.competences.length > 0 ? supabase.from('competences').upsert(state.competences) : Promise.resolve({ error: null, data: null }),
      state.requests.length > 0 ? supabase.from('requests').upsert(state.requests) : Promise.resolve({ error: null, data: null }),
      state.reports.length > 0 ? supabase.from('reports').upsert(state.reports) : Promise.resolve({ error: null, data: null }),
      state.transactions.length > 0 ? supabase.from('transactions').upsert(state.transactions) : Promise.resolve({ error: null, data: null }),
      (state.thirdPartyClients && state.thirdPartyClients.length > 0) ? supabase.from('third_party_clients').upsert(state.thirdPartyClients) : Promise.resolve({ error: null, data: null }),
      (state.thirdPartyLoans && state.thirdPartyLoans.length > 0) ? supabase.from('third_party_loans').upsert(state.thirdPartyLoans) : Promise.resolve({ error: null, data: null }),
      (state.thirdPartyPayments && state.thirdPartyPayments.length > 0) ? supabase.from('third_party_payments').upsert(state.thirdPartyPayments) : Promise.resolve({ error: null, data: null }),
    ]);

    // Verificar se houve erro em algum upsert
    const tableNames = [
      'users', 'groups', 'clients', 'competences', 'requests', 
      'reports', 'transactions', 'third_party_clients', 
      'third_party_loans', 'third_party_payments'
    ];

    let hasError = false;
    results.forEach((res, index) => {
      if (res && (res as any).error) {
        hasError = true;
        console.error(`❌ Erro Supabase [Tabela: ${tableNames[index]}]:`, (res as any).error);
      }
    });

    if (!hasError) console.log("✅ Sincronização concluída com sucesso!");

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
    // O usuário solicitou campos específicos: id, name, phone, groupId
    const payload = {
      id: client.id,
      name: client.name,
      phone: client.phone,
      groupId: client.groupId,
      // Incluindo os outros campos para manter a integridade do app, 
      // mas garantindo que os solicitados estejam presentes.
      initialCapital: client.initialCapital || 0,
      currentCapital: client.currentCapital || 0,
      dueDay: client.dueDay || 1,
      status: client.status || 'ACTIVE',
      notes: client.notes || '',
      createdAt: client.createdAt || Date.now(),
      firstDueDate: client.firstDueDate || null
    };

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
