import type { Student, AppSettings, MigrationResult } from "../types/index"
import { DEFAULT_SETTINGS, DEFAULT_CLASS_GROUPS } from "../types/index"

// Migration version tracking
const MIGRATION_VERSION_KEY = "studentTrackMigrationVersion"
const CURRENT_MIGRATION_VERSION = 2

// Default values for migration
const DEFAULT_MONTHLY_FEE = 30
const DEFAULT_ANNUAL_FEE = 360

/**
 * Migration utilities for updating data structures
 */

export function needsMigration(students: Student[] | null): boolean {
  if (!students || !Array.isArray(students)) return false

  // Check if any student is missing transport payment structure
  return students.some((student) => {
    return (
      !student.hasOwnProperty("transportPayments") ||
      !student.hasOwnProperty("transportActivationDate") ||
      (student.hasTransport && !Array.isArray(student.transportPayments))
    )
  })
}

// Migrate a single student to add missing properties
function migrateStudent(student: any): Student {
  const migratedStudent = { ...student }

  // Add monthlyFee if missing
  if (migratedStudent.monthlyFee === undefined || migratedStudent.monthlyFee === null) {
    if (migratedStudent.annualFee && migratedStudent.annualFee > 0) {
      migratedStudent.monthlyFee = migratedStudent.annualFee / 12
    } else {
      migratedStudent.monthlyFee = DEFAULT_MONTHLY_FEE
      migratedStudent.annualFee = DEFAULT_ANNUAL_FEE
    }
  }

  // Ensure annualFee exists
  if (migratedStudent.annualFee === undefined || migratedStudent.annualFee === null || migratedStudent.annualFee <= 0) {
    migratedStudent.annualFee = migratedStudent.monthlyFee * 12
  }

  // Update monthly payment amounts to match monthlyFee
  if (migratedStudent.monthlyPayments && Array.isArray(migratedStudent.monthlyPayments)) {
    migratedStudent.monthlyPayments = migratedStudent.monthlyPayments.map((payment: any) => ({
      ...payment,
      amount: migratedStudent.monthlyFee,
    }))
  }

  // Ensure all required properties exist
  if (!migratedStudent.notes) {
    migratedStudent.notes = ""
  }

  return migratedStudent as Student
}

export function migrateStudentsData(students: Student[], settings: AppSettings): MigrationResult {
  const result: MigrationResult = {
    success: true,
    studentsUpdated: 0,
    updatedStudents: [],
    errors: [],
  }

  try {
    const updatedStudents = students.map((student) => {
      let updated = false
      const migratedStudent = { ...student }

      // Add missing transport payment structure
      if (!migratedStudent.hasOwnProperty("transportPayments")) {
        migratedStudent.transportPayments = []
        updated = true
      }

      // Add missing transport activation date
      if (!migratedStudent.hasOwnProperty("transportActivationDate")) {
        migratedStudent.transportActivationDate = undefined
        updated = true
      }

      // Ensure transport payments is an array
      if (migratedStudent.hasTransport && !Array.isArray(migratedStudent.transportPayments)) {
        migratedStudent.transportPayments = []
        updated = true
      }

      // Ensure fee payments is an array
      if (!Array.isArray(migratedStudent.feePayments)) {
        migratedStudent.feePayments = []
        updated = true
      }

      if (updated) {
        result.studentsUpdated++
      }

      return migratedStudent
    })

    result.updatedStudents = updatedStudents
  } catch (error) {
    result.success = false
    result.errors.push(error instanceof Error ? error.message : "Unknown migration error")
  }

  return result
}

// Main migration function
// export function migrateStudentsData(): MigrationResult {
//   const result: MigrationResult = {
//     success: false,
//     studentsUpdated: 0,
//     errors: [],
//   }

//   try {
//     // Get current students data
//     const studentsData = localStorage.getItem("studentTrackStudents")

//     if (!studentsData) {
//       // No students to migrate
//       result.success = true
//       localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString())
//       return result
//     }

//     let students: any[]
//     try {
//       students = JSON.parse(studentsData)
//     } catch (parseError) {
//       result.errors.push("Failed to parse existing students data")
//       return result
//     }

//     if (!Array.isArray(students)) {
//       result.errors.push("Students data is not in expected format")
//       return result
//     }

//     // Migrate each student
//     const migratedStudents: Student[] = []

//     for (let i = 0; i < students.length; i++) {
//       try {
//         const migratedStudent = migrateStudent(students[i])
//         migratedStudents.push(migratedStudent)
//         result.studentsUpdated++
//       } catch (error) {
//         result.errors.push(
//           `Failed to migrate student ${i + 1}: ${error instanceof Error ? error.message : "Unknown error"}`,
//         )
//       }
//     }

//     // Save migrated data
//     localStorage.setItem("studentTrackStudents", JSON.stringify(migratedStudents))
//     localStorage.setItem(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION.toString())

//     result.success = true

//     console.log(`Migration completed: ${result.studentsUpdated} students updated`)
//   } catch (error) {
//     result.errors.push(`Migration failed: ${error instanceof Error ? error.message : "Unknown error"}`)
//   }

//   return result
// }

export function migrateSettings(): AppSettings {
  try {
    const savedSettings = localStorage.getItem("studentTrackSettings")
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings)

      // Merge existing class groups with new default groups
      let mergedClassGroups = DEFAULT_CLASS_GROUPS
      if (Array.isArray(parsed.classGroups)) {
        // Keep existing settings for groups that already exist, add new ones
        mergedClassGroups = DEFAULT_CLASS_GROUPS.map(defaultGroup => {
          const existingGroup = parsed.classGroups.find((g: any) => g.id === defaultGroup.id)
          return existingGroup || defaultGroup
        })
      }

      // Ensure all required properties exist
      const migratedSettings = {
        ...DEFAULT_SETTINGS,
        ...parsed,
        classGroups: mergedClassGroups,
        transportDueDate: parsed.transportDueDate || 7,
      }

      // Save migrated settings
      localStorage.setItem("studentTrackSettings", JSON.stringify(migratedSettings))
      return migratedSettings
    }
  } catch (error) {
    console.error("Settings migration error:", error)
  }

  return DEFAULT_SETTINGS
}

// Reset migration (for testing purposes)
export function resetMigration(): void {
  localStorage.removeItem(MIGRATION_VERSION_KEY)
}

// Get migration status
export function getMigrationStatus(): { version: number; needsMigration: boolean } {
  const currentVersion = localStorage.getItem(MIGRATION_VERSION_KEY)
  return {
    version: currentVersion ? Number.parseInt(currentVersion, 10) : 0,
    needsMigration: false, // Fixed: needsMigration requires students parameter
  }
}

export function validateDataIntegrity(students: Student[]): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  students.forEach((student, index) => {
    // Validate required fields
    if (!student.id) errors.push(`Student ${index + 1}: Missing ID`)
    if (!student.fullName) errors.push(`Student ${index + 1}: Missing full name`)
    if (!student.admissionDate) errors.push(`Student ${index + 1}: Missing admission date`)

    // Validate fee payments
    if (!Array.isArray(student.feePayments)) {
      errors.push(`Student ${index + 1}: Fee payments must be an array`)
    }

    // Validate transport payments if transport is enabled
    if (student.hasTransport && !Array.isArray(student.transportPayments)) {
      warnings.push(`Student ${index + 1}: Transport enabled but transport payments not properly initialized`)
    }

    // Validate dates
    try {
      new Date(student.admissionDate)
      new Date(student.dateOfBirth)
    } catch {
      errors.push(`Student ${index + 1}: Invalid date format`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}
