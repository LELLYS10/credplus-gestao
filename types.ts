export enum UserRole {
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER'
}

// Tipo de grupo do usuário
export enum UserGroupType {
  GRUPO_A = 'GRUPO A',
  GRUPO_B = 'GRUPO B',
  GRUPO_ESPECIAL = 'GRUPO ESPECIAL'
}

// Status de aprovação do cadastro
export enum ApprovalStatus {
  PENDENTE = 'PENDENTE',
  APROVADO = 'APROVADO',
  REJEITADO = 'REJEITADO'
}

// Tipo de empréstimo
export enum LoanType {
  RECORRENTE = 'recorrente',
  PARCELADO = 'parcelado',
  TERCEIRO = 'terceiro'
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  // Tipo de grupo (Grupo A, B ou Especial)
  groupType: UserGroupType;
  // Nome do usuário/gestor (ex: JAILTON, RICARDO, SANNY, etc)
  managerName?: string;
  groupId?: string;
  status?: 'ACTIVE' | 'BLOCKED';
  // Permissões
  canCreateClient?: boolean;
  canCreateContract?: boolean;
  canApprove?: boolean;
  canDelete?: boolean;
  canManageAll?: boolean;
  // Comissão para Grupo B (percentual sobre juros recebidos)
  commissionPercent?: number;
  thirdPartyBlocked?: boolean;
  updatedAt?: number;
}

export interface Group {
  id: string;
  name: string;
  email: string;
  phone: string;
  interestRate: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  groupId: string;
  // Quem criou o cadastro
  createdBy?: string;
  // Status de aprovação
  approvalStatus: ApprovalStatus;
  // Quem aprovou
  approvedBy?: string;
  approvedAt?: number;
  // Tipo de empréstimo
  loanType?: LoanType;
  // Taxa de juros (percentual)
  interestRate: number;
  // Comissão (percentual) - aplicável para Grupo B
  commissionPercent?: number;
  // Dados do empréstimo
  initialCapital: number;
  currentCapital: number;
  dueDay: number;
  // Parcelas (se parcelado)
  installmentsCount?: number;
  firstDueDate?: number;
  // Status do contrato
  status: 'ACTIVE' | 'INACTIVE';
  notes: string;
  createdAt: number;
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

// Clientes de terceiros (exclusivo Grupo A)
export interface ThirdPartyClient {
  id: string;
  userId: string;
  nome: string;
  telefone: string;
  observacoes: string;
  createdAt: number;
}

// Empréstimos de terceiros (exclusivo Grupo A)
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

// Pagamentos de terceiros
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
