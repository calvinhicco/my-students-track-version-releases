import type { Student, TransferredStudent, AppSettings, ClassGroup, FeePayment } from "../types/index"
import { BillingCycle, TERMS } from "../types/index"
import { getCurrentAcademicYear, calculateStudentTotals } from "./academicUtils"
import { calculateOutstandingFromEnrollment } from "./calculations"
import { getCurrentYear } from "./dateUtils"

export interface PromotionRunnerResult {
  success: boolean
  promoted: Student[]
  transferred: TransferredStudent[]
  errors: string[]
  warnings: string[]
  summary: {
    totalProcessed: number
    totalPromoted: number
    totalTransferred: number
    totalErrors: number
    promotionsByClass: Record<string, number>
    transfersByReason: Record<string, number>
  }
}

export interface PromotionPreview {
  student: Student
  currentClass: string
  newClass: string
  promotionType: "grade_promotion" | "class_transfer" | "graduation" | "retention"
  requiresApproval: boolean
  outstandingAmount: number
  warnings: string[]
}

export interface BulkPromotionOptions {
  includeStudentsWithOutstanding: boolean
  maxOutstandingAmount: number
  requirePaymentCompletion: boolean
  customPromotionRules: Record<string, string>
  dryRun: boolean
  notifyParents: boolean
  generateReports: boolean
}

/**
 * Advanced Promotion Runner for My School Track
 * Handles automatic and manual student promotions with comprehensive validation
 */
export class PromotionRunner {
  private settings: AppSettings
  private currentAcademicYear: string
  private promotionDate: Date

  constructor(settings: AppSettings) {
    this.settings = settings
    this.currentAcademicYear = getCurrentAcademicYear()
    this.promotionDate = new Date()
  }

  /**
   * Run automatic promotions based on school settings and rules
   */
  async runAutomaticPromotions(
    students: Student[],
    options: Partial<BulkPromotionOptions> = {},
  ): Promise<PromotionRunnerResult> {
    const result: PromotionRunnerResult = {
      success: false,
      promoted: [],
      transferred: [],
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: 0,
        totalPromoted: 0,
        totalTransferred: 0,
        totalErrors: 0,
        promotionsByClass: {},
        transfersByReason: {},
      },
    }

