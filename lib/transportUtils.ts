import type { Student, TransportPayment, AppSettings } from "../types/index"
import { getCurrentYear, getCurrentMonth } from "./dateUtils"

/**
 * Calculate the outstanding **transport** amount for a single student.
 * It sums unpaid transport payments (not skipped / not waived).
 */
export function calculateTransportOutstanding(student: Student): number {
  if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
    return 0
  }

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const activationDate = student.transportActivationDate ? new Date(student.transportActivationDate) : new Date()

  return student.transportPayments.reduce((total, payment) => {
    // Only count outstanding for months that are current or past and after activation
    const paymentMonth = payment.month
    const isCurrentOrPast = paymentMonth <= currentMonth
    const isAfterActivation = paymentMonth >= activationDate.getMonth() + 1

    if (isCurrentOrPast && isAfterActivation && !payment.isSkipped) {
      return total + payment.outstandingAmount
    }
    return total
  }, 0)
}

/**
 * Initialize transport payments for a student
 */
export function initializeTransportPayments(
  student: Student,
  transportFee: number,
  activationDate: string,
  settings: any,
): TransportPayment[] {
  const payments: TransportPayment[] = []
  const currentYear = getCurrentYear()
  const activationMonth = new Date(activationDate).getMonth() + 1

  // Transport months (9 months: Jan-Mar, May-Jul, Sep-Nov)
  const transportMonths = [1, 2, 3, 5, 6, 7, 9, 10, 11]

  // Month names for display
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ]

  transportMonths.forEach((month) => {
    // Only create payments for months from activation onwards
    if (month >= activationMonth) {
      const dueDate = new Date(currentYear, month - 1, settings.transportDueDate || 7).toISOString().split("T")[0]

      payments.push({
        month: month,
        monthName: monthNames[month - 1], // Add monthName property
        amountDue: transportFee,
        amountPaid: 0,
        paid: false,
        dueDate: dueDate,
        paidDate: undefined,
        isWaived: false, // Add isWaived property
        outstandingAmount: transportFee,
        isActive: true, // Add isActive property
        isSkipped: false,
      })
    }
  })

  return payments
}

/**
 * Get transport payment statistics for a student
 */
export function getTransportStats(student: Student): {
  totalDue: number
  totalPaid: number
  totalOutstanding: number
  skippedMonths: number
  activeMonths: number
} {
  if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
    return {
      totalDue: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      skippedMonths: 0,
      activeMonths: 0,
    }
  }

  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const activationDate = student.transportActivationDate ? new Date(student.transportActivationDate) : new Date()

  let totalDue = 0
  let totalPaid = 0
  let totalOutstanding = 0
  let skippedMonths = 0
  let activeMonths = 0

  student.transportPayments.forEach((payment) => {
    const paymentMonth = payment.month
    const isCurrentOrPast = paymentMonth <= currentMonth
    const isAfterActivation = paymentMonth >= activationDate.getMonth() + 1

    if (isCurrentOrPast && isAfterActivation) {
      if (payment.isSkipped) {
        skippedMonths++
      } else {
        activeMonths++
        totalDue += payment.amountDue
        totalPaid += payment.amountPaid
        totalOutstanding += payment.outstandingAmount
      }
    }
  })

  return {
    totalDue,
    totalPaid,
    totalOutstanding,
    skippedMonths,
    activeMonths,
  }
}

/**
 * Update transport payment for a specific month
 */
export function updateTransportPayment(student: Student, month: number, amountPaid: number): Student {
  if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
    return student
  }

  const updatedPayments = student.transportPayments.map((payment) => {
    if (payment.month === month) {
      const updatedPayment = { ...payment }
      updatedPayment.amountPaid = Math.max(0, amountPaid)
      updatedPayment.outstandingAmount = Math.max(0, updatedPayment.amountDue - updatedPayment.amountPaid)
      updatedPayment.paid = updatedPayment.outstandingAmount <= 0.01
      updatedPayment.paidDate = updatedPayment.paid ? new Date().toISOString().split("T")[0] : undefined
      return updatedPayment
    }
    return payment
  })

  return {
    ...student,
    transportPayments: updatedPayments,
  }
}

