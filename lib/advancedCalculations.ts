import type { Student, BillingCycleType, FeePayment, AppSettings } from "../types/index"
import { BillingCycle, TRANSPORT_MONTHS } from "../types/index"
import { getStartOfTerm } from "./dateUtils"

/**
 * Advanced Fee Management and Calculations System
 * Provides comprehensive fee calculations with flexible payment structures
 */

export interface AdvancedStudentTotals {
  // Core totals
  totalPaid: number
  totalOwed: number
  annualFeeCalculated: number

  // Detailed breakdowns
  schoolFees: {
    total: number
    paid: number
    outstanding: number
    periodsOwed: number
    completionRate: number
  }

  transport: {
    total: number
    paid: number
    outstanding: number
    monthsActive: number
    monthsSkipped: number
    monthsPaid: number
    completionRate: number
    utilizationRate: number
  }

  // Payment analysis
  paymentHistory: {
    totalPayments: number
    averagePaymentAmount: number
    lastPaymentDate: string | null
    paymentFrequency: number // payments per month
    consistencyScore: number // 0-100
  }

  // Outstanding analysis
  outstandingAnalysis: {
    totalOutstanding: number
    daysPastDue: number
    oldestUnpaidPeriod: string | null
    criticalityScore: number // 0-100
    recommendedAction: string
    paymentPlan: {
      suggestedMonthlyAmount: number
      numberOfMonths: number
      totalAmount: number
    }
  }

  // Projections
  projections: {
    expectedAnnualTotal: number
    projectedCompletionDate: string | null
    riskLevel: "low" | "medium" | "high" | "critical"
    collectionProbability: number // 0-100
  }
}

export interface FlexibleFeeStructure {
  baseAmount: number
  discounts: Array<{
    type: "percentage" | "fixed"
    value: number
    reason: string
    appliedDate: string
    expiryDate?: string
  }>
  penalties: Array<{
    type: "late_fee" | "interest" | "fixed"
    value: number
    reason: string
    appliedDate: string
    compoundingRate?: number
  }>
  adjustments: Array<{
    type: "credit" | "debit"
    amount: number
    reason: string
    appliedDate: string
    reference?: string
  }>
  finalAmount: number
}

export interface PaymentPlan {
  id: string
  studentId: string
  totalAmount: number
  monthlyAmount: number
  startDate: string
  endDate: string
  installments: Array<{
    dueDate: string
    amount: number
    paid: boolean
    paidDate?: string
    paidAmount?: number
  }>
  status: "active" | "completed" | "defaulted" | "cancelled"
  createdDate: string
  notes?: string
}

/**
 * Calculate comprehensive student totals with advanced analysis
 */
