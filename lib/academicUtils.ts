import type { Student, ClassGroup, FeePayment, AppSettings, BillingCycleType } from "../types/index"
import { TERMS, BillingCycle } from "../types/index"
import { getCurrentYear, getStartOfMonth, getStartOfTerm } from "./dateUtils"

/**
 * Academic year utilities for the school management system
 */

export function getCurrentAcademicYear(): string {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  // Academic year starts in January
  if (currentMonth >= 1) {
    return currentYear.toString()
  } else {
    return (currentYear - 1).toString()
  }
}

export function isWithinAcademicYear(dateString: string): boolean {
  const date = new Date(dateString)
  const currentAcademicYear = getCurrentAcademicYear()
  const academicYearStart = new Date(`${currentAcademicYear}-01-01`)
  const academicYearEnd = new Date(`${currentAcademicYear}-12-31`)

  return date >= academicYearStart && date <= academicYearEnd
}

export function getAcademicYearRange(year: string): { start: Date; end: Date } {
  return {
    start: new Date(`${year}-01-01`),
    end: new Date(`${year}-12-31`),
  }
}

export function formatAcademicYear(year: string): string {
  return `Academic Year ${year}`
}

export function getNextAcademicYear(currentYear: string): string {
  return (Number.parseInt(currentYear) + 1).toString()
}

export function getPreviousAcademicYear(currentYear: string): string {
  return (Number.parseInt(currentYear) - 1).toString()
}

// Enhanced academic utilities with comprehensive student management features

// Enhanced student totals calculation with comprehensive fee breakdown
export function calculateStudentTotals(
  student: Student,
  billingCycle: BillingCycleType,
): {
  totalPaid: number
  totalOwed: number
  annualFeeCalculated: number
  expectedToDate: number
  schoolFeesTotal: number
  transportFeesTotal: number
  currentYearPaid: number
  currentYearOwed: number
  paymentCompletionRate: number
} {
  if (!Array.isArray(student.feePayments)) {
    return {
      totalPaid: 0,
      totalOwed: 0,
      annualFeeCalculated: 0,
      expectedToDate: 0,
      schoolFeesTotal: 0,
      transportFeesTotal: 0,
      currentYearPaid: 0,
      currentYearOwed: 0,
      paymentCompletionRate: 0,
    }
  }

  const currentDate = new Date()
  let totalPaid = 0
  let totalOwed = 0
  let annualFeeCalculated = 0
  let expectedToDate = 0
  let schoolFeesTotal = 0
  let transportFeesTotal = 0
  let currentYearPaid = 0
  let currentYearOwed = 0

  const currentCalendarYear = getCurrentYear() // This gets the current *calendar* year
  const currentAcademicYearString = getCurrentAcademicYear() // This gets the current *academic* year string
  const admissionDate = new Date(student.admissionDate)

  student.feePayments.forEach((payment) => {
    totalPaid += payment.amountPaid

    let periodStartDate: Date
    let periodEndDate: Date // Added for more precise academic year check

    if (billingCycle === BillingCycle.MONTHLY) {
      periodStartDate = new Date(currentCalendarYear, payment.period - 1, 1)
      periodEndDate = new Date(currentCalendarYear, payment.period, 0) // Last day of the month
    } else {
      const term = TERMS.find((t) => t.period === payment.period)
      if (!term) return
      periodStartDate = new Date(currentCalendarYear, term.months[0] - 1, 1)
      periodEndDate = new Date(currentCalendarYear, term.months[term.months.length - 1], 0) // Last day of the last month of the term
    }

    const admissionPeriodStart = getStartOfMonth(admissionDate.getFullYear(), admissionDate.getMonth() + 1)

    // Only consider payments that are for periods *after or equal to* admission
    if (periodStartDate >= admissionPeriodStart) {
      annualFeeCalculated += payment.amountDue
      totalOwed += payment.outstandingAmount // This assumes outstandingAmount is cumulative per payment item

      let schoolFeeForPeriod = payment.amountDue
      let transportFeeForPeriod = 0

      if (student.hasTransport && !payment.isTransportWaived) {
        if (billingCycle === BillingCycle.MONTHLY) {
          transportFeeForPeriod = student.transportFee
        } else {
          const term = TERMS.find((t) => t.period === payment.period)
          if (term) {
            transportFeeForPeriod = student.transportFee * term.months.length
          }
        }
        schoolFeeForPeriod = payment.amountDue - transportFeeForPeriod
      }

      schoolFeesTotal += schoolFeeForPeriod
      transportFeesTotal += transportFeeForPeriod

      // Current academic year calculations
      // This is a more robust check now using the new isWithinAcademicYear
      const isInCurrentAcademicYear = isWithinAcademicYear(periodStartDate.toISOString().split("T")[0])
      
      // Add to expectedToDate if the period is on or before the current date
      if (periodStartDate <= currentDate) {
        expectedToDate += payment.amountDue
      }
      
      if (isInCurrentAcademicYear) {
        currentYearPaid += payment.amountPaid
        currentYearOwed += payment.outstandingAmount
      }
    }
  })

  const paymentCompletionRate = annualFeeCalculated > 0 ? (totalPaid / annualFeeCalculated) * 100 : 0

  return {
    totalPaid,
    totalOwed,
    annualFeeCalculated,
    expectedToDate: Math.max(0, expectedToDate), // Ensure non-negative
    schoolFeesTotal,
    transportFeesTotal,
    currentYearPaid,
    currentYearOwed,
    paymentCompletionRate,
  }
}

