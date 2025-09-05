import type { Student, TransferredStudent, AppSettings, LicenseData } from "../types/index"
import { SchoolDataStorage } from "./storage"

export interface BackupMetadata {
  id: string
  name: string
  description?: string
  createdAt: string
  createdBy: string
  version: string
  size: number
  checksum: string
  dataTypes: string[]
  studentCount: number
  transferredCount: number
  isAutomatic: boolean
}

export interface BackupData {
  metadata: BackupMetadata
  students: Student[]
  transferredStudents: TransferredStudent[]
  settings: AppSettings
  license?: LicenseData
  version: string
  exportedAt: string
}

export interface RestoreResult {
  success: boolean
  message: string
  studentsRestored: number
  transferredRestored: number
  settingsRestored: boolean
  errors: string[]
  warnings: string[]
}

export interface BackupValidation {
  valid: boolean
  errors: string[]
  warnings: string[]
  metadata?: BackupMetadata
  dataIntegrity: {
    studentsValid: boolean
    settingsValid: boolean
    licenseValid: boolean
    checksumValid: boolean
  }
}

/**
 * Advanced Backup Manager for My School Track
 * Handles data backup, restore, and integrity validation
 */
export class BackupManager {
  private storage: SchoolDataStorage
  private currentUser: string
  private backupHistory: BackupMetadata[]

  constructor(currentUser = "System") {
    this.storage = new SchoolDataStorage()
    this.currentUser = currentUser
    this.backupHistory = this.loadBackupHistory()
  }

  /**
   * Create a complete backup of all school data
   */
  async createBackup(
    name: string,
    description?: string,
    isAutomatic = false,
  ): Promise<{ success: boolean; backupId?: string; error?: string }> {
    try {
      // Gather all data
      const students = this.storage.getStudents()
      const transferredStudents = this.storage.getTransferredStudents()
      const settings = this.storage.getSettings()
      const license = this.storage.getLicense()

      if (!settings) {
        return { success: false, error: "Settings not found - cannot create backup" }
      }

      // Create backup metadata
      const backupId = this.generateBackupId()
      const exportedAt = new Date().toISOString()

      const backupData: BackupData = {
        metadata: {
          id: backupId,
          name,
          description,
          createdAt: exportedAt,
          createdBy: this.currentUser,
          version: "2.0.0",
          size: 0, // Will be calculated
          checksum: "", // Will be calculated
          dataTypes: ["students", "transferredStudents", "settings", "license"].filter((type) => {
            switch (type) {
              case "students":
                return students.length > 0
              case "transferredStudents":
                return transferredStudents.length > 0
              case "settings":
                return !!settings
              case "license":
                return !!license
              default:
                return false
            }
          }),
          studentCount: students.length,
          transferredCount: transferredStudents.length,
          isAutomatic,
        },
        students,
        transferredStudents,
        settings,
        license: license || undefined,
        version: "2.0.0",
        exportedAt,
      }

      // Calculate size and checksum
      const backupJson = JSON.stringify(backupData)
      backupData.metadata.size = new Blob([backupJson]).size
      backupData.metadata.checksum = await this.calculateChecksum(backupJson)

      // Save backup
      const saved = await this.saveBackup(backupData)
      if (!saved) {
        return { success: false, error: "Failed to save backup data" }
      }

      // Update backup history
      this.backupHistory.unshift(backupData.metadata)
      this.saveBackupHistory()

      // Cleanup old backups if needed
      await this.cleanupOldBackups()

      return { success: true, backupId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error during backup creation",
      }
    }
  }

