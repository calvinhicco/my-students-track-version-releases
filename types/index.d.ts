// Student type
export interface Student {
  id: string;
  fullName: string;
  className: string;
  classGroup: string;
  academicYear: string;
  admissionDate: string;
  gender: 'Male' | 'Female' | 'Other' | '';
  dateOfBirth: string;
  parentName: string;
  parentPhone: string;
  address: string;
  hasTransport: boolean;
  transportFee: number;
  feePayments: Array<{
    period: number;
    amountDue: number;
    amountPaid: number;
    paid: boolean;
    dueDate: string;
    paidDate?: string;
    isTransportWaived: boolean;
    outstandingAmount: number;
  }>;
  transportPayments: Array<{
    month: number;
    monthName: string;
    amountDue: number;
    amountPaid: number;
    paid: boolean;
    dueDate: string;
    paidDate?: string;
    isWaived: boolean;
    outstandingAmount: number;
    isActive: boolean;
    isSkipped: boolean;
  }>;
  totalPaid: number;
  totalOwed: number;
  isActive: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// Settings type
export interface Settings {
  academicYear?: number | string;
  schoolName?: string;
  // Add other settings properties as needed
}

// Expense type
export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: Date | string;
  category: string;
  // Add other expense properties as needed
}

// Add any other shared types here