// Enhanced class group utilities
export function getClassGroupByStudent(student: Student, classGroups: ClassGroup[]): ClassGroup | undefined {
  return classGroups.find((group) => group.id === student.classGroup)
}

export function getNextClassGroup(currentClassGroup: ClassGroup, classGroups: ClassGroup[]): ClassGroup | undefined {
  // Find the next class group based on grade progression
  const currentGradeMatch = currentClassGroup.name.match(/(\d+)/)
  if (!currentGradeMatch) return undefined

  const currentGrade = Number.parseInt(currentGradeMatch[1], 10)
  const nextGrade = currentGrade + 1

  return classGroups.find((group) => group.name.includes(nextGrade.toString()))
}

export function canPromoteStudent(
  student: Student,
  settings: AppSettings,
): {
  canPromote: boolean
  reason?: string
  requirements: {
    paymentThresholdMet: boolean
    academicYearComplete: boolean
    notInFinalGrade: boolean
  }
} {
  const { paymentCompletionRate } = calculateStudentTotals(student, settings.billingCycle)
  const currentClassGroup = getClassGroupByStudent(student, settings.classGroups)
  const nextClassGroup = currentClassGroup ? getNextClassGroup(currentClassGroup, settings.classGroups) : undefined

  // You might want to enhance 'academicYearComplete' check here.
  // For now, it's just 'true', but could involve checking last payment period or a specific flag on student.
  const requirements = {
    paymentThresholdMet: paymentCompletionRate >= (settings.promotionThreshold || 75),
    academicYearComplete: true, // This currently defaults to true. You might need to implement logic here.
    // E.g., check if all periods for the *current academic year* have been billed and accounted for.
    notInFinalGrade: !!nextClassGroup,
  }

  if (!requirements.paymentThresholdMet) {
    return {
      canPromote: false,
      reason: `Payment completion rate (${paymentCompletionRate.toFixed(1)}%) below threshold (${settings.promotionThreshold || 75}%)`,
      requirements,
    }
  }

  if (!requirements.notInFinalGrade) {
    return {
      canPromote: false,
      reason: "Student is in final grade - consider graduation instead",
      requirements,
    }
  }

  return {
    canPromote: true,
    requirements,
  }
}