export function calculateAdvancedStudentTotals(
  student: Student,
  billingCycle: BillingCycleType,
  settings: AppSettings,
): AdvancedStudentTotals {
  const currentDate = new Date()
  const admissionDate = new Date(student.admissionDate)

  // Initialize result structure
  const result: AdvancedStudentTotals = {
    totalPaid: 0,
    totalOwed: 0,
    annualFeeCalculated: 0,
    schoolFees: {
      total: 0,
      paid: 0,
      outstanding: 0,
      periodsOwed: 0,
      completionRate: 0,
    },
    transport: {
      total: 0,
      paid: 0,
      outstanding: 0,
      monthsActive: 0,
      monthsSkipped: 0,
      monthsPaid: 0,
      completionRate: 0,
      utilizationRate: 0,
    },
    paymentHistory: {
      totalPayments: 0,
      averagePaymentAmount: 0,
      lastPaymentDate: null,
      paymentFrequency: 0,
      consistencyScore: 0,
    },
    outstandingAnalysis: {
      totalOutstanding: 0,
      daysPastDue: 0,
      oldestUnpaidPeriod: null,
      criticalityScore: 0,
      recommendedAction: "No action required",
      paymentPlan: {
        suggestedMonthlyAmount: 0,
        numberOfMonths: 0,
        totalAmount: 0,
      },
    },
    projections: {
      expectedAnnualTotal: 0,
      projectedCompletionDate: null,
      riskLevel: "low",
      collectionProbability: 100,
    },
  }

  // Calculate school fees
  if (Array.isArray(student.feePayments)) {
    const relevantPayments = student.feePayments.filter((payment) => {
      const periodDate =
        billingCycle === BillingCycle.MONTHLY
          ? new Date(currentDate.getFullYear(), payment.period - 1, 1)
          : getStartOfTerm(currentDate.getFullYear(), payment.period)

      return periodDate >= new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)
    })

    result.schoolFees.total = relevantPayments.reduce((sum, p) => sum + p.amountDue, 0)
    result.schoolFees.paid = relevantPayments.reduce((sum, p) => sum + p.amountPaid, 0)
    result.schoolFees.outstanding = relevantPayments.reduce((sum, p) => sum + p.outstandingAmount, 0)
    result.schoolFees.periodsOwed = relevantPayments.filter((p) => p.outstandingAmount > 0.01).length
    result.schoolFees.completionRate =
      result.schoolFees.total > 0 ? (result.schoolFees.paid / result.schoolFees.total) * 100 : 0
  }

  // Calculate transport fees
  if (student.hasTransport && Array.isArray(student.transportPayments)) {
    const activeTransportPayments = student.transportPayments.filter((tp) => tp.isActive)

    result.transport.total = activeTransportPayments.reduce((sum, tp) => sum + tp.amountDue, 0)
    result.transport.paid = activeTransportPayments.reduce((sum, tp) => sum + tp.amountPaid, 0)
    result.transport.outstanding = activeTransportPayments.reduce((sum, tp) => sum + tp.outstandingAmount, 0)
    result.transport.monthsActive = activeTransportPayments.length
    result.transport.monthsSkipped = student.transportPayments.filter((tp) => tp.isSkipped).length
    result.transport.monthsPaid = activeTransportPayments.filter((tp) => tp.paid).length
    result.transport.completionRate =
      result.transport.total > 0 ? (result.transport.paid / result.transport.total) * 100 : 0
    result.transport.utilizationRate =
      TRANSPORT_MONTHS.length > 0 ? (result.transport.monthsActive / TRANSPORT_MONTHS.length) * 100 : 0
  }

  // Calculate totals
  result.totalPaid = result.schoolFees.paid + result.transport.paid
  result.totalOwed = result.schoolFees.outstanding + result.transport.outstanding
  result.annualFeeCalculated = result.schoolFees.total + result.transport.total

  // Analyze payment history
  result.paymentHistory = analyzePaymentHistory(student, billingCycle)

  // Analyze outstanding payments
  result.outstandingAnalysis = analyzeOutstandingPayments(student, result, billingCycle, settings)

  // Generate projections
  result.projections = generatePaymentProjections(student, result, billingCycle, settings)

  return result
}

/**
 * Analyze payment history for patterns and consistency
 */
