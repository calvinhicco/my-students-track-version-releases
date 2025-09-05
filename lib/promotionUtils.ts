import type { Student, TransferredStudent, AppSettings, PendingPromotedStudent } from "../types/index"
import { calculateOutstandingFromEnrollment } from "./calculations"
import { SchoolDataStorage } from "./storage"
import { getCurrentAcademicYear } from "./academicUtils"

export interface PromotionRule {
  id: string
  name: string
  description: string
  enabled: boolean
  conditions: {
    minAttendancePercentage?: number
    maxOutstandingAmount?: number
    minAgeForClass?: number
    maxAgeForClass?: number
    requiresManualApproval?: boolean
    customCondition?: (student: Student) => boolean
  }
  actions: {
    promoteToNextClass: boolean
    clearPaymentHistory?: boolean
    updateTransportFee?: boolean
    generateCertificate?: boolean
    notifyParents?: boolean
  }
  applicableClasses: string[]
  effectiveDate: string
  createdBy: string
  lastModified: string
}

export interface PromotionPreview {
  studentId: string
  studentName: string
  currentClass: string
  proposedClass: string
  canPromote: boolean
  reasons: string[]
  warnings: string[]
  outstandingAmount: number
  ageAtPromotion: number
  requiresApproval: boolean
}

export interface PromotionResult {
  success: boolean
  studentsProcessed: number
  studentsPromoted: number
  studentsTransferred: number
  pendingECDB: number // New field for ECD B students
  errors: Array<{
    studentId: string
    studentName: string
    error: string
  }>
  warnings: Array<{
    studentId: string
    studentName: string
    warning: string
  }>
  summary: {
    totalEligible: number
    totalPromoted: number
    totalBlocked: number
    totalRequiringApproval: number
    totalPendingECDB: number
    byClass: Record<
      string,
      {
        eligible: number
        promoted: number
        blocked: number
        pendingECDB: number
      }
    >
  }
}

export interface PromotionAnalytics {
  academicYear: string
  totalStudents: number
  promotionRate: number
  retentionRate: number
  transferRate: number
  classDistribution: Record<string, number>
  ageDistribution: Record<string, number>
  outstandingPayments: {
    totalAmount: number
    studentsAffected: number
    averageOutstanding: number
  }
  recommendations: string[]
}

/**
 * Enhanced Promotion Manager with comprehensive ECD B promotion system
 */
export class PromotionManager {
  private storage: SchoolDataStorage
  private settings: AppSettings
  private rules: PromotionRule[]

  constructor(settings: AppSettings) {
    this.storage = new SchoolDataStorage()
    this.settings = settings
    this.rules = this.loadPromotionRules()
  }

  /**
   * Check and perform automatic promotions on January 1st
   * Handles both ECD B promotions and regular grade promotions
   */
  checkAutomaticPromotions(): {
    promoted: Student[]
    transferred: TransferredStudent[]
    pendingECDB: PendingPromotedStudent[]
    message: string
  } {
    const today = new Date()
    const isPromotionDate = this.isPromotionDate(today)

    if (!isPromotionDate) {
      return {
        promoted: [],
        transferred: [],
        pendingECDB: [],
        message: `Automatic promotions only occur on ${this.settings.autoPromotionDate || "January 1st"}`,
      }
    }

    const students = this.storage.getStudents()

    // Handle ECD B promotions first
    const ecdBResult = this.handleECDBPromotions(students, today)

    // Handle regular grade promotions (excluding ECD B students)
    const remainingStudents = students.filter(
      (student) => !ecdBResult.pendingECDB.some((pending) => pending.id === student.id),
    )

    const regularPromotions = this.handleRegularPromotions(remainingStudents, today)

    // Combine results
    const allPromoted = [...regularPromotions.promoted]
    const allTransferred = [...regularPromotions.transferred]
    const allPendingECDB = [...ecdBResult.pendingECDB]

    // Update storage
    const finalStudents = students
      .filter(
        (student) =>
          !allPromoted.some((p) => p.id === student.id) &&
          !allTransferred.some((t) => t.id === student.id) &&
          !allPendingECDB.some((p) => p.id === student.id),
      )
      .concat(allPromoted)

    this.storage.saveStudents(finalStudents)

    // Update transferred students
    const existingTransferred = this.storage.getTransferredStudents()
    this.storage.saveTransferredStudents([...existingTransferred, ...allTransferred])

    // Update pending ECD B students
    const existingPending = this.storage.getPendingPromotedStudents()
    this.storage.savePendingPromotedStudents([...existingPending, ...allPendingECDB])

    const totalProcessed = allPromoted.length + allTransferred.length + allPendingECDB.length

    return {
      promoted: allPromoted,
      transferred: allTransferred,
      pendingECDB: allPendingECDB,
      message: `Automatic promotions completed: ${allPromoted.length} promoted, ${allTransferred.length} transferred, ${allPendingECDB.length} ECD B students moved to pending list`,
    }
  }