  /**
   * Restore data from backup
   */
  async restoreFromBackup(
    backupId: string,
    options: {
      restoreStudents?: boolean
      restoreTransferred?: boolean
      restoreSettings?: boolean
      createBackupBeforeRestore?: boolean
    } = {},
  ): Promise<RestoreResult> {
    const result: RestoreResult = {
      success: false,
      message: "",
      studentsRestored: 0,
      transferredRestored: 0,
      settingsRestored: false,
      errors: [],
      warnings: [],
    }

    try {
      // Load backup data
      const backupData = await this.loadBackup(backupId)
      if (!backupData) {
        result.errors.push("Backup not found")
        return result
      }

      // Validate backup
      const validation = await this.validateBackup(backupData)
      if (!validation.valid) {
        result.errors.push(...validation.errors)
        result.warnings.push(...validation.warnings)
        if (validation.errors.length > 0) {
          return result
        }
      }

      // Create backup before restore if requested
      if (options.createBackupBeforeRestore) {
        const preRestoreBackup = await this.createBackup(
          `Pre-restore backup - ${new Date().toLocaleDateString()}`,
          `Automatic backup created before restoring from ${backupData.metadata.name}`,
          true,
        )
        if (!preRestoreBackup.success) {
          result.warnings.push("Failed to create pre-restore backup")
        }
      }

      // Restore students
      if (options.restoreStudents !== false && backupData.students) {
        const studentsRestored = this.storage.saveStudents(backupData.students)
        if (studentsRestored) {
          result.studentsRestored = backupData.students.length
        } else {
          result.errors.push("Failed to restore students data")
        }
      }

      // Restore transferred students
      if (options.restoreTransferred !== false && backupData.transferredStudents) {
        const transferredRestored = this.storage.saveTransferredStudents(backupData.transferredStudents)
        if (transferredRestored) {
          result.transferredRestored = backupData.transferredStudents.length
        } else {
          result.errors.push("Failed to restore transferred students data")
        }
      }

      // Restore settings
      if (options.restoreSettings !== false && backupData.settings) {
        const settingsRestored = this.storage.saveSettings(backupData.settings)
        if (settingsRestored) {
          result.settingsRestored = true
        } else {
          result.errors.push("Failed to restore settings")
        }
      }

      // Restore license if present
      if (backupData.license) {
        const licenseRestored = this.storage.saveLicense(backupData.license)
        if (!licenseRestored) {
          result.warnings.push("Failed to restore license data")
        }
      }

      result.success = result.errors.length === 0
      result.message = result.success
        ? `Successfully restored data from backup: ${backupData.metadata.name}`
        : "Restore completed with errors"

      return result
    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : "Unknown error during restore")
      return result
    }
  }

  /**
   * Validate backup data integrity
   */
  async validateBackup(backupData: BackupData | string): Promise<BackupValidation> {
    const validation: BackupValidation = {
      valid: true,
      errors: [],
      warnings: [],
      dataIntegrity: {
        studentsValid: true,
        settingsValid: true,
        licenseValid: true,
        checksumValid: true,
      },
    }

    try {
      let data: BackupData

      if (typeof backupData === "string") {
        try {
          data = JSON.parse(backupData)
        } catch {
          validation.valid = false
          validation.errors.push("Invalid JSON format")
          return validation
        }
      } else {
        data = backupData
      }

      validation.metadata = data.metadata

      // Validate structure
      if (!data.metadata || !data.students) {
        validation.valid = false
        validation.errors.push("Missing required backup components")
        return validation
      }

      // Validate metadata
      if (!data.metadata.id || !data.metadata.createdAt || !data.metadata.version) {
        validation.errors.push("Invalid backup metadata")
        validation.valid = false
      }

      // Validate students data
      if (!Array.isArray(data.students)) {
        validation.errors.push("Students data is not an array")
        validation.dataIntegrity.studentsValid = false
        validation.valid = false
      } else {
        // Check student data structure
        const invalidStudents = data.students.filter(
          (student) => !student.id || !student.fullName || !student.admissionDate,
        )
        if (invalidStudents.length > 0) {
          validation.warnings.push(`${invalidStudents.length} students have incomplete data`)
        }
      }

      // Validate settings (optional – older backups may not have it)
      if (data.settings) {
        if (!data.settings.schoolName || !data.settings.classGroups) {
          validation.warnings.push("Settings data is incomplete in backup; default app settings will be kept")
          validation.dataIntegrity.settingsValid = false
        }
      } else {
        validation.warnings.push("Backup has no settings section – will keep current settings on restore")
        validation.dataIntegrity.settingsValid = false
      }

      // Validate checksum if present
      if (data.metadata.checksum) {
        const calculatedChecksum = await this.calculateChecksum(JSON.stringify(data))
        if (calculatedChecksum !== data.metadata.checksum) {
          validation.warnings.push("Checksum mismatch - data may have been modified")
          validation.dataIntegrity.checksumValid = false
        }
      }

      // Version compatibility check
      if (data.version && data.version !== "2.0.0") {
        validation.warnings.push(`Backup version ${data.version} may not be fully compatible`)
      }

      return validation
    } catch (error) {
      validation.valid = false
      validation.errors.push(`Validation error: ${error instanceof Error ? error.message : "Unknown error"}`)
      return validation
    }
  }

  /**
   * Export backup to downloadable format
   */
  async exportBackup(
    backupId: string,
  ): Promise<{ success: boolean; data?: string; filename?: string; error?: string }> {
    try {
      const backupData = await this.loadBackup(backupId)
      if (!backupData) {
        return { success: false, error: "Backup not found" }
      }

      const exportData = JSON.stringify(backupData, null, 2)
      const datePart = new Date(backupData.metadata.createdAt)
          .toISOString()
          .replace(/[:]/g, "-")
          .replace("T", "_")
          .split(".")[0]
        const filename = `${backupData.metadata.name.replace(/[^a-zA-Z0-9]/g, "_")}_${datePart}.json`

      return {
        success: true,
        data: exportData,
        filename,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Export failed",
      }
    }
  }

  /**
   * Import backup from external source
   */
  async importBackup(
    backupJson: string,
    name?: string,
  ): Promise<{ success: boolean; backupId?: string; error?: string }> {
    try {
      // Validate the backup data
      const validation = await this.validateBackup(backupJson)
      if (!validation.valid) {
        return {
          success: false,
          error: `Invalid backup data: ${validation.errors.join(", ")}`,
        }
      }

      const backupData: BackupData = JSON.parse(backupJson)

      // Update metadata for import
      const importId = this.generateBackupId()
      backupData.metadata.id = importId
      backupData.metadata.name = name || `Imported - ${backupData.metadata.name}`
      backupData.metadata.createdAt = new Date().toISOString()
      backupData.metadata.createdBy = this.currentUser
      backupData.metadata.isAutomatic = false

      // Save imported backup
      const saved = await this.saveBackup(backupData)
      if (!saved) {
        return { success: false, error: "Failed to save imported backup" }
      }

      // Update backup history
      this.backupHistory.unshift(backupData.metadata)
      this.saveBackupHistory()

      return { success: true, backupId: importId }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Import failed",
      }
    }
  }

  /**
   * Get backup history
   */
  getBackupHistory(): BackupMetadata[] {
    return [...this.backupHistory].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * Delete backup
   */
  async deleteBackup(backupId: string): Promise<boolean> {
    try {
      // Remove from storage
      localStorage.removeItem(`backup_${backupId}`)

      // Remove from history
      this.backupHistory = this.backupHistory.filter((backup) => backup.id !== backupId)
      this.saveBackupHistory()

      return true
    } catch {
      return false
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackup(intervalHours = 24): void {
    // legacy daily/interval backups
    // NOTE: prefer scheduleMonthlyBackup for monthly backups

    // Clear existing interval
    const existingInterval = localStorage.getItem("autoBackupInterval")
    if (existingInterval) {
      clearInterval(Number.parseInt(existingInterval))
    }

    // Set new interval
    const intervalId = setInterval(
      async () => {
        await this.createBackup(`Auto Backup - ${new Date().toLocaleDateString()}`, "Automatic scheduled backup", true)
      },
      intervalHours * 60 * 60 * 1000,
    )

    localStorage.setItem("autoBackupInterval", intervalId.toString())
  }

    /**
   * Schedule an automatic backup on the 27th of every month.
   * Runs a lightweight check every 6 hours. If today is the 27th and no backup
   * exists yet for the current month, a backup is created.
   */
  scheduleMonthlyBackup(): void {
    const checkAndBackup = async () => {
      const now = new Date()
      if (now.getDate() !== 27) return

      const last = localStorage.getItem("lastMonthlyBackup")
      if (last) {
        const lastDate = new Date(last)
        if (lastDate.getFullYear() === now.getFullYear() && lastDate.getMonth() === now.getMonth()) {
          return // already backed up this month
        }
      }

      await this.createBackup(`Monthly Backup - ${now.toLocaleDateString()}`, "27th-of-month automatic backup", true)
      localStorage.setItem("lastMonthlyBackup", now.toISOString())
    }

    // run immediately then every 6h
    checkAndBackup()
    setInterval(checkAndBackup, 6 * 60 * 60 * 1000)
  }

  // Private methods

  private generateBackupId(): string {
    return `backup_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async calculateChecksum(data: string): Promise<string> {
    const encoder = new TextEncoder()
    const dataBuffer = encoder.encode(data)
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
  }

  private async saveBackup(backupData: BackupData): Promise<boolean> {
    try {
      const backupJson = JSON.stringify(backupData, null, 2)
      
      // For automatic backups, save to app installation root folder
      if (backupData.metadata.isAutomatic && typeof window !== "undefined" && (window as any).electronAPI) {
        const fileName = `auto-backup-${backupData.metadata.createdAt.slice(0, 10)}-${backupData.metadata.id}.json`
        const saved = await (window as any).electronAPI.saveDataBackup(backupJson, fileName, true)
        if (saved) {
          // Also keep in localStorage for backup history tracking
          localStorage.setItem(`backup_${backupData.metadata.id}`, JSON.stringify(backupData.metadata))
          return true
        }
        return false
      } else {
        // Manual backups continue to use localStorage
        localStorage.setItem(`backup_${backupData.metadata.id}`, backupJson)
        return true
      }
    } catch (error) {
      console.error("Failed to save backup:", error)
      return false
    }
  }

  private async loadBackup(backupId: string): Promise<BackupData | null> {
    try {
      const backupJson = localStorage.getItem(`backup_${backupId}`)
      return backupJson ? JSON.parse(backupJson) : null
    } catch {
      return null
    }
  }

  private loadBackupHistory(): BackupMetadata[] {
    try {
      const history = localStorage.getItem("backupHistory")
      return history ? JSON.parse(history) : []
    } catch {
      return []
    }
  }

  private saveBackupHistory(): void {
    try {
      localStorage.setItem("backupHistory", JSON.stringify(this.backupHistory))
    } catch (error) {
      console.error("Failed to save backup history:", error)
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    const maxBackups = 10 // Keep last 10 backups
    const automaticBackups = this.backupHistory.filter((b) => b.isAutomatic)

    if (automaticBackups.length > maxBackups) {
      const toDelete = automaticBackups
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .slice(0, automaticBackups.length - maxBackups)

      for (const backup of toDelete) {
        await this.deleteBackup(backup.id)
      }
    }
  }
}

export default BackupManager
