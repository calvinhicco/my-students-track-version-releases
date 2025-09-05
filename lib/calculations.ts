import type { Student, BillingCycleType, OutstandingBreakdown } from "../types/index"
import { BillingCycle, TERMS } from "../types/index"
import { getCurrentMonth, getCurrentYear, getStartOfMonth, getStartOfTerm } from "./dateUtils"
import { calculateTransportOutstanding } from "./transportUtils"

/**
 * Enhanced calculations for the school management system
 * Handles monthly and termly billing cycles with transport fees
 */

/**
 * Calculates the total collections for the current period (month or term)
 */
export function calculateMonthlyCollections(students: Student[], billingCycle: BillingCycleType): number {
  const currentMonth = getCurrentMonth()
  const currentYear = getCurrentYear()

  return students.reduce((total, student) => {
    if (!Array.isArray(student.feePayments)) {
      return total
    }

    let amountCollectedForPeriod = 0

    if (billingCycle === BillingCycle.MONTHLY) {
      const payment = student.feePayments.find((p) => p.period === currentMonth)
      if (payment) {
        amountCollectedForPeriod = payment.amountPaid
      }
    } else {
      // Termly billing
      const currentTerm = TERMS.find((term) => term.months.includes(currentMonth))
      if (currentTerm) {
        const payment = student.feePayments.find((p) => p.period === currentTerm.period)
        if (payment) {
          amountCollectedForPeriod = payment.amountPaid
        }
      }
    }

    return total + amountCollectedForPeriod
  }, 0)
}

/**
 * Calculates collections for a specific period
 */
export function calculatePeriodCollections(
  students: Student[],
  period: number,
  billingCycle: BillingCycleType,
): number {
  return students.reduce((total, student) => {
    if (!Array.isArray(student.feePayments)) {
      return total
    }

    const payment = student.feePayments.find((p) => p.period === period)
    return total + (payment ? payment.amountPaid : 0)
  }, 0)
}

/**
 * Calculates the total outstanding amount across all students from their admission date
 */
export function calculateTotalOutstandingFromEnrollment(students: Student[], billingCycle: BillingCycleType): number {
  return students.reduce((total, student) => {
    const schoolFeesOutstanding = calculateSchoolFeesOutstanding(student, billingCycle)
    const transportOutstanding = calculateTransportOutstanding(student)
    return total + schoolFeesOutstanding + transportOutstanding
  }, 0)
}

/**
 * Enhanced outstanding calculation including transport fees
 */
// --------------------------------------------------
// Expected amount (tuition + transport) up to today
// --------------------------------------------------
export function calculateExpectedToDate(student: Student, billingCycle: BillingCycleType): number {
  const currentDate = new Date()
  const currentYear = currentDate.getFullYear()

  // ----- Tuition expected -----
  let tuitionDueToDate = 0
  if (Array.isArray(student.feePayments)) {
    student.feePayments.forEach((payment) => {
      // Skip if this payment period is marked as skipped
      if (payment.isSkipped) return

      // Determine period start date within CURRENT year
      let periodStart: Date | null = null
      if (billingCycle === BillingCycle.MONTHLY) {
        periodStart = new Date(currentYear, payment.period - 1, 1)
      } else {
        const term = TERMS.find((t) => t.period === payment.period)
        if (term) periodStart = new Date(currentYear, term.months[0] - 1, 1)
      }
      if (!periodStart || periodStart > currentDate) return // future period not due yet

      // Enrollment rule: if student admitted THIS year, start from admission date else from Jan 1
      const enrollmentCutoff = new Date(student.admissionDate)
      const cutoffDate = enrollmentCutoff.getFullYear() === currentYear ? enrollmentCutoff : new Date(currentYear, 0, 1)
      if (periodStart < cutoffDate) return // before expected window

      // Tuition component only (exclude transport fee)
      const transportPart = student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0
      const tuitionComponent = Math.max(0, payment.amountDue - transportPart)
      tuitionDueToDate += tuitionComponent
    })
  }

  // ----- Transport expected -----
  const transportDueToDate = student.hasTransport
    ? calculateTransportOutstanding({
        ...student,
        transportPayments: student.transportPayments?.map((p) => ({ ...p, outstandingAmount: p.amountDue })) || [],
      })
    : 0

  return tuitionDueToDate + transportDueToDate
}

export function calculateOutstandingFromEnrollment(student: Student, billingCycle: BillingCycleType): number {
  const schoolFeesOutstanding = calculateSchoolFeesOutstanding(student, billingCycle)
  const transportOutstanding = calculateTransportOutstanding(student)

  return schoolFeesOutstanding + transportOutstanding
}

/**
 * Calculate school fees outstanding only
 */