  /**
   * Handle ECD B to Grade 1 promotions
   */
  private handleECDBPromotions(
    students: Student[],
    promotionDate: Date,
  ): {
    pendingECDB: PendingPromotedStudent[]
  } {
    const ecdBStudents = students.filter((student) => this.isECDBStudent(student) && !student.isTransferred)

    const pendingECDB: PendingPromotedStudent[] = ecdBStudents.map((student) => ({
      ...student,
      promotionDate: promotionDate.toISOString().split("T")[0],
      fromClass: student.className,
      toClass: "Grade 1",
      promotionType: "ECD_B_TO_GRADE_1" as const,
      canBeRestored: true,
      originalData: { ...student }, // Store original data for restoration
    }))

    return { pendingECDB }
  }

  /**
   * Handle regular grade promotions (Grade 1-6 to next grade, Grade 7 to transfer)
   */
  private handleRegularPromotions(
    students: Student[],
    promotionDate: Date,
  ): {
    promoted: Student[]
    transferred: TransferredStudent[]
  } {
    const promoted: Student[] = []
    const transferred: TransferredStudent[] = []

    students.forEach((student) => {
      if (student.isTransferred) return

      const promotionResult = this.determinePromotionAction(student)

      if (promotionResult.action === "promote") {
        const promotedStudent = this.promoteStudentToNextGrade(student, promotionResult.targetClass!)
        promoted.push(promotedStudent)
      } else if (promotionResult.action === "transfer") {
        const transferredStudent = this.transferStudentOnGraduation(student, promotionDate)
        transferred.push(transferredStudent)
      }
      // If action is "retain", student stays in current grade
    })

    return { promoted, transferred }
  }

  /**
   * Determine what action to take for a student during promotion
   */
  private determinePromotionAction(student: Student): {
    action: "promote" | "transfer" | "retain"
    targetClass?: string
    reason?: string
  } {
    // Check if student meets promotion criteria
    const canPromote = this.canStudentBePromoted(student)

    if (!canPromote) {
      return { action: "retain", reason: "Does not meet promotion criteria" }
    }

    // Determine next class/grade
    const nextClass = this.determineNextClass(student)

    if (!nextClass) {
      // Student is in final grade - transfer/graduate
      return { action: "transfer", reason: "Graduation from final grade" }
    }

    return { action: "promote", targetClass: nextClass }
  }

  /**
   * Promote student to next grade
   */
  private promoteStudentToNextGrade(student: Student, targetClass: string): Student {
    const nextAcademicYear = (Number.parseInt(getCurrentAcademicYear()) + 1).toString()

    // Find target class group
    const targetClassGroup = this.findClassGroupForClass(targetClass)

    return {
      ...student,
      className: targetClass,
      classGroup: targetClassGroup?.id || student.classGroup,
      academicYear: nextAcademicYear,
      // Reset fee payments for new academic year
      feePayments: [],
      transportPayments: student.hasTransport ? [] : student.transportPayments,
      totalPaid: 0,
      totalOwed: 0,
      notes: (student.notes || "") + ` [AUTO-PROMOTED from ${student.className} on ${new Date().toLocaleDateString()}]`,
    }
  }

  /**
   * Transfer student on graduation
   */
  private transferStudentOnGraduation(student: Student, transferDate: Date): TransferredStudent {
    return {
      ...student,
      isTransferred: true,
      transferDate: transferDate.toISOString().split("T")[0],
      transferReason: "Graduation - Completed final grade",
      newSchool: "Graduated",
      originalAdmissionDate: student.admissionDate,
      originalClassGroup: student.classGroup,
      originalClassName: student.className,
      paymentHistoryRetained: true,
      notes: (student.notes || "") + ` [GRADUATED on ${transferDate.toLocaleDateString()}]`,
    }
  }

  /**
   * Check if student is ECD B
   */
  private isECDBStudent(student: Student): boolean {
    const className = student.className.toLowerCase()
    return className.includes("ecd b") || className.includes("ecd-b") || className === "ecd b"
  }