    try {
      // Validate promotion eligibility
      if (!this.settings.autoPromotionEnabled) {
        result.errors.push("Automatic promotions are disabled in school settings")
        return result
      }

      // Check if it's the right time for promotions (typically end of academic year)
      if (!this.isPromotionPeriod()) {
        result.warnings.push("Running promotions outside of typical promotion period")
      }

      const defaultOptions: BulkPromotionOptions = {
        includeStudentsWithOutstanding: false,
        maxOutstandingAmount: 0,
        requirePaymentCompletion: true,
        customPromotionRules: {},
        dryRun: false,
        notifyParents: false,
        generateReports: true,
        ...options,
      }

      // Filter eligible students
      const eligibleStudents = this.filterEligibleStudents(students, defaultOptions)
      result.summary.totalProcessed = eligibleStudents.length

      // Process each student
      for (const student of eligibleStudents) {
        try {
          const promotionResult = await this.processStudentPromotion(student, defaultOptions)

          if (promotionResult.promoted) {
            result.promoted.push(promotionResult.promoted)
            result.summary.totalPromoted++

            // Track promotions by class
            const currentClass = student.className
            result.summary.promotionsByClass[currentClass] = (result.summary.promotionsByClass[currentClass] || 0) + 1
          }

          if (promotionResult.transferred) {
            result.transferred.push(promotionResult.transferred)
            result.summary.totalTransferred++

            // Track transfers by reason
            const reason = promotionResult.transferred.transferReason
            result.summary.transfersByReason[reason] = (result.summary.transfersByReason[reason] || 0) + 1
          }

          if (promotionResult.warnings.length > 0) {
            result.warnings.push(...promotionResult.warnings)
          }
        } catch (error) {
          const errorMessage = `Failed to process ${student.fullName}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
          result.errors.push(errorMessage)
          result.summary.totalErrors++
        }
      }

      result.success = result.errors.length === 0
      return result
    } catch (error) {
      result.errors.push(`Promotion runner failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      return result
    }
  }

  /**
   * Generate promotion preview without making changes
   */
  generatePromotionPreview(students: Student[]): PromotionPreview[] {
    const previews: PromotionPreview[] = []

    for (const student of students) {
      if (student.isTransferred) continue

      const preview = this.createPromotionPreview(student)
      if (preview) {
        previews.push(preview)
      }
    }

    return previews.sort((a, b) => a.currentClass.localeCompare(b.currentClass))
  }

  /**
   * Process individual student promotion
   */
  private async processStudentPromotion(
    student: Student,
    options: BulkPromotionOptions,
  ): Promise<{
    promoted?: Student
    transferred?: TransferredStudent
    warnings: string[]
  }> {
    const warnings: string[] = []
    const outstandingAmount = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

    // Check payment requirements
    if (options.requirePaymentCompletion && outstandingAmount > options.maxOutstandingAmount) {
      warnings.push(`Student has outstanding amount of $${outstandingAmount.toFixed(2)}`)
      if (!options.includeStudentsWithOutstanding) {
        throw new Error(`Outstanding payment of $${outstandingAmount.toFixed(2)} prevents promotion`)
      }
    }

    // Determine promotion path
    const promotionPath = this.determinePromotionPath(student)

    if (promotionPath.type === "promotion") {
      const promoted = await this.promoteStudent(student, promotionPath.newClass, promotionPath.newClassGroup)
      return { promoted, warnings }
    } else if (promotionPath.type === "transfer") {
      const transferred = this.transferStudent(student, promotionPath.reason)
      return { transferred, warnings }
    } else {
      warnings.push(`No promotion path found for ${student.fullName} in ${student.className}`)
      return { warnings }
    }
  }

  /**
   * Promote student to new class/grade
   */
  private async promoteStudent(student: Student, newClassName: string, newClassGroup: string): Promise<Student> {
    const newClassGroupData = this.settings.classGroups.find((cg) => cg.id === newClassGroup)
    if (!newClassGroupData) {
      throw new Error(`Class group ${newClassGroup} not found`)
    }

    // Initialize new fee payments for the promoted student
    const newFeePayments = this.initializeFeePaymentsForNewYear(student, newClassGroupData, this.currentAcademicYear)

    const promotedStudent: Student = {
      ...student,
      className: newClassName,
      classGroup: newClassGroup,
      academicYear: this.currentAcademicYear,
      feePayments: newFeePayments,
      totalPaid: 0,
      totalOwed: 0,
      notes:
        `${student.notes || ""}\nPromoted from ${student.className} on ${this.promotionDate.toLocaleDateString()}`.trim(),
    }

    // Recalculate totals
    const { totalPaid, totalOwed, annualFeeCalculated } = calculateStudentTotals(
      promotedStudent,
      this.settings.billingCycle,
    )

    promotedStudent.totalPaid = totalPaid
    promotedStudent.totalOwed = totalOwed
    promotedStudent.annualFee = annualFeeCalculated

    return promotedStudent
  }

  /**
   * Transfer student (graduation or leaving)
   */
  private transferStudent(student: Student, reason: string): TransferredStudent {
    return {
      ...student,
      isTransferred: true,
      transferDate: this.promotionDate.toISOString().split("T")[0],
      transferReason: reason,
      originalClassGroup: student.classGroup,
      originalClassName: student.className,
      feePayments: [], // Clear fee payments for transferred students
      totalPaid: 0,
      totalOwed: 0,
    }
  }

  /**
   * Determine promotion path for a student
   */
  private determinePromotionPath(student: Student): {
    type: "promotion" | "transfer" | "retention"
    newClass?: string
    newClassGroup?: string
    reason?: string
  } {
    const classGroup = this.settings.classGroups.find((cg) => cg.id === student.classGroup)
    if (!classGroup) {
      return { type: "retention" }
    }

    // ECD promotions
    if (student.classGroup === "ecd-ab") {
      if (student.className.includes("ECD A")) {
        return { type: "promotion", newClass: "ECD B", newClassGroup: "ecd-ab" }
      } else if (student.className.includes("ECD B")) {
        return { type: "promotion", newClass: "Grade 1", newClassGroup: "grade-1-7" }
      }
    }

    // Primary school promotions (Grade 1-7)
    if (student.classGroup === "grade-1-7") {
      const gradeMatch = student.className.match(/Grade (\d+)/)
      if (gradeMatch) {
        const currentGrade = Number.parseInt(gradeMatch[1])
        if (currentGrade >= 1 && currentGrade <= 6) {
          return {
            type: "promotion",
            newClass: `Grade ${currentGrade + 1}`,
            newClassGroup: "grade-1-7",
          }
        } else if (currentGrade === 7) {
          return {
            type: "transfer",
            reason: "Graduated from primary school (Grade 7)",
          }
        }
      }
    }

    // Secondary school promotions (Form 1-6)
    if (student.classGroup === "form-1-6") {
      const formMatch = student.className.match(/Form (\d+)/)
      if (formMatch) {
        const currentForm = Number.parseInt(formMatch[1])
        if (currentForm >= 1 && currentForm <= 5) {
          return {
            type: "promotion",
            newClass: `Form ${currentForm + 1}`,
            newClassGroup: "form-1-6",
          }
        } else if (currentForm === 6) {
          return {
            type: "transfer",
            reason: "Graduated from secondary school (Form 6)",
          }
        }
      }
    }

    // College promotions
    if (student.classGroup === "college") {
      const yearMatch = student.className.match(/Year (\d+)/)
      if (yearMatch) {
        const currentYear = Number.parseInt(yearMatch[1])
        if (currentYear >= 1 && currentYear <= 2) {
          return {
            type: "promotion",
            newClass: `College Year ${currentYear + 1}`,
            newClassGroup: "college",
          }
        } else if (currentYear >= 3) {
          return {
            type: "transfer",
            reason: "Graduated from college",
          }
        }
      }
    }

    return { type: "retention" }
  }

  /**
   * Create promotion preview for a student
   */
  private createPromotionPreview(student: Student): PromotionPreview | null {
    const promotionPath = this.determinePromotionPath(student)
    const outstandingAmount = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
    const warnings: string[] = []

    if (outstandingAmount > 0) {
      warnings.push(`Outstanding payment: $${outstandingAmount.toFixed(2)}`)
    }

    if (promotionPath.type === "retention") {
      return null
    }

    let promotionType: PromotionPreview["promotionType"] = "grade_promotion"
    let newClass = "No change"

    if (promotionPath.type === "promotion") {
      newClass = promotionPath.newClass || "Unknown"
      promotionType = "grade_promotion"
    } else if (promotionPath.type === "transfer") {
      newClass = "Graduated/Transferred"
      promotionType = "graduation"
    }

    return {
      student,
      currentClass: student.className,
      newClass,
      promotionType,
      requiresApproval: outstandingAmount > 0,
      outstandingAmount,
      warnings,
    }
  }

  /**
   * Filter students eligible for promotion
   */
  private filterEligibleStudents(students: Student[], options: BulkPromotionOptions): Student[] {
    return students.filter((student) => {
      if (student.isTransferred) return false

      const outstandingAmount = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

      if (options.requirePaymentCompletion && outstandingAmount > options.maxOutstandingAmount) {
        return options.includeStudentsWithOutstanding
      }

      return true
    })
  }

  /**
   * Initialize fee payments for new academic year
   */
  private initializeFeePaymentsForNewYear(
    student: Student,
    classGroup: ClassGroup,
    academicYear: string,
  ): FeePayment[] {
    const currentYear = getCurrentYear()
    const feePayments: FeePayment[] = []

    if (this.settings.billingCycle === BillingCycle.MONTHLY) {
      for (let month = 1; month <= 12; month++) {
        let amountDue = classGroup.standardFee

        if (student.hasTransport && !student.isTransferred) {
          amountDue += student.transportFee || 0
        }

        feePayments.push({
          period: month,
          amountDue,
          amountPaid: 0,
          paid: false,
          dueDate: new Date(currentYear, month - 1, this.settings.paymentDueDate || 15).toISOString().split("T")[0],
          isTransportWaived: false,
          outstandingAmount: amountDue,
        })
      }
    } else {
      // Termly billing
      TERMS.forEach((term) => {
        let amountDue = classGroup.standardFee * term.months.length

        if (student.hasTransport && !student.isTransferred) {
          amountDue += (student.transportFee || 0) * term.months.length
        }

        feePayments.push({
          period: term.period,
          amountDue,
          amountPaid: 0,
          paid: false,
          dueDate: new Date(currentYear, term.months[0] - 1, this.settings.paymentDueDate || 15)
            .toISOString()
            .split("T")[0],
          isTransportWaived: false,
          outstandingAmount: amountDue,
        })
      })
    }

    return feePayments
  }

  /**
   * Check if current date is within promotion period
   */
  private isPromotionPeriod(): boolean {
    const now = new Date()
    const month = now.getMonth() + 1 // JavaScript months are 0-indexed

    // Typically promotions happen at end of academic year (November-December)
    // or beginning of new year (January-February)
    return month >= 11 || month <= 2
  }

  /**
   * Bulk promote students by class
   */
  async bulkPromoteByClass(
    students: Student[],
    className: string,
    newClassName: string,
    newClassGroup: string,
    options: Partial<BulkPromotionOptions> = {},
  ): Promise<PromotionRunnerResult> {
    const classStudents = students.filter((s) => s.className === className && !s.isTransferred)

    const result: PromotionRunnerResult = {
      success: false,
      promoted: [],
      transferred: [],
      errors: [],
      warnings: [],
      summary: {
        totalProcessed: classStudents.length,
        totalPromoted: 0,
        totalTransferred: 0,
        totalErrors: 0,
        promotionsByClass: {},
        transfersByReason: {},
      },
    }

    try {
      for (const student of classStudents) {
        try {
          const promoted = await this.promoteStudent(student, newClassName, newClassGroup)
          result.promoted.push(promoted)
          result.summary.totalPromoted++
        } catch (error) {
          result.errors.push(
            `Failed to promote ${student.fullName}: ${error instanceof Error ? error.message : "Unknown error"}`,
          )
          result.summary.totalErrors++
        }
      }

      result.summary.promotionsByClass[className] = result.summary.totalPromoted
      result.success = result.errors.length === 0

      return result
    } catch (error) {
      result.errors.push(`Bulk promotion failed: ${error instanceof Error ? error.message : "Unknown error"}`)
      return result
    }
  }

  /**
   * Generate promotion report
   */
  generatePromotionReport(result: PromotionRunnerResult): string {
    const report = [
      "=== STUDENT PROMOTION REPORT ===",
      `Date: ${new Date().toLocaleDateString()}`,
      `Academic Year: ${this.currentAcademicYear}`,
      "",
      "=== SUMMARY ===",
      `Total Students Processed: ${result.summary.totalProcessed}`,
      `Successfully Promoted: ${result.summary.totalPromoted}`,
      `Transferred/Graduated: ${result.summary.totalTransferred}`,
      `Errors: ${result.summary.totalErrors}`,
      `Warnings: ${result.warnings.length}`,
      "",
      "=== PROMOTIONS BY CLASS ===",
      ...Object.entries(result.summary.promotionsByClass).map(
        ([className, count]) => `${className}: ${count} students`,
      ),
      "",
      "=== TRANSFERS BY REASON ===",
      ...Object.entries(result.summary.transfersByReason).map(([reason, count]) => `${reason}: ${count} students`),
      "",
    ]

    if (result.errors.length > 0) {
      report.push("=== ERRORS ===")
      report.push(...result.errors)
      report.push("")
    }

    if (result.warnings.length > 0) {
      report.push("=== WARNINGS ===")
      report.push(...result.warnings)
      report.push("")
    }

    report.push("=== END OF REPORT ===")

    return report.join("\n")
  }
}

/**
 * Utility functions for promotion management
 */
export const PromotionUtils = {
  /**
   * Create new promotion runner instance
   */
  createRunner: (settings: AppSettings) => new PromotionRunner(settings),

  /**
   * Quick promotion preview
   */
  quickPreview: (students: Student[], settings: AppSettings): PromotionPreview[] => {
    const runner = new PromotionRunner(settings)
    return runner.generatePromotionPreview(students)
  },

  /**
   * Validate promotion eligibility
   */
  validateEligibility: (
    student: Student,
    settings: AppSettings,
  ): {
    eligible: boolean
    reasons: string[]
  } => {
    const reasons: string[] = []

    if (student.isTransferred) {
      reasons.push("Student is already transferred")
    }

    const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
    if (outstanding > 0) {
      reasons.push(`Outstanding payment: $${outstanding.toFixed(2)}`)
    }

    return {
      eligible: reasons.length === 0,
      reasons,
    }
  },

  /**
   * Get promotion statistics
   */
  getPromotionStats: (
    students: Student[],
  ): {
    totalStudents: number
    eligibleForPromotion: number
    requiresTransfer: number
    hasOutstanding: number
    byClass: Record<string, number>
  } => {
    const stats = {
      totalStudents: students.length,
      eligibleForPromotion: 0,
      requiresTransfer: 0,
      hasOutstanding: 0,
      byClass: {} as Record<string, number>,
    }

    students.forEach((student) => {
      if (student.isTransferred) return

      // Count by class
      stats.byClass[student.className] = (stats.byClass[student.className] || 0) + 1

      // Check if eligible for promotion (simplified logic)
      const isGraduating =
        student.className.includes("Grade 7") ||
        student.className.includes("Form 6") ||
        student.className.includes("College Year 3")

      if (isGraduating) {
        stats.requiresTransfer++
      } else {
        stats.eligibleForPromotion++
      }

      if (student.totalOwed > 0) {
        stats.hasOutstanding++
      }
    })

    return stats
  },
}

export default PromotionRunner