export function calculateSchoolFeesOutstanding(student: Student, billingCycle: BillingCycleType): number {
  if (!Array.isArray(student.feePayments)) {
    return 0
  }

  const admissionDate = new Date(student.admissionDate)
  const currentDate = new Date()
  const currentYear = getCurrentYear()

  let outstanding = 0

  student.feePayments.forEach((payment) => {
    // Determine the start date of the current payment period
    let periodStartDate: Date

    if (billingCycle === BillingCycle.MONTHLY) {
      periodStartDate = getStartOfMonth(currentYear, payment.period)
    } else {
      // Termly
      const term = TERMS.find((t) => t.period === payment.period)
      if (!term) return
      periodStartDate = getStartOfTerm(currentYear, payment.period)
    }

    // Only consider periods that are current or in the past relative to the current date
    // And that are after or in the same period as the admission date
    const admissionPeriodStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)

    if (periodStartDate <= currentDate && periodStartDate >= admissionPeriodStart) {
      // For students with deactivated transport (hasTransport: false) or transport waived,
      // use the payment's outstanding amount directly since it should already exclude transport
      if (!student.hasTransport || payment.isTransportWaived) {
        outstanding += payment.outstandingAmount
      } else {
        // For students with active transport, exclude transport component from school fees
        // since transport outstanding is calculated separately
        const transportPart = student.transportFee || 0
        const tuitionOutstanding = Math.max(0, payment.outstandingAmount - transportPart)
        outstanding += tuitionOutstanding
      }
    }
  })

  return outstanding
}

/**
 * Gets a detailed breakdown of outstanding payments for a student
 */
export function getOutstandingBreakdown(student: Student, billingCycle: BillingCycleType): OutstandingBreakdown {
  if (!Array.isArray(student.feePayments)) {
    return {
      totalPeriodsSinceAdmission: 0,
      unpaidPeriods: [],
      transportOutstanding: 0,
      schoolFeesOutstanding: 0,
      totalOutstanding: 0,
      transportSkippedMonths: [],
    }
  }

  const admissionDate = new Date(student.admissionDate)
  const currentDate = new Date()
  const currentYear = getCurrentYear()

  const unpaidPeriods: Array<{ period: number; outstandingAmount: number; periodName: string }> = []
  let totalPeriodsSinceAdmission = 0

  // Function to get period name
  const getPeriodName = (period: number, cycle: BillingCycleType) => {
    if (cycle === BillingCycle.MONTHLY) {
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
      return monthNames[period - 1] || `Month ${period}`
    } else {
      const term = TERMS.find((t) => t.period === period)
      return term ? term.name : `Term ${period}`
    }
  }

  student.feePayments.forEach((payment) => {
    let periodStartDate: Date

    if (billingCycle === BillingCycle.MONTHLY) {
      periodStartDate = getStartOfMonth(currentYear, payment.period)
    } else {
      const term = TERMS.find((t) => t.period === payment.period)
      if (!term) return
      periodStartDate = getStartOfTerm(currentYear, payment.period)
    }

    const admissionPeriodStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)

    if (periodStartDate <= currentDate && periodStartDate >= admissionPeriodStart) {
      totalPeriodsSinceAdmission++

      if (payment.outstandingAmount > 0.01) {
        unpaidPeriods.push({
          period: payment.period,
          outstandingAmount: payment.outstandingAmount,
          periodName: getPeriodName(payment.period, billingCycle),
        })
      }
    }
  })

  const schoolFeesOutstanding = calculateSchoolFeesOutstanding(student, billingCycle)
  const transportOutstanding = calculateTransportOutstanding(student)
  const totalOutstanding = schoolFeesOutstanding + transportOutstanding

  // Get skipped transport months
  const transportSkippedMonths = Array.isArray(student.transportPayments)
    ? student.transportPayments.filter((p) => p.isSkipped).map((p) => p.month)
    : []

  return {
    totalPeriodsSinceAdmission,
    unpaidPeriods,
    transportOutstanding,
    schoolFeesOutstanding,
    totalOutstanding,
    transportSkippedMonths,
  }
}

/**
 * Calculates comprehensive student totals including transport fees
 */
