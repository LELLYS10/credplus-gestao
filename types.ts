
export enum UserRole {
  ADMIN = 'ADMIN',
  VIEWER = 'VIEWER'
}

export interface User {
  id: string;
  email: string;
  password: string;
  role: UserRole;
  groupId?: string;
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
  initialCapital: number;
  currentCapital: number;
  dueDay: number;
  status: 'ACTIVE' | 'INACTIVE';
  notes: string;
  createdAt: number;
  firstDueDate?: number;
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

// Added AppSettings interface to fix compilation error in Dashboard component
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