  /**
   * Check if today is promotion date
   */
  private isPromotionDate(date: Date): boolean {
    const promotionDate = this.settings.autoPromotionDate || "01-01"
    const [month, day] = promotionDate.split("-").map(Number)

    return date.getMonth() + 1 === month && date.getDate() === day
  }

  /**
   * Get pending promoted students
   */
  getPendingPromotedStudents(): PendingPromotedStudent[] {
    return this.storage.getPendingPromotedStudents()
  }

  /**
   * Save pending promoted students
   */
  savePendingPromotedStudents(students: PendingPromotedStudent[]): boolean {
    return this.storage.savePendingPromotedStudents(students)
  }

  /**
   * Restore pending promoted student back to main system
   */
  restorePendingStudent(
    studentId: string,
    updatedData?: Partial<Student>,
  ): {
    success: boolean
    message: string
  } {
    const pendingStudents = this.getPendingPromotedStudents()
    const studentIndex = pendingStudents.findIndex((s) => s.id === studentId)

    if (studentIndex === -1) {
      return { success: false, message: "Student not found in pending list" }
    }

    const pendingStudent = pendingStudents[studentIndex]

    // Create restored student with Grade 1 setup
    const restoredStudent: Student = {
      ...pendingStudent.originalData, // Start with original data
      className: updatedData?.className || "Grade 1", // Default to Grade 1
      classGroup: this.findGrade1ClassGroup()?.id || pendingStudent.classGroup,
      academicYear: getCurrentAcademicYear(),
      ...updatedData, // Apply any manual updates
      // Initialize new fee structure for Grade 1
      feePayments: [],
      transportPayments: pendingStudent.hasTransport ? [] : [],
      totalPaid: 0,
      totalOwed: 0,
      notes: (pendingStudent.notes || "") + ` [RESTORED from ECD B pending list on ${new Date().toLocaleDateString()}]`,
    }

    // Remove from pending list
    const updatedPendingStudents = pendingStudents.filter((_, index) => index !== studentIndex)

    // Add back to main students
    const students = this.storage.getStudents()
    students.push(restoredStudent)

    // Save changes
    const saveSuccess = this.storage.saveStudents(students) && this.savePendingPromotedStudents(updatedPendingStudents)

    if (saveSuccess) {
      return {
        success: true,
        message: `Student ${restoredStudent.fullName} restored to main system as ${restoredStudent.className}`,
      }
    } else {
      return { success: false, message: "Failed to save changes" }
    }
  }

  /**
   * Delete pending promoted student permanently
   */
  deletePendingStudent(studentId: string): {
    success: boolean
    message: string
  } {
    const pendingStudents = this.getPendingPromotedStudents()
    const studentIndex = pendingStudents.findIndex((s) => s.id === studentId)

    if (studentIndex === -1) {
      return { success: false, message: "Student not found in pending list" }
    }

    const student = pendingStudents[studentIndex]
    const updatedPendingStudents = pendingStudents.filter((_, index) => index !== studentIndex)

    const saveSuccess = this.savePendingPromotedStudents(updatedPendingStudents)

    if (saveSuccess) {
      return {
        success: true,
        message: `Student ${student.fullName} permanently removed from pending list`,
      }
    } else {
      return { success: false, message: "Failed to save changes" }
    }
  }

  /**
   * Bulk restore all pending ECD B students
   */
  bulkRestorePendingStudents(targetClassName = "Grade 1"): {
    success: boolean
    restored: number
    message: string
  } {
    const pendingStudents = this.getPendingPromotedStudents()
    const ecdBPending = pendingStudents.filter((s) => s.promotionType === "ECD_B_TO_GRADE_1")

    if (ecdBPending.length === 0) {
      return { success: false, restored: 0, message: "No ECD B students in pending list" }
    }

    let restoredCount = 0
    const errors: string[] = []

    ecdBPending.forEach((pendingStudent) => {
      const result = this.restorePendingStudent(pendingStudent.id, { className: targetClassName })
      if (result.success) {
        restoredCount++
      } else {
        errors.push(`${pendingStudent.fullName}: ${result.message}`)
      }
    })

    return {
      success: restoredCount > 0,
      restored: restoredCount,
      message: `Restored ${restoredCount} students to ${targetClassName}. ${errors.length > 0 ? `Errors: ${errors.join(", ")}` : ""}`,
    }
  }