export function calculateStudentTotals(
  student: Student,
  billingCycle: BillingCycleType,
): {
  totalPaid: number
  totalOwed: number
  annualFeeCalculated: number
  expectedToDate: number
  transportFeesTotal: number
  schoolFeesTotal: number
  transportPaid: number
  transportOutstanding: number
  schoolFeesOutstanding: number
} {
  if (!Array.isArray(student.feePayments)) {
    return {
      totalPaid: 0,
      totalOwed: 0,
      annualFeeCalculated: 0,
      expectedToDate: 0,
      transportFeesTotal: 0,
      schoolFeesTotal: 0,
      transportPaid: 0,
      transportOutstanding: 0,
      schoolFeesOutstanding: 0,
    }
  }

  let schoolFeesPaid = 0
  let schoolFeesOwed = 0
  let annualFeeCalculated = 0
  let schoolFeesTotal = 0

  const currentYear = getCurrentYear()
  const admissionDate = new Date(student.admissionDate)

  // Calculate school fees
  student.feePayments.forEach((payment) => {
    // Skip if this payment period is marked as skipped
    if (payment.isSkipped) return

    schoolFeesPaid += payment.amountPaid

    let periodStartDate: Date

    if (billingCycle === BillingCycle.MONTHLY) {
      periodStartDate = getStartOfMonth(currentYear, payment.period)
    } else {
      const term = TERMS.find((t) => t.period === payment.period)
      if (!term) return
      periodStartDate = getStartOfTerm(currentYear, payment.period)
    }

    const admissionPeriodStart = getStartOfMonth(admissionDate.getFullYear(), admissionDate.getMonth() + 1)

    if (periodStartDate >= admissionPeriodStart) {
      annualFeeCalculated += payment.amountDue
      schoolFeesOwed += payment.outstandingAmount
      schoolFeesTotal += payment.amountDue
    }
  })

  // Calculate transport fees
  let transportPaid = 0
  let transportFeesTotal = 0
  let transportOutstanding = 0

  if (student.hasTransport && Array.isArray(student.transportPayments)) {
    const currentDate = new Date()
    const currentMonth = currentDate.getMonth() + 1
    const activationDate = student.transportActivationDate ? new Date(student.transportActivationDate) : new Date()

    student.transportPayments.forEach((payment) => {
      const paymentMonth = payment.month
      const isCurrentOrPast = paymentMonth <= currentMonth
      const isAfterActivation = paymentMonth >= activationDate.getMonth() + 1

      if (isCurrentOrPast && isAfterActivation && !payment.isSkipped) {
        transportPaid += payment.amountPaid
        transportFeesTotal += payment.amountDue
        transportOutstanding += payment.outstandingAmount
        annualFeeCalculated += payment.amountDue
      }
    })
  }

  const totalPaid = schoolFeesPaid + transportPaid
  const totalOwed = schoolFeesOwed + transportOutstanding

  // Calculate expectedToDate by summing only fees due on or before the current date
  const currentDate = new Date()
  let expectedToDate = 0
  
  // Calculate school fees expected to date
  student.feePayments.forEach((payment) => {
    // Skip if this payment period is marked as skipped
    if (payment.isSkipped) return

    let periodStartDate: Date
    
    if (billingCycle === BillingCycle.MONTHLY) {
      periodStartDate = getStartOfMonth(currentYear, payment.period)
    } else {
      const term = TERMS.find((t) => t.period === payment.period)
      if (!term) return
      periodStartDate = getStartOfTerm(currentYear, payment.period)
    }
    
    if (periodStartDate <= currentDate) {
      expectedToDate += payment.amountDue
    }
  })
  
  // Add transport fees expected to date
  if (student.hasTransport && Array.isArray(student.transportPayments)) {
    const currentMonth = currentDate.getMonth() + 1
    
    student.transportPayments.forEach((payment) => {
      if (payment.month <= currentMonth && !payment.isSkipped) {
        expectedToDate += payment.amountDue
      }
    })
  }

  return {
    totalPaid: Math.max(0, totalPaid),
    totalOwed: Math.max(0, totalOwed),
    annualFeeCalculated: Math.max(0, annualFeeCalculated),
    expectedToDate: Math.max(0, expectedToDate),
    transportFeesTotal: Math.max(0, transportFeesTotal),
    schoolFeesTotal: Math.max(0, schoolFeesTotal),
    transportPaid: Math.max(0, transportPaid),
    transportOutstanding: Math.max(0, transportOutstanding),
    schoolFeesOutstanding: Math.max(0, schoolFeesOwed),
  }
}

/**
 * Calculates class group statistics
 */
export function calculateClassGroupStats(
  students: Student[],
  classGroupId: string,
  billingCycle: BillingCycleType,
): {
  studentCount: number
  totalExpected: number
  totalCollected: number
  outstandingAmount: number
  averagePaymentRate: number
} {
  const classStudents = students.filter((s) => s.classGroup === classGroupId)

  let totalExpected = 0
  let totalCollected = 0
  let outstandingAmount = 0

  classStudents.forEach((student) => {
    const totals = calculateStudentTotals(student, billingCycle)
    totalExpected += totals.annualFeeCalculated
    totalCollected += totals.totalPaid
    outstandingAmount += totals.totalOwed
  })

  const averagePaymentRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0

  return {
    studentCount: classStudents.length,
    totalExpected: Math.max(0, totalExpected),
    totalCollected: Math.max(0, totalCollected),
    outstandingAmount: Math.max(0, outstandingAmount),
    averagePaymentRate: Math.min(100, Math.max(0, averagePaymentRate)),
  }
}