// Enhanced fee payment initialization
export function initializeFeePaymentsForStudent(
  student: Student,
  classGroup: ClassGroup,
  settings: AppSettings,
): FeePayment[] {
  const currentAcademicYear = getCurrentAcademicYear() // Use academic year for new payments
  const [academicYearStartYear, academicYearEndYear] = currentAcademicYear.split("-").map(Number)
  const admissionDate = new Date(student.admissionDate)
  const periodsInYear = settings.billingCycle === BillingCycle.MONTHLY ? 12 : TERMS.length

  const feePayments: FeePayment[] = []

  for (let i = 0; i < periodsInYear; i++) {
    let period: number
    let dueDate: string
    // Use custom fee if enabled, otherwise use standard class fee
    let amountDue = student.hasCustomFees && student.customSchoolFee 
      ? student.customSchoolFee 
      : classGroup.standardFee
    let isPeriodRelevant = false

    // Determine the calendar year for the period being initialized
    // If billing monthly, use the academic year start year for months Aug-Dec, and end year for Jan-Jul
    let periodCalendarYear = academicYearStartYear

    if (settings.billingCycle === BillingCycle.MONTHLY) {
      period = i + 1 // 1-12 for months
      // Months 1-7 (Jan-Jul) belong to the endYear of the academic year
      if (period >= 1 && period <= 7) {
        periodCalendarYear = academicYearEndYear
      }
      // Months 8-12 (Aug-Dec) belong to the startYear of the academic year
      // periodCalendarYear is already academicYearStartYear for these months

      dueDate = new Date(periodCalendarYear, period - 1, settings.paymentDueDate || 1).toISOString().split("T")[0]

      const periodStart = getStartOfMonth(periodCalendarYear, period)
      const admissionPeriodStart = getStartOfMonth(admissionDate.getFullYear(), admissionDate.getMonth() + 1) // +1 because getMonth is 0-indexed

      isPeriodRelevant = periodStart.getTime() >= admissionPeriodStart.getTime()

      if (student.hasTransport && isPeriodRelevant) {
        amountDue += student.transportFee
      }
    } else {
      // Termly billing
      const term = TERMS[i]
      period = term.period
      const firstMonthOfTerm = term.months[0] - 1 // 0-indexed month

      // Determine the calendar year for the term
      if (firstMonthOfTerm >= 0 && firstMonthOfTerm <= 6) {
        // Jan-Jul terms
        periodCalendarYear = academicYearEndYear
      }
      // Aug-Dec terms use academicYearStartYear, which is default

      dueDate = new Date(periodCalendarYear, firstMonthOfTerm, settings.paymentDueDate || 1).toISOString().split("T")[0]

      const periodStart = getStartOfTerm(periodCalendarYear, period)
      const admissionPeriodStart = getStartOfMonth(admissionDate.getFullYear(), admissionDate.getMonth() + 1)

      isPeriodRelevant = periodStart.getTime() >= admissionPeriodStart.getTime()

      if (isPeriodRelevant) {
        amountDue = classGroup.standardFee * term.months.length
        if (student.hasTransport) {
          amountDue += student.transportFee * term.months.length
        }
      }
    }

    // Only create fee payment entries for periods that are relevant (after admission and within the current academic year's scope)
    // The `isPeriodRelevant` already handles `after admission`.
    // The `periodCalendarYear` logic above already aligns it with the academic year.
    feePayments.push({
      period: period,
      amountDue: isPeriodRelevant ? amountDue : 0,
      amountPaid: 0,
      paid: false,
      dueDate: dueDate,
      isTransportWaived: false,
      outstandingAmount: isPeriodRelevant ? amountDue : 0,
    })
  }

  return feePayments
}

// Enhanced student fee updates
export function updateStudentFeesFromClassGroup(
  student: Student,
  classGroup: ClassGroup,
  settings: AppSettings,
): Student {
  const updatedStudent = { ...student }

  if (!Array.isArray(updatedStudent.feePayments)) {
    updatedStudent.feePayments = initializeFeePaymentsForStudent(updatedStudent, classGroup, settings)
  } else {
    // Update existing fee payments
    // This logic should ideally consider the *academic year* of the payment being updated,
    // not just the current calendar year.
    // For simplicity, for now, it updates based on current settings for *all* payments.
    // A more robust solution might involve filtering payments by academic year
    // or marking old payments as historical.

    updatedStudent.feePayments = updatedStudent.feePayments.map((payment) => {
      let amountDue = classGroup.standardFee

      if (settings.billingCycle === BillingCycle.TERMLY) {
        const term = TERMS.find((t) => t.period === payment.period)
        if (term) {
          amountDue = classGroup.standardFee * term.months.length
        }
      }

      if (updatedStudent.hasTransport && !payment.isTransportWaived) {
        const transportAmount =
          settings.billingCycle === BillingCycle.MONTHLY
            ? updatedStudent.transportFee
            : updatedStudent.transportFee * (TERMS.find((t) => t.period === payment.period)?.months.length || 1)
        amountDue += transportAmount
      }

      const outstanding = Math.max(0, amountDue - payment.amountPaid)
      return {
        ...payment,
        amountDue: amountDue,
        outstandingAmount: outstanding,
        paid: outstanding <= 0.01,
      }
    })
  }

  // Recalculate totals
  const totals = calculateStudentTotals(updatedStudent, settings.billingCycle)
  updatedStudent.totalPaid = totals.totalPaid
  updatedStudent.totalOwed = totals.totalOwed

  return updatedStudent
}