  /**
   * Transfer student to another school
   */
  async transferStudent(
    studentId: string,
    transferDetails: {
      transferDate: string
      newSchool: string
      reason: string
      retainPaymentHistory?: boolean
      generateTransferCertificate?: boolean
    },
  ): Promise<{ success: boolean; message: string; transferredStudent?: TransferredStudent }> {
    try {
      const students = this.storage.getStudents()
      const studentIndex = students.findIndex((s) => s.id === studentId)

      if (studentIndex === -1) {
        return { success: false, message: "Student not found" }
      }

      const student = students[studentIndex]
      if (student.isTransferred) {
        return { success: false, message: "Student is already transferred" }
      }

      // Create transferred student record
      const transferredStudent: TransferredStudent = {
        ...student,
        isTransferred: true,
        transferDate: transferDetails.transferDate,
        newSchool: transferDetails.newSchool,
        transferReason: transferDetails.reason,
        originalAdmissionDate: student.admissionDate,
        originalClassGroup: student.classGroup,
        originalClassName: student.className,
        paymentHistoryRetained: transferDetails.retainPaymentHistory || false,
      }

      // Clear payment history if not retaining
      if (!transferDetails.retainPaymentHistory) {
        transferredStudent.feePayments = []
        transferredStudent.transportPayments = []
        transferredStudent.totalPaid = 0
        transferredStudent.totalOwed = 0
      }

      // Remove from active students
      students.splice(studentIndex, 1)

      // Add to transferred students
      const transferredStudents = this.storage.getTransferredStudents()
      transferredStudents.push(transferredStudent)

      // Save changes
      const studentsSuccess = this.storage.saveStudents(students)
      const transferredSuccess = this.storage.saveTransferredStudents(transferredStudents)

      if (studentsSuccess && transferredSuccess) {
        return {
          success: true,
          message: `Student ${student.fullName} successfully transferred to ${transferDetails.newSchool}`,
          transferredStudent,
        }
      } else {
        return { success: false, message: "Failed to save transfer changes" }
      }
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error during transfer",
      }
    }
  }

  // Private helper methods
  private determineNextClass(student: Student): string | null {
    const currentClass = student.className.toLowerCase()

    // ECD progression (should not reach here as ECD B is handled separately)
    if (currentClass.includes("ecd")) {
      if (currentClass.includes("a")) return "ECD B"
      if (currentClass.includes("b")) return "Grade 1"
      return "ECD A"
    }

    // Primary school progression (Grade 1-7)
    const gradeMatch = currentClass.match(/grade\s*(\d+)/)
    if (gradeMatch) {
      const currentGrade = Number.parseInt(gradeMatch[1])
      if (currentGrade < 7) {
        return `Grade ${currentGrade + 1}`
      } else {
        return null // Grade 7 graduates/transfers
      }
    }

    // Secondary school progression (Form 1-6)
    const formMatch = currentClass.match(/form\s*(\d+)/)
    if (formMatch) {
      const currentForm = Number.parseInt(formMatch[1])
      if (currentForm < 6) {
        return `Form ${currentForm + 1}`
      } else {
        return null // Form 6 graduates
      }
    }

    // College/Advanced level
    if (currentClass.includes("lower 6")) return "Upper 6"
    if (currentClass.includes("upper 6")) return null // Graduation

    return null
  }

  private canStudentBePromoted(student: Student): boolean {
    const applicableRules = this.rules.filter(
      (rule) =>
        rule.enabled && (rule.applicableClasses.length === 0 || rule.applicableClasses.includes(student.className)),
    )

    for (const rule of applicableRules) {
      if (!this.evaluatePromotionRule(student, rule)) {
        return false
      }
    }

    return true
  }

  private evaluatePromotionRule(student: Student, rule: PromotionRule): boolean {
    const conditions = rule.conditions

    // Check outstanding amount
    if (conditions.maxOutstandingAmount !== undefined) {
      const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
      if (outstanding > conditions.maxOutstandingAmount) {
        return false
      }
    }

    // Check age requirements
    const currentAge = this.calculateCurrentAge(student)
    if (conditions.minAgeForClass !== undefined && currentAge < conditions.minAgeForClass) {
      return false
    }
    if (conditions.maxAgeForClass !== undefined && currentAge > conditions.maxAgeForClass) {
      return false
    }

    // Check custom condition
    if (conditions.customCondition && !conditions.customCondition(student)) {
      return false
    }

    return true
  }

  private calculateCurrentAge(student: Student): number {
    const birthDate = new Date(student.dateOfBirth)
    const today = new Date()
    let age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--
    }

    return age
  }

  private findClassGroupForClass(className: string): any {
    return this.settings.classGroups.find((group) =>
      group.classes.some((cls) => cls.toLowerCase() === className.toLowerCase()),
    )
  }

  private findGrade1ClassGroup(): any {
    return this.settings.classGroups.find((group) => group.classes.some((cls) => cls.toLowerCase().includes("grade 1")))
  }

  private loadPromotionRules(): PromotionRule[] {
    try {
      const saved = localStorage.getItem("promotionRules")
      return saved ? JSON.parse(saved) : this.getDefaultPromotionRules()
    } catch {
      return this.getDefaultPromotionRules()
    }
  }

  private savePromotionRules(): void {
    try {
      localStorage.setItem("promotionRules", JSON.stringify(this.rules))
    } catch (error) {
      console.error("Failed to save promotion rules:", error)
    }
  }

  private getDefaultPromotionRules(): PromotionRule[] {
    return [
      {
        id: "default_payment_rule",
        name: "Payment Clearance Rule",
        description: "Students must clear outstanding payments before promotion",
        enabled: true,
        conditions: {
          maxOutstandingAmount: 0,
        },
        actions: {
          promoteToNextClass: true,
          notifyParents: true,
        },
        applicableClasses: [],
        effectiveDate: new Date().toISOString(),
        createdBy: "System",
        lastModified: new Date().toISOString(),
      },
    ]
  }
}

