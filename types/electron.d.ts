// Enhanced Type definitions for Electron API with school management features
export interface ElectronAPI {
  // PDF operations with enhanced school reporting
  savePDF: (
    fileName: string,
    buffer: ArrayBuffer,
  ) => Promise<{
    success: boolean
    filePath?: string
    error?: string
  }>

  // Enhanced PDF export for different report types
  exportStudentReport: (
    studentData: any,
    reportType: "detailed" | "summary" | "outstanding",
  ) => Promise<{
    success: boolean
    filePath?: string
    error?: string
  }>

  // Bulk PDF export for class reports
  exportClassReport: (
    classData: any,
    billingCycle: "MONTHLY" | "TERMLY",
  ) => Promise<{
    success: boolean
    filePath?: string
    error?: string
  }>

  // Enhanced message dialogs with school-specific options
  showMessage: (options: {
    type?: "none" | "info" | "error" | "question" | "warning"
    buttons?: string[]
    defaultId?: number
    title?: string
    message: string
    detail?: string
    checkboxLabel?: string
    checkboxChecked?: boolean
  }) => Promise<{
    response: number
    checkboxChecked?: boolean
  }>

  // Confirmation dialogs for critical operations
  showConfirmation: (options: {
    title: string
    message: string
    detail?: string
    confirmLabel?: string
    cancelLabel?: string
  }) => Promise<boolean>

  // Menu events with enhanced school management actions
  onMenuNewStudent: (callback: () => void) => void
  onMenuExportPDF: (callback: () => void) => void
  onMenuSettings: (callback: () => void) => void
  onMenuPromoteStudents: (callback: () => void) => void
  onMenuBackupData: (callback: () => void) => void
  onMenuRestoreData: (callback: () => void) => void
  removeAllListeners: (channel: string) => void

  // File operations for data management
  saveDataBackup: (
    data: any,
    fileName?: string,
  ) => Promise<{
    success: boolean
    filePath?: string
    error?: string
  }>

  loadDataBackup: () => Promise<{
    success: boolean
    data?: any
    error?: string
  }>

  // System information and preferences
  getSystemInfo: () => Promise<{
    platform: string
    version: string
    totalMemory: number
    freeMemory: number
    userDataPath: string
  }>

  // Application preferences
  setPreference: (key: string, value: any) => Promise<void>
  getPreference: (key: string) => Promise<any>

  // Window management
  minimizeWindow: () => void
  maximizeWindow: () => void
  closeWindow: () => void
  setWindowTitle: (title: string) => void

  // Print functionality for reports
  printReport: (htmlContent: string) => Promise<{
    success: boolean
    error?: string
  }>

  // Twilio Messaging
  sendTwilioMessage: (data: {
    message: string;
    recipients: string[];
    type: string;
  }) => Promise<{ success: boolean; error?: string }>;

  // Platform info
  platform: string
  isElectron: boolean
  version: string

  // School-specific features
  features: {
    hasTransportModule: boolean
    hasAdvancedReporting: boolean
    hasAutomaticPromotions: boolean
    hasDataBackup: boolean
  }
}

// Enhanced global window interface
declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}

// Export additional types for school management
export interface StudentExportData {
  id: string
  fullName: string
  classGroup: string
  className: string
  totalPaid: number
  totalOwed: number
  hasTransport: boolean
  transportFee: number
}

export interface ClassReportData {
  classGroupId: string
  classGroupName: string
  students: StudentExportData[]
  totalExpected: number
  totalCollected: number
  outstandingAmount: number
  billingCycle: "MONTHLY" | "TERMLY"
}

export interface BackupData {
  version: string
  timestamp: string
  schoolName: string
  students: any[]
  transferredStudents: any[]
  settings: any
  metadata: {
    studentCount: number
    transferredCount: number
    academicYear: string
  }
}
