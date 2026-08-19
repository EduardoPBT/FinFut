export type MemberRole = "voce" | "esposa";
export type IncomeKind = "fixo" | "variavel";
export type CategoryKind = "receita" | "fixa" | "variavel";
export type TransactionOrigin = "app" | "whatsapp" | "telegram";
export type BillStatus = "pendente" | "pago" | "atrasado";
export type BillDisplayStatus = BillStatus | "vence_hoje";
export type IncomeInstanceStatus = "pendente" | "recebido";
export type IncomeDisplayStatus = IncomeInstanceStatus | "vence_hoje" | "atrasado";
export type PaymentMethod = "pix" | "debito" | "credito" | "boleto" | "outro";
export type BankAccountKind = "corrente" | "poupanca" | "dinheiro";
export type CardStatementStatus = "aberta" | "fechada" | "paga";
export type MovementKind = "receita" | "despesa" | "transferencia";
export type InboundStatus = "pending" | "parsed" | "failed";
export type Mood = "good" | "ok" | "tight" | "empty";

export type Household = {
  id: string;
  owner_id: string;
  name: string;
  created_at: string;
  invite_code?: string | null;
  reminder_days?: number;
  telegram_chat_id?: string | null;
};

export type Member = {
  id: string;
  household_id: string;
  display_name: string;
  role: MemberRole;
};

export type IncomeSource = {
  id: string;
  household_id: string;
  member_id: string | null;
  name: string;
  kind: IncomeKind;
  typical_amount_cents: number;
  payday: number | null;
  active: boolean;
  category_id: string | null;
  default_account_id: string | null;
};

export type IncomeInstance = {
  id: string;
  household_id: string;
  income_source_id: string;
  competence: string;
  amount_cents: number;
  expected_on: string;
  status: IncomeInstanceStatus;
  received_at: string | null;
  received_on: string | null;
  transaction_id: string | null;
  suppress_auto_receive: boolean;
  account_id: string | null;
};

export type IncomeInstanceView = Omit<IncomeInstance, "status"> & {
  status: IncomeDisplayStatus;
};

export type Category = {
  id: string;
  household_id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  sort_order: number;
};

export type Transaction = {
  id: string;
  household_id: string;
  member_id: string | null;
  category_id: string | null;
  amount_cents: number;
  occurred_on: string;
  notes: string | null;
  origin: TransactionOrigin;
  bill_instance_id: string | null;
  income_instance_id: string | null;
  account_id: string | null;
  card_charge_id: string | null;
  statement_payment_id: string | null;
  destination_account_id?: string | null;
  goal_id?: string | null;
  movement_kind: MovementKind;
  created_at: string;
};

export type RecurringBill = {
  id: string;
  household_id: string;
  category_id: string | null;
  name: string;
  amount_cents: number;
  due_day: number;
  active: boolean;
  default_account_id: string | null;
  default_credit_card_id: string | null;
  default_payment_method: PaymentMethod | null;
  amount_flexible?: boolean;
};

export type BillInstance = {
  id: string;
  household_id: string;
  recurring_bill_id: string;
  competence: string;
  amount_cents: number;
  due_on: string;
  status: BillStatus;
  paid_at: string | null;
  paid_on: string | null;
  payment_method: PaymentMethod | null;
  payment_account: string | null;
  transaction_id: string | null;
  account_id: string | null;
  credit_card_id: string | null;
  card_charge_id: string | null;
};

export type BillInstanceView = Omit<BillInstance, "status"> & {
  status: BillDisplayStatus;
};

export type Goal = {
  id: string;
  household_id: string;
  name: string;
  target_cents: number;
  current_cents: number;
  due_on: string | null;
  priority: number;
  account_id: string | null;
};

export type Workspace = {
  household: Household;
  members: Member[];
  categories: Category[];
  incomeSources: IncomeSource[];
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
};

export type BankAccount = {
  id: string;
  household_id: string;
  name: string;
  kind: BankAccountKind;
  initial_balance_cents: number;
  active: boolean;
};

export type CreditCard = {
  id: string;
  household_id: string;
  name: string;
  closing_day: number;
  due_day: number;
  payment_account_id: string | null;
  credit_limit_cents?: number | null;
  active: boolean;
};

export type CardStatement = {
  id: string;
  household_id: string;
  credit_card_id: string;
  cycle_start: string;
  cycle_end: string;
  due_on: string;
  status: CardStatementStatus;
  paid_on: string | null;
  payment_transaction_id: string | null;
  paid_cents?: number;
};

export type CardCharge = {
  id: string;
  household_id: string;
  credit_card_id: string;
  card_statement_id: string;
  category_id: string | null;
  member_id: string | null;
  amount_cents: number;
  occurred_on: string;
  notes: string | null;
  installment_group_id: string | null;
  installment_number: number;
  installment_total: number;
  bill_instance_id: string | null;
};

export type CardStatementView = CardStatement & {
  displayStatus: CardStatementStatus | "futura";
  totalCents: number;
  charges: CardCharge[];
};

export type CreditCardView = CreditCard & {
  paymentAccountName: string | null;
  currentStatement: CardStatementView | null;
};

export type CategoryBudget = {
  id: string;
  household_id: string;
  category_id: string;
  monthly_limit_cents: number;
};

export type AnnualEvent = {
  id: string;
  household_id: string;
  name: string;
  kind: CategoryKind;
  event_month: number;
  amount_cents: number;
  due_day: number;
  category_id: string | null;
  active: boolean;
};

export type InboundMessage = {
  id: string;
  household_id: string;
  raw_text: string;
  parse_status: InboundStatus;
  parsed_amount_cents: number | null;
  parsed_category_id: string | null;
  parsed_installments?: number;
  parsed_payment_method?: PaymentMethod | null;
  parsed_kind?: MovementKind | null;
  telegram_update_id?: number | null;
  confidence?: number | null;
  source?: string;
  error: string | null;
  created_at: string;
};