function analyzePaymentHistory(student: Student, billingCycle: BillingCycleType) {
  const payments: Array<{ date: string; amount: number }> = []

  // Collect all payments with dates
  if (Array.isArray(student.feePayments)) {
    student.feePayments.forEach((payment) => {
      if (payment.paid && payment.paidDate && payment.amountPaid > 0) {
        payments.push({
          date: payment.paidDate,
          amount: payment.amountPaid,
        })
      }
    })
  }

  if (Array.isArray(student.transportPayments)) {
    student.transportPayments.forEach((payment) => {
      if (payment.paid && payment.paidDate && payment.amountPaid > 0) {
        payments.push({
          date: payment.paidDate,
          amount: payment.amountPaid,
        })
      }
    })
  }

  // Sort payments by date
  payments.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const totalPayments = payments.length
  const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0)
  const averagePaymentAmount = totalPayments > 0 ? totalAmount / totalPayments : 0
  const lastPaymentDate = payments.length > 0 ? payments[payments.length - 1].date : null

  // Calculate payment frequency (payments per month)
  let paymentFrequency = 0
  if (payments.length > 1) {
    const firstPayment = new Date(payments[0].date)
    const lastPayment = new Date(payments[payments.length - 1].date)
    const monthsDiff = (lastPayment.getTime() - firstPayment.getTime()) / (1000 * 60 * 60 * 24 * 30)
    paymentFrequency = monthsDiff > 0 ? totalPayments / monthsDiff : 0
  }

  // Calculate consistency score based on regular payment patterns
  let consistencyScore = 0
  if (payments.length >= 3) {
    const intervals: number[] = []
    for (let i = 1; i < payments.length; i++) {
      const interval = new Date(payments[i].date).getTime() - new Date(payments[i - 1].date).getTime()
      intervals.push(interval / (1000 * 60 * 60 * 24)) // Convert to days
    }

    const averageInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    const variance =
      intervals.reduce((sum, interval) => sum + Math.pow(interval - averageInterval, 2), 0) / intervals.length
    const standardDeviation = Math.sqrt(variance)

    // Lower standard deviation = higher consistency
    consistencyScore = Math.max(0, 100 - (standardDeviation / averageInterval) * 100)
  }

  return {
    totalPayments,
    averagePaymentAmount,
    lastPaymentDate,
    paymentFrequency,
    consistencyScore: Math.min(100, Math.max(0, consistencyScore)),
  }
}

/**
 * Analyze outstanding payments and provide recommendations
 */
function analyzeOutstandingPayments(
  student: Student,
  totals: AdvancedStudentTotals,
  billingCycle: BillingCycleType,
  settings: AppSettings,
) {
  const currentDate = new Date()
  let daysPastDue = 0
  let oldestUnpaidPeriod: string | null = null
  let oldestDueDate = currentDate

  // Find oldest unpaid period
  if (Array.isArray(student.feePayments)) {
    student.feePayments.forEach((payment) => {
      if (!payment.paid && payment.outstandingAmount > 0.01) {
        const dueDate = new Date(payment.dueDate)
        if (dueDate < oldestDueDate) {
          oldestDueDate = dueDate
          oldestUnpaidPeriod =
            billingCycle === BillingCycle.MONTHLY ? getMonthName(payment.period) : `Term ${payment.period}`
        }
      }
    })
  }

  if (Array.isArray(student.transportPayments)) {
    student.transportPayments.forEach((payment) => {
      if (!payment.paid && payment.outstandingAmount > 0.01 && !payment.isSkipped) {
        const dueDate = new Date(payment.dueDate)
        if (dueDate < oldestDueDate) {
          oldestDueDate = dueDate
          oldestUnpaidPeriod = payment.monthName
        }
      }
    })
  }

  if (oldestDueDate < currentDate) {
    daysPastDue = Math.floor((currentDate.getTime() - oldestDueDate.getTime()) / (1000 * 60 * 60 * 24))
  }

  // Calculate criticality score (0-100)
  let criticalityScore = 0
  const outstandingAmount = totals.totalOwed

  // Factors affecting criticality
  const amountFactor = Math.min(50, (outstandingAmount / 1000) * 20) // Up to 50 points for amount
  const timeFactor = Math.min(30, (daysPastDue / 90) * 30) // Up to 30 points for time
  const consistencyFactor = Math.max(0, 20 - totals.paymentHistory.consistencyScore / 5) // Up to 20 points for poor consistency

  criticalityScore = amountFactor + timeFactor + consistencyFactor

  // Generate recommended action
  let recommendedAction = "No action required"
  if (criticalityScore > 80) {
    recommendedAction = "Immediate intervention required - Consider suspension"
  } else if (criticalityScore > 60) {
    recommendedAction = "Urgent action needed - Schedule parent meeting"
  } else if (criticalityScore > 40) {
    recommendedAction = "Follow up required - Send payment reminder"
  } else if (criticalityScore > 20) {
    recommendedAction = "Monitor closely - Gentle reminder"
  }

  // Generate payment plan suggestion
  const paymentPlan = generatePaymentPlan(outstandingAmount, totals.paymentHistory.averagePaymentAmount)

  return {
    totalOutstanding: outstandingAmount,
    daysPastDue,
    oldestUnpaidPeriod,
    criticalityScore: Math.min(100, Math.max(0, criticalityScore)),
    recommendedAction,
    paymentPlan,
  }
}