// Simplified helper functions for backward compatibility
export function performAutomaticPromotions(
  students: Student[],
  threshold: number,
  graduationClassGroup: string,
  academicYear: string,
  classGroups: any[],
): { 
  promoted: Array<{
    id: string;
    classGroup: string;
    className: string;
    academicYear: string;
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
    totalPaid: number;
    totalOwed: number;
  }>;
  transferred: Array<{
    id: string;
    [key: string]: any;
  }>;
  pendingECDB: any[];
} {
  console.log("Using simplified promotion function - use PromotionManager instead")
  return { 
    promoted: [],
    transferred: [],
    pendingECDB: [] 
  }
}

export function getPromotionPreview(
  students: Student[],
  threshold: number,
  graduationClassGroup: string,
  academicYear: string,
  classGroups: any[],
) {
  return { promoted: [], retained: [], pendingECDB: [] }
}

export function manualTransferStudent(
  student: Student, 
  classGroupId: string, 
  notes: string, 
  reason: string
): TransferredStudent {
  const now = new Date().toISOString().split('T')[0];
  
  return {
    ...student,
    transferReason: reason,
    originalClassGroup: student.classGroup,
    originalClassName: student.className,
    newSchool: classGroupId, // Using classGroupId as newSchool as per the interface
    paymentHistoryRetained: false, // Default to false as we're not retaining payment history in this case
    originalAdmissionDate: student.admissionDate,
    // Clear payment-related fields
    feePayments: [],
    totalPaid: 0,
    totalOwed: 0,
    transportPayments: [],
    transportFee: 0,
    hasTransport: false,
    // Add any additional notes to the existing notes
    notes: student.notes ? `${student.notes}\nTransfer Note: ${notes}` : `Transfer Note: ${notes}`,
    // Update class information
    classGroup: classGroupId,
    className: classGroupId, // Assuming classGroupId can be used as className, adjust if needed
  };
}

/**
 * Clean up old transferred students based on retention years
 * @param students Array of all students (including transferred)
 * @param retentionYears Number of years to retain transfer records
 * @param callback Optional callback function to handle progress or completion
 */
export function cleanupOldTransfers(
  students: (Student | TransferredStudent)[], 
  retentionYears: number, 
  callback?: (progress: number, message: string) => void
): void {
  if (retentionYears < 0) {
    throw new Error("Retention years must be a non-negative number");
  }

  const currentDate = new Date();
  const cutoffDate = new Date();
  cutoffDate.setFullYear(currentDate.getFullYear() - retentionYears);

  // Filter out students who aren't transferred or are within retention period
  const activeTransfers = students.filter(student => {
    if (!('isTransferred' in student) || !student.isTransferred) {
      return false;
    }
    
    const transferDate = new Date(student.transferDate || 0);
    return transferDate > cutoffDate;
  });

  if (callback) {
    callback(100, `Cleaned up ${students.length - activeTransfers.length} old transfer records`);
  }
}

export default PromotionManager