/**
 * Toggle skip status for a transport payment month
 */
export function toggleTransportSkip(student: Student, month: number, skip: boolean): Student {
  if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
    return student
  }

  const updatedPayments = student.transportPayments.map((payment) => {
    if (payment.month === month) {
      const updatedPayment = { ...payment }
      updatedPayment.isSkipped = skip
      if (skip) {
        updatedPayment.amountDue = 0
        updatedPayment.amountPaid = 0
        updatedPayment.outstandingAmount = 0
        updatedPayment.paid = true
      } else {
        updatedPayment.amountDue = student.transportFee
        updatedPayment.outstandingAmount = updatedPayment.amountDue - updatedPayment.amountPaid
        updatedPayment.paid = updatedPayment.outstandingAmount <= 0.01
      }
      return updatedPayment
    }
    return payment
  })

  return {
    ...student,
    transportPayments: updatedPayments,
  }
}

//---------------------------------------------------------------------
// Transport service on/off helpers
//---------------------------------------------------------------------

/**
 * Activate the transport service for a student.
 *  • Creates fresh transportPayments (from activation month -> Nov)
 *  • Marks `hasTransport` true and stores the activation date / fee
 */
export function activateTransportForStudent(
  student: Student,
  transportFee: number,
  activationDate: string,
  settings: AppSettings,
): Student {
  // Build fresh payment schedule
  const payments = initializeTransportPayments(student, transportFee, activationDate, settings)

  return {
    ...student,
    hasTransport: true,
    transportFee,
    transportActivationDate: activationDate,
    transportPayments: payments,
  }
}

/**
 * Deactivate the transport service.
 *  • Removes transportPayments
 *  • Flags all existing school-fee payments as transport-waived
 *  • Sets hasTransport false and transportFee → 0
 */
export function deactivateTransportForStudent(student: Student): Student {
  // Update feePayments so they no longer include a transport component
  const updatedFeePayments = Array.isArray(student.feePayments)
    ? student.feePayments.map((p) => {
        if (p.isTransportWaived) return p
        const newAmountDue = Math.max(0, p.amountDue - student.transportFee)
        const outstanding = Math.max(0, newAmountDue - p.amountPaid)
        return {
          ...p,
          isTransportWaived: true,
          amountDue: newAmountDue,
          outstandingAmount: outstanding,
          paid: outstanding <= 0.01,
        }
      })
    : []

  return {
    ...student,
    hasTransport: false,
    transportFee: 0,
    transportActivationDate: undefined,
    transportPayments: [],
    feePayments: updatedFeePayments,
  }
}

// Keep all your existing functions below with updates where needed
export function skipTransportForMonth(student: Student, month: number, skip: boolean): Student {
  if (!student.transportPayments) {
    return student
  }

  const updatedTransportPayments = student.transportPayments.map((payment) => {
    if (payment.month === month) {
      return {
        ...payment,
        isSkipped: skip,
        amountDue: skip ? 0 : student.transportFee,
        outstandingAmount: skip ? 0 : Math.max(0, (skip ? 0 : student.transportFee) - payment.amountPaid),
        paid: skip ? true : payment.outstandingAmount <= 0.01,
      }
    }
    return payment
  })

  return {
    ...student,
    transportPayments: updatedTransportPayments,
  }
}

export function waiveTransportForMonth(student: Student, month: number, waive: boolean): Student {
  if (!student.transportPayments) {
    return student
  }

  const updatedTransportPayments = student.transportPayments.map((payment) => {
    if (payment.month === month) {
      const newAmountDue = waive ? 0 : student.transportFee
      const outstanding = Math.max(0, newAmountDue - payment.amountPaid)
      return {
        ...payment,
        isWaived: waive,
        amountDue: newAmountDue,
        outstandingAmount: outstanding,
        paid: outstanding <= 0.01,
      }
    }
    return payment
  })

  return {
    ...student,
    transportPayments: updatedTransportPayments,
  }
}