/**
 * Generate payment projections and risk assessment
 */
function generatePaymentProjections(
  student: Student,
  totals: AdvancedStudentTotals,
  billingCycle: BillingCycleType,
  settings: AppSettings,
) {
  const currentDate = new Date()
  const admissionDate = new Date(student.admissionDate)

  // Calculate expected annual total based on class group
  const classGroup = settings.classGroups.find((g) => g.id === student.classGroup)
  const baseAnnualFee = classGroup ? classGroup.standardFee * (billingCycle === BillingCycle.MONTHLY ? 12 : 3) : 0
  const transportAnnualFee = student.hasTransport ? (student.transportFee || 0) * TRANSPORT_MONTHS.length : 0
  const expectedAnnualTotal = baseAnnualFee + transportAnnualFee

  // Project completion date based on payment history
  let projectedCompletionDate: string | null = null
  if (totals.paymentHistory.paymentFrequency > 0 && totals.totalOwed > 0) {
    const monthsToComplete =
      totals.totalOwed / (totals.paymentHistory.averagePaymentAmount * totals.paymentHistory.paymentFrequency)
    const completionDate = new Date()
    completionDate.setMonth(completionDate.getMonth() + Math.ceil(monthsToComplete))
    projectedCompletionDate = completionDate.toISOString().split("T")[0]
  }

  // Assess risk level
  let riskLevel: "low" | "medium" | "high" | "critical" = "low"
  if (totals.outstandingAnalysis.criticalityScore > 80) {
    riskLevel = "critical"
  } else if (totals.outstandingAnalysis.criticalityScore > 60) {
    riskLevel = "high"
  } else if (totals.outstandingAnalysis.criticalityScore > 30) {
    riskLevel = "medium"
  }

  // Calculate collection probability
  let collectionProbability = 100
  const paymentRate = totals.annualFeeCalculated > 0 ? (totals.totalPaid / totals.annualFeeCalculated) * 100 : 100
  const consistencyBonus = totals.paymentHistory.consistencyScore * 0.2
  const timelyPaymentBonus = Math.max(0, 20 - (totals.outstandingAnalysis.daysPastDue / 30) * 10)

  collectionProbability = Math.min(
    100,
    Math.max(0, paymentRate + consistencyBonus + timelyPaymentBonus - totals.outstandingAnalysis.criticalityScore),
  )

  return {
    expectedAnnualTotal,
    projectedCompletionDate,
    riskLevel,
    collectionProbability: Math.round(collectionProbability),
  }
}

/**
 * Generate suggested payment plan
 */
function generatePaymentPlan(outstandingAmount: number, averagePaymentAmount: number) {
  if (outstandingAmount <= 0) {
    return {
      suggestedMonthlyAmount: 0,
      numberOfMonths: 0,
      totalAmount: 0,
    }
  }

  // Suggest payment plan based on outstanding amount and payment history
  let suggestedMonthlyAmount = Math.max(100, averagePaymentAmount || 200) // Minimum $100/month

  // Adjust based on outstanding amount
  if (outstandingAmount > 2000) {
    suggestedMonthlyAmount = Math.max(suggestedMonthlyAmount, outstandingAmount / 12) // Max 12 months
  } else if (outstandingAmount > 1000) {
    suggestedMonthlyAmount = Math.max(suggestedMonthlyAmount, outstandingAmount / 8) // Max 8 months
  } else {
    suggestedMonthlyAmount = Math.max(suggestedMonthlyAmount, outstandingAmount / 6) // Max 6 months
  }

  const numberOfMonths = Math.ceil(outstandingAmount / suggestedMonthlyAmount)

  return {
    suggestedMonthlyAmount: Math.round(suggestedMonthlyAmount),
    numberOfMonths,
    totalAmount: outstandingAmount,
  }
}