// Student promotion utilities
export function promoteStudent(
  student: Student,
  targetClassGroup: ClassGroup,
  settings: AppSettings,
): {
  success: boolean
  promotedStudent?: Student
  error?: string
} {
  try {
    const promotionCheck = canPromoteStudent(student, settings)

    if (!promotionCheck.canPromote) {
      return {
        success: false,
        error: promotionCheck.reason,
      }
    }

    const promotedStudent: Student = {
      ...student,
      classGroup: targetClassGroup.id,
      academicYear: getCurrentAcademicYear(), // Set to the new academic year
      // Reset fee payments for new academic year
      feePayments: initializeFeePaymentsForStudent(student, targetClassGroup, settings),
      totalPaid: 0, // Reset totals for the new academic year
      totalOwed: 0, // Reset totals for the new academic year
    }

    // Recalculate totals based on the newly initialized fee payments
    const totals = calculateStudentTotals(promotedStudent, settings.billingCycle)
    promotedStudent.totalPaid = totals.totalPaid
    promotedStudent.totalOwed = totals.totalOwed

    return {
      success: true,
      promotedStudent,
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during promotion",
    }
  }
}

// Bulk promotion utilities
export function promoteMultipleStudents(
  students: Student[],
  settings: AppSettings,
): {
  successful: Student[]
  failed: { student: Student; reason: string }[]
  summary: {
    totalProcessed: number
    successCount: number
    failureCount: number
  }
} {
  const successful: Student[] = []
  const failed: { student: Student; reason: string }[] = []

  students.forEach((student) => {
    const currentClassGroup = getClassGroupByStudent(student, settings.classGroups)
    if (!currentClassGroup) {
      failed.push({ student, reason: "Current class group not found" })
      return
    }

    const nextClassGroup = getNextClassGroup(currentClassGroup, settings.classGroups)
    if (!nextClassGroup) {
      failed.push({ student, reason: "No next class group available (may be in final grade)" })
      return
    }

    const promotionResult = promoteStudent(student, nextClassGroup, settings)
    if (promotionResult.success && promotionResult.promotedStudent) {
      successful.push(promotionResult.promotedStudent)
    } else {
      failed.push({ student, reason: promotionResult.error || "Unknown promotion error" })
    }
  })

  return {
    successful,
    failed,
    summary: {
      totalProcessed: students.length,
      successCount: successful.length,
      failureCount: failed.length,
    },
  }
}