export function getTransportPaymentStatus(payment: TransportPayment): {
  status: string
  color: string
  icon: string
  statusType: string
} {
  try {
    if (!payment) {
      return { status: "Unknown", color: "bg-gray-100", icon: "❓", statusType: "FUTURE" }
    }

    if (!payment.isActive) {
      return { status: "Inactive", color: "bg-gray-100", icon: "⚪", statusType: "FUTURE" }
    }

    if (payment.isSkipped) {
      return { status: "Skipped", color: "bg-blue-100", icon: "⏭️", statusType: "SKIPPED" }
    }

    if (payment.isWaived) {
      return { status: "Waived", color: "bg-blue-100", icon: "🔵", statusType: "WAIVED" }
    }

    if (payment.paid) {
      return { status: "Paid", color: "bg-green-100", icon: "✅", statusType: "PAID_IN_FULL" }
    }

    if (payment.outstandingAmount > 0) {
      const currentMonth = getCurrentMonth()
      if (payment.month < currentMonth) {
        return { status: "Overdue", color: "bg-red-100", icon: "🔴", statusType: "UNPAID" }
      } else if (payment.month === currentMonth) {
        return { status: "Due", color: "bg-yellow-100", icon: "⚠️", statusType: "UNPAID" }
      }
    }

    return { status: "Pending", color: "bg-gray-100", icon: "⏳", statusType: "FUTURE" }
  } catch (error) {
    console.warn("Error getting transport payment status:", error)
    return { status: "Error", color: "bg-red-100", icon: "❌", statusType: "UNPAID" }
  }
}

export function getTransportSummary(student: Student): {
  totalDue: number
  totalPaid: number
  totalOutstanding: number
  skippedMonths: number[]
  activeMonths: number
  paidMonths: number
} {
  if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
    return {
      totalDue: 0,
      totalPaid: 0,
      totalOutstanding: 0,
      skippedMonths: [],
      activeMonths: 0,
      paidMonths: 0,
    }
  }

  const currentMonth = getCurrentMonth()
  const currentYear = getCurrentYear()

  // Get activation date to determine when transport billing started
  const activationDate = student.transportActivationDate
    ? new Date(student.transportActivationDate)
    : new Date(currentYear, 0, 1) // Default to start of year if no activation date

  let totalDue = 0
  let totalPaid = 0
  let totalOutstanding = 0
  const skippedMonths: number[] = []
  let activeMonths = 0
  let paidMonths = 0

  student.transportPayments.forEach((payment) => {
    const paymentDate = new Date(currentYear, payment.month - 1, 1)
    const isAfterActivation = paymentDate >= activationDate
    const isCurrentOrPast = payment.month <= currentMonth

    if (payment.isActive && isAfterActivation && isCurrentOrPast) {
      activeMonths++
      if (payment.isSkipped) {
        skippedMonths.push(payment.month)
      } else {
        totalDue += payment.amountDue
        totalPaid += payment.amountPaid
        totalOutstanding += payment.outstandingAmount
        if (payment.paid) {
          paidMonths++
        }
      }
    }
  })

  return {
    totalDue,
    totalPaid,
    totalOutstanding,
    skippedMonths,
    activeMonths,
    paidMonths,
  }
}

export function getTransportMonthsForDisplay(): Array<{
  month: number
  name: string
  isTransportMonth: boolean
}> {
  const allMonths = [
    { month: 1, name: "Jan" },
    { month: 2, name: "Feb" },
    { month: 3, name: "Mar" },
    { month: 4, name: "Apr" },
    { month: 5, name: "May" },
    { month: 6, name: "Jun" },
    { month: 7, name: "Jul" },
    { month: 8, name: "Aug" },
    { month: 9, name: "Sep" },
    { month: 10, name: "Oct" },
    { month: 11, name: "Nov" },
    { month: 12, name: "Dec" },
  ]

  // Transport months (9 months: Jan-Mar, May-Jul, Sep-Nov)
  const transportMonthNumbers = [1, 2, 3, 5, 6, 7, 9, 10, 11]

  return allMonths.map((month) => ({
    ...month,
    isTransportMonth: transportMonthNumbers.includes(month.month),
  }))
}
