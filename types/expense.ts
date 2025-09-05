export interface Expense {
  id: string
  purpose: string
  amount: number
  date: string
  createdAt: string
  isReversed: boolean
  reversedAt?: string
  reversalReason?: string
  createdBy: string
  category?: string
  receiptNumber?: string
  notes?: string
}

export interface ExpenseCategory {
  id: string
  name: string
  description?: string
  isActive: boolean
}

export interface ExpenseSummary {
  period: {
    from: Date
    to: Date
  }
  totalExpenses: number
  totalReversed: number
  netExpenses: number
  count: number
  reversedCount: number
  totalTransactions: number
  reversedTransactions: number
}

export interface ExpenseFilter {
  startDate?: string
  endDate?: string
  category?: string
  purpose?: string
  minAmount?: number
  maxAmount?: number
  isReversed?: boolean
  createdBy?: string
  searchTerm?: string
  dateRange?: {
    from: Date
    to: Date
  }
}

export const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { id: "office", name: "Office Supplies", isActive: true },
  { id: "utilities", name: "Utilities", isActive: true },
  { id: "salaries", name: "Salaries", isActive: true },
  { id: "maintenance", name: "Maintenance", isActive: true },
  { id: "transport", name: "Transport", isActive: true },
  { id: "other", name: "Other", isActive: true },
]

export const EXPENSE_STORAGE_KEYS = {
  EXPENSES: "studentTrackExpenses",
  CATEGORIES: "studentTrackExpenseCategories",
  SETTINGS: "studentTrackExpenseSettings",
}

export interface ExpenseSettings {
  defaultCategory: string
  requireReceipt: boolean
  approvalRequired: boolean
  budgetCategories: {
    id: string
    name: string
    budget: number
    period: "monthly" | "quarterly" | "yearly"
  }[]
}