// Academic year transition utilities
export function transitionToNewAcademicYear(
  students: Student[],
  settings: AppSettings,
): {
  transitionedStudents: Student[]
  promotedStudents: Student[]
  graduatedStudents: Student[]
  errors: { student: Student; error: string }[]
} {
  const transitionedStudents: Student[] = []
  const promotedStudents: Student[] = []
  const graduatedStudents: Student[] = []
  const errors: { student: Student; error: string }[] = []

  const newAcademicYear = getCurrentAcademicYear()

  students.forEach((student) => {
    try {
      const currentClassGroup = getClassGroupByStudent(student, settings.classGroups)
      if (!currentClassGroup) {
        errors.push({ student, error: "Class group not found" })
        return
      }

      // Check if student should be promoted
      if (settings.autoPromotionEnabled) {
        const promotionCheck = canPromoteStudent(student, settings)
        if (promotionCheck.canPromote) {
          const nextClassGroup = getNextClassGroup(currentClassGroup, settings.classGroups)
          if (nextClassGroup) {
            const promotionResult = promoteStudent(student, nextClassGroup, settings)
            if (promotionResult.success && promotionResult.promotedStudent) {
              promotedStudents.push(promotionResult.promotedStudent)
              return // Student was promoted, so no need for regular transition
            }
          } else {
            // Student is in final grade and can be promoted (i.e., graduate)
            const graduatedStudent: Student = {
              ...student,
              isTransferred: true, // Mark as transferred/graduated
              academicYear: newAcademicYear,
              notes: (student.notes || "") + ` [GRADUATED - ${new Date().toLocaleDateString()}]`,
              // Optionally clear feePayments for graduated students or archive them
              feePayments: [],
              totalPaid: 0,
              totalOwed: 0,
            }
            graduatedStudents.push(graduatedStudent)
            return // Student graduated, no regular transition
          }
        }
      }

      // Regular transition (same class, new academic year) - if not promoted/graduated
      const transitionedStudent: Student = {
        ...student,
        academicYear: newAcademicYear,
        // Re-initialize fee payments for the *new* academic year
        feePayments: initializeFeePaymentsForStudent(student, currentClassGroup, settings),
        totalPaid: 0, // Reset totals for the new academic year
        totalOwed: 0, // Reset totals for the new academic year
      }

      // Recalculate totals based on the newly initialized fee payments
      const totals = calculateStudentTotals(transitionedStudent, settings.billingCycle)
      transitionedStudent.totalPaid = totals.totalPaid
      transitionedStudent.totalOwed = totals.totalOwed

      transitionedStudents.push(transitionedStudent)
    } catch (error) {
      errors.push({
        student,
        error: error instanceof Error ? error.message : "Unknown transition error",
      })
    }
  })

  return {
    transitionedStudents,
    promotedStudents,
    graduatedStudents,
    errors,
  }
}

// Payment analysis utilities
export function analyzeClassPaymentPerformance(
  students: Student[],
  classGroupId: string,
  settings: AppSettings,
): {
  classGroup: ClassGroup | undefined
  totalStudents: number
  totalExpected: number
  totalCollected: number
  totalOutstanding: number
  collectionRate: number
  averageCompletionRate: number
  paymentDistribution: {
    fullyPaid: number
    nearlyComplete: number
    partial: number
    minimal: number
  }
} {
  const classGroup = settings.classGroups.find((g) => g.id === classGroupId)
  const classStudents = students.filter((s) => s.classGroup === classGroupId)

  let totalExpected = 0
  let totalCollected = 0
  let totalOutstanding = 0
  let totalCompletionRate = 0

  const paymentDistribution = {
    fullyPaid: 0,
    nearlyComplete: 0,
    partial: 0,
    minimal: 0,
  }

  classStudents.forEach((student) => {
    // Ensure that calculateStudentTotals is used for the *current academic year* for this analysis
    // The current calculateStudentTotals sums up all payments after admission.
    // If you want to only analyze payments for the *current academic year*,
    // you'd need to modify calculateStudentTotals or filter payments before passing them.
    const totals = calculateStudentTotals(student, settings.billingCycle)
    totalExpected += totals.annualFeeCalculated
    totalCollected += totals.totalPaid
    totalOutstanding += totals.totalOwed
    totalCompletionRate += totals.paymentCompletionRate

    // Categorize payment completion
    if (totals.paymentCompletionRate >= 100) {
      paymentDistribution.fullyPaid++
    } else if (totals.paymentCompletionRate >= 75) {
      paymentDistribution.nearlyComplete++
    } else if (totals.paymentCompletionRate >= 25) {
      paymentDistribution.partial++
    } else {
      paymentDistribution.minimal++
    }
  })

  return {
    classGroup,
    totalStudents: classStudents.length,
    totalExpected,
    totalCollected,
    totalOutstanding,
    collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    averageCompletionRate: classStudents.length > 0 ? totalCompletionRate / classStudents.length : 0,
    paymentDistribution,
  }
}

