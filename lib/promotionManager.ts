import type { AppSettings, Student, TransferredStudent } from "../types/index"
import { getCurrentAcademicYear } from "./academicUtils"
import { performAutomaticPromotions } from "./promotionUtils"

export class PromotionManager {
  private settings: AppSettings

  constructor(settings: AppSettings) {
    this.settings = settings
  }

  /**
   * Check for automatic ECD B promotions on January 1st
   */
  checkAutomaticECDBPromotions(): { promoted: Student[]; message: string } {
    try {
      // Get students from localStorage
      const studentsData = localStorage.getItem("studentTrackStudents")
      if (!studentsData) {
        return { promoted: [], message: "No students found for promotion check" }
      }

      const students: Student[] = JSON.parse(studentsData)
      const currentYear = getCurrentAcademicYear()

      // Find ECD B students who need automatic promotion
      const ecdBStudents = students.filter((student) => {
        const classGroup = this.settings.classGroups.find((g) => g.id === student.classGroup)
        return classGroup?.name === "ECD B" && student.academicYear === currentYear.toString()
      })

      if (ecdBStudents.length === 0) {
        return { promoted: [], message: "No ECD B students found for automatic promotion" }
      }

      // Find the target class group (Grade 1 or equivalent)
      const targetClassGroup = this.settings.classGroups.find(
        (g) =>
          g.name.toLowerCase().includes("grade 1") || g.name.toLowerCase().includes("class 1") || g.name === "Grade 1",
      )

      if (!targetClassGroup) {
        console.warn("No target class group found for ECD B promotion")
        return { promoted: [], message: "No target class group configured for ECD B promotion" }
      }

      // Promote ECD B students
      const promotedStudents: Student[] = []
      const updatedStudents = students.map((student) => {
        if (ecdBStudents.some((ecd) => ecd.id === student.id)) {
          const promotedStudent = {
            ...student,
            classGroup: targetClassGroup.id,
            className: targetClassGroup.classes[0] || "A", // Default to first available class
            academicYear: (currentYear + 1).toString(),
            // Reset fee payments for new academic year
            feePayments: [],
            totalPaid: 0,
            totalOwed: 0,
          }
          promotedStudents.push(promotedStudent)
          return promotedStudent
        }
        return student
      })

      // Save updated students
      localStorage.setItem("studentTrackStudents", JSON.stringify(updatedStudents))

      return {
        promoted: promotedStudents,
        message: `Automatically promoted ${promotedStudents.length} ECD B students to ${targetClassGroup.name}`,
      }
    } catch (error) {
      console.error("Error in automatic ECD B promotion check:", error)
      return { promoted: [], message: "Error occurred during automatic promotion check" }
    }
  }

  /**
   * Run bulk promotions for all eligible students
   */
  runBulkPromotions(): { promoted: Student[]; transferred: TransferredStudent[]; message: string } {
    try {
      const studentsData = localStorage.getItem("studentTrackStudents")
      if (!studentsData) {
        return { promoted: [], transferred: [], message: "No students found" }
      }

      const students: Student[] = JSON.parse(studentsData)
      const currentYear = getCurrentAcademicYear()

      const result = performAutomaticPromotions(
        students,
        this.settings.promotionThreshold,
        this.settings.graduationClassGroup,
        currentYear,
        this.settings.classGroups,
      )

      // Update localStorage with promoted students
      if (result.promoted.length > 0 || result.transferred.length > 0) {
        const updatedStudents = students
          .map((student) => {
            const promoted = result.promoted.find((p) => p.id === student.id)
            return promoted || student
          })
          .filter((student) => !result.transferred.some((t) => t.id === student.id))

        localStorage.setItem("studentTrackStudents", JSON.stringify(updatedStudents))

        // Update transferred students
        const existingTransferred = localStorage.getItem("studentTrackTransferred")
        const currentTransferred: TransferredStudent[] = existingTransferred ? JSON.parse(existingTransferred) : []
        const allTransferred = [...currentTransferred, ...result.transferred]
        localStorage.setItem("studentTrackTransferred", JSON.stringify(allTransferred))
      }

      return {
        promoted: result.promoted,
        transferred: result.transferred,
        message: `Promoted ${result.promoted.length} students, transferred ${result.transferred.length} students`,
      }
    } catch (error) {
      console.error("Error in bulk promotions:", error)
      return { promoted: [], transferred: [], message: "Error occurred during bulk promotions" }
    }
  }

  /**
   * Get promotion preview without making changes
   */
  getPromotionPreview(): { promoted: Student[]; retained: Student[]; transferred: Student[] } {
    try {
      const studentsData = localStorage.getItem("studentTrackStudents")
      if (!studentsData) {
        return { promoted: [], retained: [], transferred: [] }
      }

      const students: Student[] = JSON.parse(studentsData)
      const currentYear = getCurrentAcademicYear()

      // This would use the existing getPromotionPreview function
      // For now, return empty arrays as placeholder
      return { promoted: [], retained: [], transferred: [] }
    } catch (error) {
      console.error("Error getting promotion preview:", error)
      return { promoted: [], retained: [], transferred: [] }
    }
  }
}