/**
 * Calculates transport service statistics
 */
export function calculateTransportStats(
  students: Student[],
  billingCycle: BillingCycleType,
): {
  totalStudentsWithTransport: number
  totalTransportRevenue: number
  averageTransportFee: number
  transportUtilizationRate: number
} {
  const studentsWithTransport = students.filter((s) => s.hasTransport)

  let totalTransportRevenue = 0
  let totalTransportFees = 0

  studentsWithTransport.forEach((student) => {
    const totals = calculateStudentTotals(student, billingCycle)
    totalTransportRevenue += totals.transportFeesTotal
    totalTransportFees += student.transportFee || 0
  })

  const averageTransportFee = studentsWithTransport.length > 0 ? totalTransportFees / studentsWithTransport.length : 0

  const transportUtilizationRate = students.length > 0 ? (studentsWithTransport.length / students.length) * 100 : 0

  return {
    totalStudentsWithTransport: studentsWithTransport.length,
    totalTransportRevenue: Math.max(0, totalTransportRevenue),
    averageTransportFee: Math.max(0, averageTransportFee),
    transportUtilizationRate: Math.min(100, Math.max(0, transportUtilizationRate)),
  }
}

/**
 * Calculates payment trends over time
 */
export function calculatePaymentTrends(
  students: Student[],
  billingCycle: BillingCycleType,
): {
  periodlyCollections: Array<{ period: number; amount: number; periodName: string }>
  totalAnnualTarget: number
  collectionRate: number
} {
  const periodlyCollections: Array<{ period: number; amount: number; periodName: string }> = []
  let totalAnnualTarget = 0

  const periods = billingCycle === BillingCycle.MONTHLY ? Array.from({ length: 12 }, (_, i) => i + 1) : [1, 2, 3]

  periods.forEach((period) => {
    const collections = calculatePeriodCollections(students, period, billingCycle)
    const periodName =
      billingCycle === BillingCycle.MONTHLY
        ? new Date(0, period - 1).toLocaleString("default", { month: "long" })
        : `Term ${period}`

    periodlyCollections.push({
      period,
      amount: collections,
      periodName,
    })
  })

  // Calculate total annual target
  students.forEach((student) => {
    const totals = calculateStudentTotals(student, billingCycle)
    totalAnnualTarget += totals.annualFeeCalculated
  })

  const totalCollected = periodlyCollections.reduce((sum, p) => sum + p.amount, 0)
  const collectionRate = totalAnnualTarget > 0 ? (totalCollected / totalAnnualTarget) * 100 : 0

  return {
    periodlyCollections,
    totalAnnualTarget: Math.max(0, totalAnnualTarget),
    collectionRate: Math.min(100, Math.max(0, collectionRate)),
  }
}

/**
 * Validates payment calculations for data integrity
 */
export function validatePaymentCalculations(student: Student): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (!Array.isArray(student.feePayments)) {
    errors.push("Fee payments array is missing or invalid")
    return { isValid: false, errors, warnings }
  }

  student.feePayments.forEach((payment, index) => {
    if (payment.amountPaid < 0) {
      errors.push(`Payment ${index + 1}: Amount paid cannot be negative`)
    }

    if (payment.amountDue < 0) {
      errors.push(`Payment ${index + 1}: Amount due cannot be negative`)
    }

    if (payment.amountPaid > payment.amountDue) {
      warnings.push(`Payment ${index + 1}: Amount paid exceeds amount due`)
    }

    const calculatedOutstanding = payment.amountDue - payment.amountPaid
    if (Math.abs(payment.outstandingAmount - calculatedOutstanding) > 0.01) {
      errors.push(`Payment ${index + 1}: Outstanding amount calculation mismatch`)
    }

    if (payment.paid && payment.outstandingAmount > 0.01) {
      warnings.push(`Payment ${index + 1}: Marked as paid but has outstanding amount`)
    }
  })

  // Validate transport payments if present
  if (student.hasTransport && Array.isArray(student.transportPayments)) {
    student.transportPayments.forEach((payment, index) => {
      if (payment.amountPaid < 0) {
        errors.push(`Transport Payment ${index + 1}: Amount paid cannot be negative`)
      }

      if (payment.amountDue < 0) {
        errors.push(`Transport Payment ${index + 1}: Amount due cannot be negative`)
      }

      const calculatedOutstanding = payment.amountDue - payment.amountPaid
      if (Math.abs(payment.outstandingAmount - calculatedOutstanding) > 0.01) {
        errors.push(`Transport Payment ${index + 1}: Outstanding amount calculation mismatch`)
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