// Transport management utilities
export function updateStudentTransportStatus(
  student: Student,
  hasTransport: boolean,
  transportFee: number,
  settings: AppSettings,
): Student {
  const updatedStudent = { ...student, hasTransport, transportFee }

  // Update fee payments to reflect transport changes
  if (Array.isArray(updatedStudent.feePayments)) {
    // This mapping updates all existing payments.
    // If you only want to update payments *from the current academic year forward*,
    // you'd need more complex logic to filter and re-initialize future payments.
    updatedStudent.feePayments = updatedStudent.feePayments.map((payment) => {
      let baseAmount = payment.amountDue
      let currentTransportAmount = 0

      // Calculate current transport amount in this payment
      // This logic should be careful not to apply previous transport fees to payments
      // where transport was already waived or not applicable historically.
      if (student.hasTransport && !payment.isTransportWaived) {
        if (settings.billingCycle === BillingCycle.MONTHLY) {
          currentTransportAmount = student.transportFee
        } else {
          const term = TERMS.find((t) => t.period === payment.period)
          if (term) {
            currentTransportAmount = student.transportFee * term.months.length
          }
        }
        baseAmount -= currentTransportAmount
      }

      // Calculate new transport amount
      let newTransportAmount = 0
      if (hasTransport && !payment.isTransportWaived) {
        // Use the new `hasTransport` and existing `isTransportWaived`
        if (settings.billingCycle === BillingCycle.MONTHLY) {
          newTransportAmount = transportFee // Use the new `transportFee`
        } else {
          const term = TERMS.find((t) => t.period === payment.period)
          if (term) {
            newTransportAmount = transportFee * term.months.length
          }
        }
      }

      const newAmountDue = baseAmount + newTransportAmount
      const outstanding = Math.max(0, newAmountDue - payment.amountPaid)

      return {
        ...payment,
        amountDue: newAmountDue,
        outstandingAmount: outstanding,
        paid: outstanding <= 0.01,
      }
    })
  }

  // Recalculate totals
  const totals = calculateStudentTotals(updatedStudent, settings.billingCycle)
  updatedStudent.totalPaid = totals.totalPaid
  updatedStudent.totalOwed = totals.totalOwed

  return updatedStudent
}

// Academic performance tracking
export function getStudentAcademicSummary(
  student: Student,
  settings: AppSettings,
): {
  enrollmentDuration: string
  currentAcademicYear: string
  paymentHistory: {
    totalPeriods: number
    paidPeriods: number
    unpaidPeriods: number
    completionRate: number
  }
  financialSummary: {
    totalExpected: number
    totalPaid: number
    totalOutstanding: number
    averagePaymentAmount: number
  }
  recommendations: string[]
} {
  const enrollmentDate = new Date(student.admissionDate)
  const now = new Date()
  const enrollmentDurationMonths =
    (now.getFullYear() - enrollmentDate.getFullYear()) * 12 + (now.getMonth() - enrollmentDate.getMonth())

  const totals = calculateStudentTotals(student, settings.billingCycle)
  const paidPayments = student.feePayments?.filter((p) => p.paid) || []
  const unpaidPayments = student.feePayments?.filter((p) => !p.paid && p.outstandingAmount > 0.01) || []

  const recommendations: string[] = []

  if (totals.paymentCompletionRate < 50) {
    recommendations.push("Schedule immediate payment plan discussion")
  } else if (totals.paymentCompletionRate < 75) {
    recommendations.push("Consider flexible payment options")
  }

  if (unpaidPayments.length > 3) {
    recommendations.push("Implement automated payment reminders")
  }

  // This condition seems a bit arbitrary for a recommendation related to transport fee structure.
  // It might be more useful to recommend if transport fees are a large *percentage* of the total,
  // or if there are specific cases where it seems disproportionate.
  if (
    student.hasTransport &&
    totals.transportFeesTotal > 0 &&
    totals.schoolFeesTotal > 0 &&
    totals.transportFeesTotal / (totals.schoolFeesTotal + totals.transportFeesTotal) > 0.3
  ) {
    // If transport is more than 30% of total fees
    recommendations.push("Review transport fee structure for proportionality")
  }

  return {
    enrollmentDuration: `${Math.floor(enrollmentDurationMonths / 12)} years, ${enrollmentDurationMonths % 12} months`,
    currentAcademicYear: student.academicYear || getCurrentAcademicYear(),
    paymentHistory: {
      totalPeriods: student.feePayments?.length || 0,
      paidPeriods: paidPayments.length,
      unpaidPeriods: unpaidPayments.length,
      completionRate: totals.paymentCompletionRate,
    },
    financialSummary: {
      totalExpected: totals.annualFeeCalculated,
      totalPaid: totals.totalPaid,
      totalOutstanding: totals.totalOwed,
      averagePaymentAmount: paidPayments.length > 0 ? totals.totalPaid / paidPayments.length : 0,
    },
    recommendations,
  }
}
