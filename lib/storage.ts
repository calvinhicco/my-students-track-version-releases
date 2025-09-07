import type { Student, TransferredStudent, PendingPromotedStudent, AppSettings, LicenseData } from "../types/index"

export class SchoolDataStorage {
  private readonly STORAGE_KEYS = {
    STUDENTS: "studentTrackStudents",
    SETTINGS: "studentTrackSettings",
    TRANSFERRED: "studentTrackTransferred",
    PENDING_PROMOTED: "pendingPromotedStudents",
    LICENSE: "studentTrackLicense",
    EXPENSES: "studentTrackExpenses",
    EXTRA_BILLING: "studentTrackExtraBilling",
    OUTSTANDING: "studentTrackOutstanding"
  }

  private async syncToFirestore(collection: string, data: any) {
    try {
      console.log(`🔄 Attempting to sync ${collection} with ${Array.isArray(data) ? data.length : 1} items`)
      
      // Only sync in Electron environment (not in Next.js build)
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        console.log(`📡 Sending ${collection} to Electron main process...`)
        const result = await (window as any).electronAPI.syncToFirestore(collection, data)
        console.log(`✅ Sync result for ${collection}:`, result)
        
        // Log sync status for debugging
        if (result && result.success) {
          console.log(`✅ Successfully synced ${collection} to Firebase`)
        } else {
          console.warn(`⚠️ Sync may have failed for ${collection}:`, result)
        }
      } else {
        console.log(`⚠️ Not in Electron environment, skipping sync for ${collection}`)
      }
    } catch (error: any) {
      console.error(`❌ Failed to sync ${collection} to Firestore:`, error)
      // Re-throw error to allow calling code to handle it
      throw error
    }
  }

  getStudents(): Student[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEYS.STUDENTS)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading students:", error)
      return []
    }
  }

  saveStudents(students: Student[]): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.STUDENTS, JSON.stringify(students))
      
      // Sync to Firestore (async, don't block localStorage operation)
      this.syncToFirestore('students', students)
      
      return true
    } catch (error) {
      console.error("Error saving students:", error)
      return false
    }
  }

  getTransferredStudents(): TransferredStudent[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEYS.TRANSFERRED)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading transferred students:", error)
      return []
    }
  }

  saveTransferredStudents(students: TransferredStudent[]): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.TRANSFERRED, JSON.stringify(students))
      
      // Sync to Firestore (async, don't block localStorage operation)
      this.syncToFirestore('transferredStudents', students)
      
      return true
    } catch (error) {
      console.error("Error saving transferred students:", error)
      return false
    }
  }

  getPendingPromotedStudents(): PendingPromotedStudent[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEYS.PENDING_PROMOTED)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading pending promoted students:", error)
      return []
    }
  }

  savePendingPromotedStudents(students: PendingPromotedStudent[]): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.PENDING_PROMOTED, JSON.stringify(students))
      
      // Sync to Firestore (async, don't block localStorage operation)
      this.syncToFirestore('pendingPromoted', students)
      
      return true
    } catch (error) {
      console.error("Error saving pending promoted students:", error)
      return false
    }
  }

  /**
   * Settings helpers
   */
  getSettings(): AppSettings | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.SETTINGS)
      return raw ? (JSON.parse(raw) as AppSettings) : null
    } catch (error) {
      console.error("Error loading settings:", error)
      return null
    }
  }

  saveSettings(settings: AppSettings): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
      
      // Sync to Firestore (async, don't block localStorage operation)
      this.syncToFirestore('settings', settings)
      
      return true
    } catch (error) {
      console.error("Error saving settings:", error)
      return false
    }
  }

  /**
   * License helpers
   */
  getLicense(): LicenseData | null {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEYS.LICENSE)
      return raw ? (JSON.parse(raw) as LicenseData) : null
    } catch (error) {
      console.error("Error loading license:", error)
      return null
    }
  }

  saveLicense(license: LicenseData): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.LICENSE, JSON.stringify(license))
      return true
    } catch (error) {
      console.error("Error saving license:", error)
      return false
    }
  }

  clearAllData(): boolean {
    try {
      Object.values(this.STORAGE_KEYS).forEach((key) => {
        localStorage.removeItem(key)
      })
      return true
    } catch (error) {
      console.error("Error clearing data:", error)
      return false
    }
  }

  exportData(): string {
    try {
      const data = {
        students: this.getStudents(),
        transferredStudents: this.getTransferredStudents(),
        pendingPromotedStudents: this.getPendingPromotedStudents(),
        expenses: this.getExpenses(),
        extraBilling: this.getExtraBilling(),
        outstandingStudents: this.getOutstandingStudents(),
        settings: localStorage.getItem(this.STORAGE_KEYS.SETTINGS),
        exportDate: new Date().toISOString(),
      }
      return JSON.stringify(data, null, 2)
    } catch (error) {
      console.error("Error exporting data:", error)
      throw new Error("Failed to export data")
    }
  }

  // Expense methods
  getExpenses(): any[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEYS.EXPENSES)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading expenses:", error)
      return []
    }
  }

  saveExpenses(expenses: any[]): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.EXPENSES, JSON.stringify(expenses))
      this.syncToFirestore('expenses', expenses)
      return true
    } catch (error) {
      console.error("Error saving expenses:", error)
      return false
    }
  }

  // Extra Billing methods
  getExtraBilling(): any[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEYS.EXTRA_BILLING)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading extra billing:", error)
      return []
    }
  }

  saveExtraBilling(extraBilling: any[]): boolean {
    try {
      localStorage.setItem(this.STORAGE_KEYS.EXTRA_BILLING, JSON.stringify(extraBilling))
      this.syncToFirestore('extraBilling', extraBilling)
      return true
    } catch (error) {
      console.error("Error saving extra billing:", error)
      return false
    }
  }

  // Outstanding Students methods
  getOutstandingStudents(): any[] {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEYS.OUTSTANDING)
      return saved ? JSON.parse(saved) : []
    } catch (error) {
      console.error("Error loading outstanding students:", error)
      return []
    }
  }

  saveOutstandingStudents(students: any[]): boolean {
    try {
      console.log(`💾 Saving ${students.length} outstanding students to localStorage`)
      localStorage.setItem(this.STORAGE_KEYS.OUTSTANDING, JSON.stringify(students))
      
      // Enhanced logging for outstanding students sync
      if (students.length === 0) {
        console.log(`🧹 Clearing outstanding students from Firebase (no outstanding amounts)`)
      } else {
        console.log(`📊 Outstanding students data:`, students.map(s => ({ 
          name: s.fullName, 
          amount: s.outstandingAmount 
        })))
      }
      
      this.syncToFirestore('outstandingStudents', students)
      return true
    } catch (error) {
      console.error("Error saving outstanding students:", error)
      return false
    }
  }

  importData(jsonData: string): boolean {
    try {
      const data = JSON.parse(jsonData)

      if (data.students) this.saveStudents(data.students)
      if (data.transferredStudents) this.saveTransferredStudents(data.transferredStudents)
      if (data.pendingPromotedStudents) this.savePendingPromotedStudents(data.pendingPromotedStudents)
      if (data.expenses) this.saveExpenses(data.expenses)
      if (data.extraBilling) this.saveExtraBilling(data.extraBilling)
      if (data.outstandingStudents) this.saveOutstandingStudents(data.outstandingStudents)
      if (data.settings) localStorage.setItem(this.STORAGE_KEYS.SETTINGS, data.settings)

      return true
    } catch (error) {
      console.error("Error importing data:", error)
      return false
    }
  }
}