/**
 * Apply flexible fee structure with discounts, penalties, and adjustments
 */
export function applyFlexibleFeeStructure(
  baseAmount: number,
  discounts: FlexibleFeeStructure["discounts"] = [],
  penalties: FlexibleFeeStructure["penalties"] = [],
  adjustments: FlexibleFeeStructure["adjustments"] = [],
): FlexibleFeeStructure {
  let finalAmount = baseAmount

  // Apply discounts
  discounts.forEach((discount) => {
    if (discount.type === "percentage") {
      finalAmount -= (baseAmount * discount.value) / 100
    } else {
      finalAmount -= discount.value
    }
  })

  // Apply penalties
  penalties.forEach((penalty) => {
    if (penalty.type === "percentage") {
      finalAmount += (baseAmount * penalty.value) / 100
    } else {
      finalAmount += penalty.value
    }
  })

  // Apply adjustments
  adjustments.forEach((adjustment) => {
    if (adjustment.type === "credit") {
      finalAmount -= adjustment.amount
    } else {
      finalAmount += adjustment.amount
    }
  })

  return {
    baseAmount,
    discounts,
    penalties,
    adjustments,
    finalAmount: Math.max(0, finalAmount),
  }
}

/**
 * Create a payment plan for a student
 */
export function createPaymentPlan(
  studentId: string,
  totalAmount: number,
  monthlyAmount: number,
  startDate: string,
  notes?: string,
): PaymentPlan {
  const start = new Date(startDate)
  const numberOfInstallments = Math.ceil(totalAmount / monthlyAmount)
  const installments = []

  for (let i = 0; i < numberOfInstallments; i++) {
    const dueDate = new Date(start)
    dueDate.setMonth(dueDate.getMonth() + i)

    const amount =
      i === numberOfInstallments - 1
        ? totalAmount - monthlyAmount * (numberOfInstallments - 1) // Last installment gets remainder
        : monthlyAmount

    installments.push({
      dueDate: dueDate.toISOString().split("T")[0],
      amount,
      paid: false,
    })
  }

  const endDate = new Date(start)
  endDate.setMonth(endDate.getMonth() + numberOfInstallments - 1)

  return {
    id: `plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    studentId,
    totalAmount,
    monthlyAmount,
    startDate,
    endDate: endDate.toISOString().split("T")[0],
    installments,
    status: "active",
    createdDate: new Date().toISOString().split("T")[0],
    notes,
  }
}

/**
 * Calculate late fees and penalties
 */
export function calculateLateFees(payment: FeePayment, settings: AppSettings, currentDate: Date = new Date()): number {
  if (payment.paid || payment.outstandingAmount <= 0.01) {
    return 0
  }

  const dueDate = new Date(payment.dueDate)
  const daysPastDue = Math.floor((currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))

  if (daysPastDue <= 0) {
    return 0
  }

  // Default late fee structure (can be made configurable)
  let lateFee = 0

  if (daysPastDue > 30) {
    lateFee += 25 // $25 after 30 days
  }

  if (daysPastDue > 60) {
    lateFee += 25 // Additional $25 after 60 days
  }

  if (daysPastDue > 90) {
    lateFee += 50 // Additional $50 after 90 days
  }

  // Interest calculation (1% per month on outstanding amount)
  const monthsPastDue = Math.floor(daysPastDue / 30)
  if (monthsPastDue > 0) {
    lateFee += payment.outstandingAmount * 0.01 * monthsPastDue
  }

  return Math.round(lateFee * 100) / 100 // Round to 2 decimal places
}

/**
 * Generate comprehensive fee analysis report
 */
export function generateFeeAnalysisReport(students: Student[], settings: AppSettings) {
  const analysis = {
    totalStudents: students.length,
    overallMetrics: {
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      averageCompletionRate: 0,
      averageConsistencyScore: 0,
    },
    riskDistribution: {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    },
    paymentPatterns: {
      regularPayers: 0,
      irregularPayers: 0,
      nonPayers: 0,
      averagePaymentFrequency: 0,
    },
    outstandingAnalysis: {
      totalCriticalCases: 0,
      averageDaysPastDue: 0,
      totalLateFees: 0,
      recommendedActions: new Map<string, number>(),
    },
    projections: {
      totalProjectedRevenue: 0,
      averageCollectionProbability: 0,
      studentsAtRisk: 0,
    },
  }

  let totalCompletionRate = 0
  let totalConsistencyScore = 0
  let totalPaymentFrequency = 0
  let totalDaysPastDue = 0
  let totalCollectionProbability = 0

  students.forEach((student) => {
    const totals = calculateAdvancedStudentTotals(student, settings.billingCycle, settings)

    // Overall metrics
    analysis.overallMetrics.totalExpected += totals.annualFeeCalculated
    analysis.overallMetrics.totalCollected += totals.totalPaid
    analysis.overallMetrics.totalOutstanding += totals.totalOwed

    totalCompletionRate += (totals.schoolFees.completionRate + totals.transport.completionRate) / 2
    totalConsistencyScore += totals.paymentHistory.consistencyScore
    totalPaymentFrequency += totals.paymentHistory.paymentFrequency
    totalDaysPastDue += totals.outstandingAnalysis.daysPastDue
    totalCollectionProbability += totals.projections.collectionProbability

    // Risk distribution
    analysis.riskDistribution[totals.projections.riskLevel]++

    // Payment patterns
    if (totals.paymentHistory.consistencyScore > 70) {
      analysis.paymentPatterns.regularPayers++
    } else if (totals.paymentHistory.totalPayments > 0) {
      analysis.paymentPatterns.irregularPayers++
    } else {
      analysis.paymentPatterns.nonPayers++
    }

    // Outstanding analysis
    if (totals.outstandingAnalysis.criticalityScore > 60) {
      analysis.outstandingAnalysis.totalCriticalCases++
    }

    // Recommended actions
    const action = totals.outstandingAnalysis.recommendedAction
    analysis.outstandingAnalysis.recommendedActions.set(
      action,
      (analysis.outstandingAnalysis.recommendedActions.get(action) || 0) + 1,
    )

    // Projections
    analysis.projections.totalProjectedRevenue += totals.projections.expectedAnnualTotal
    if (totals.projections.collectionProbability < 70) {
      analysis.projections.studentsAtRisk++
    }
  })

  // Calculate averages
  const studentCount = students.length || 1
  analysis.overallMetrics.averageCompletionRate = totalCompletionRate / studentCount
  analysis.overallMetrics.averageConsistencyScore = totalConsistencyScore / studentCount
  analysis.paymentPatterns.averagePaymentFrequency = totalPaymentFrequency / studentCount
  analysis.outstandingAnalysis.averageDaysPastDue = totalDaysPastDue / studentCount
  analysis.projections.averageCollectionProbability = totalCollectionProbability / studentCount

  return analysis
}

// Helper function to get month name
function getMonthName(month: number): string {
  const months = [
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
  return months[month - 1] || `Month ${month}`
}

export default {
  calculateAdvancedStudentTotals,
  applyFlexibleFeeStructure,
  createPaymentPlan,
  calculateLateFees,
  generateFeeAnalysisReport,
}
