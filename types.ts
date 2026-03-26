eexport enum UserRole {
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER'
}

export enum UserGroupType {
  GRUPO_A = 'GRUPO_A',
  GRUPO_B = 'GRUPO_B',
  GRUPO_ESPECIAL = 'GRUPO_ESPECIAL'
}

export enum ClientApprovalStatus {
  PRE_CADASTRO = 'PRE_CADASTRO',
  AGUARDANDO_ADM = 'AGUARDANDO_ADM',
  ATIVO = 'ATIVO',
  REJEITADO = 'REJEITADO'
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  groupId?: string;
  status?: 'ACTIVE' | 'BLOCKED';
  thirdPartyBlocked?: boolean;
  updatedAt?: number;
  groupType?: UserGroupType;
  canCreateClient?: boolean;
  canCreateContract?: boolean;
  canApprove?: boolean;
  canDelete?: boolean;
  canManageAll?: boolean;
  commissionVisibility?: boolean;
}

export interface Group {
  id: string;
  name: string;
  email: string;
  phone: string;
  interestRate: number;
  commissionRate?: number;
  groupType?: UserGroupType;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  groupId: string;
  initialCapital: number;
  currentCapital: number;
  dueDay: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string;
  createdAt: number;
  firstDueDate?: number;
  approvalStatus?: ClientApprovalStatus;
  createdBy?: string;
  approvedBy?: string;
  approvedAt?: number;
  assignedGroupType?: UserGroupType;
  contractValue?: number;
  contractRate?: number;
  contractCommission?: number;
  contractDueDate?: string;
  contractNotes?: string;
}

export interface Competence {
  id: string;
  clientId: string;
  month: number;
  year: number;
  originalValue: number;
  paidAmount: number;
  capitalAtTime?: number;
  lastUpdated: number;
  dueDate?: number;
}

export enum TransactionType {
  INVESTMENT = 'INVESTMENT',
  WITHDRAWAL = 'WITHDRAWAL',
  AMORTIZATION = 'AMORTIZATION'
}

export interface Transaction {
  id: string;
  clientId: string;
  type: TransactionType;
  amount: number;
  description: string;
  createdAt: number;
}

export enum RequestStatus {
  PENDING = 'PENDING',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
}

export interface PaymentRequest {
  id: string;
  clientId: string;
  groupId: string;
  interestValue: number;
  amortizationValue: number;
  discountValue?: number;
  observation: string;
  status: RequestStatus;
  requesterId: string;
  createdAt: number;
}

export interface Report {
  id: string;
  name: string;
  createdAt: number;
  totalCapital: number;
  totalInterest: number;
  dataJson: any;
}

export interface AppSettings {
  [key: string]: any;
}

export interface ThirdPartyClient {
  id: string;
  userId: string;
  nome: string;
  telefone: string;
  observacoes: string;
  createdAt: number;
}

export interface ThirdPartyLoan {
  id: string;
  userId: string;
  clientId: string;
  valorPrincipal: number;
  porcentagemJurosMensal: number;
  dataEmprestimo: string;
  dataPagamentoJuros: string;
  status: 'ativo' | 'encerrado';
  createdAt: number;
}

export interface ThirdPartyPayment {
  id: string;
  userId: string;
  loanId: string;
  dataPagamento: string;
  valor: number;
  tipo: 'juros' | 'amortizacao';
  observacao: string;
  createdAt: number;
}

export interface DBState {
  users: User[];
  groups: Group[];
  clients: Client[];
  competences: Competence[];
  requests: PaymentRequest[];
  reports: Report[];
  transactions: Transaction[];
  settings: AppSettings;
  thirdPartyClients?: ThirdPartyClient[];
  thirdPartyLoans?: ThirdPartyLoan[];
  thirdPartyPayments?: ThirdPartyPayment[];
}

export const getUserPermissions = (user: User) => {
  const isAdmin = user.role === UserRole.ADMIN;
  const groupType = user.groupType;
  const isGrupoB = groupType === UserGroupType.GRUPO_B;
  return {
    canCreateClient: true,
    canCreateContract: isAdmin,
    canApprove: isAdmin,
    canDelete: isAdmin,
    canManageAll: isAdmin,
    canViewCommission: isAdmin || isGrupoB,
    canViewAllData: isAdmin,
    canAccessX4: isAdmin,
    isAdmin,
    isGrupoA: groupType === UserGroupType.GRUPO_A,
    isGrupoB,
    isGrupoEspecial: groupType === UserGroupType.GRUPO_ESPECIAL || isAdmin,
  };
};
