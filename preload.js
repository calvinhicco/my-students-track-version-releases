const { contextBridge, ipcRenderer } = require("electron")

// Enhanced API exposure with comprehensive school management features
contextBridge.exposeInMainWorld("electronAPI", {
  // PDF operations
  savePDF: (fileName, buffer) => ipcRenderer.invoke("save-pdf", fileName, buffer),

  // Enhanced export functions
  exportStudentReport: (studentData, reportType) =>
    ipcRenderer.invoke("export-student-report", studentData, reportType),
  exportClassReport: (classData, billingCycle) => ipcRenderer.invoke("export-class-report", classData, billingCycle),

  // Enhanced message dialogs
  showMessage: (options) => ipcRenderer.invoke("show-message", options),
  showConfirmation: (options) => ipcRenderer.invoke("show-confirmation", options),

  // Menu events - comprehensive school management
  onMenuNewStudent: (callback) => ipcRenderer.on("menu-new-student", callback),
  onMenuExportPDF: (callback) => ipcRenderer.on("menu-export-pdf", callback),
  onMenuSettings: (callback) => ipcRenderer.on("menu-settings", callback),
  onMenuPromoteStudents: (callback) => ipcRenderer.on("menu-promote-students", callback),
  onMenuBackupData: (callback) => ipcRenderer.on("menu-backup-data", callback),
  onMenuRestoreData: (callback) => ipcRenderer.on("menu-restore-data", callback),
  onMenuOutstandingPayments: (callback) => ipcRenderer.on("menu-outstanding-payments", callback),
  onMenuTransferredStudents: (callback) => ipcRenderer.on("menu-transferred-students", callback),
  onMenuBillingConfig: (callback) => ipcRenderer.on("menu-billing-config", callback),
  onMenuTransportSettings: (callback) => ipcRenderer.on("menu-transport-settings", callback),
  onMenuExportOutstanding: (callback) => ipcRenderer.on("menu-export-outstanding", callback),
  onMenuExportClass: (callback) => ipcRenderer.on("menu-export-class", callback),

  // Remove listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),

  // Data management
  saveDataBackup: (data, fileName, isRoot) => ipcRenderer.invoke("save-data-backup", data, fileName, isRoot),
  loadDataBackup: () => ipcRenderer.invoke("load-data-backup"),

  // Storage devices
  getRemovableDrives: () => ipcRenderer.invoke("get-removable-drives"),

  // System information
  getSystemInfo: () => ipcRenderer.invoke("get-system-info"),

  // Application preferences
  setPreference: (key, value) => ipcRenderer.invoke("set-preference", key, value),
  getPreference: (key) => ipcRenderer.invoke("get-preference", key),

  // --- License encryption/decryption (exposed to renderer) ---
  encryptLicense: (text) => ipcRenderer.invoke("encrypt-license", text),
  decryptLicense: (encryptedText) => ipcRenderer.invoke("decrypt-license", encryptedText),

  // Print to PDF
  printToPDF: (options) => ipcRenderer.invoke("print-to-pdf", options),

  // Twilio Messaging
  sendTwilioMessage: (data) => ipcRenderer.invoke("send-twilio-message", data),

  // Firebase sync
  syncToFirestore: (collection, data) => ipcRenderer.invoke("sync-to-firestore", collection, data),

  // Utility functions (renderer-side, no IPC needed)
  utils: {
    formatCurrency: (amount) => {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
      }).format(amount)
    },

    formatDate: (dateString) => {
      return new Date(dateString).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    },

    generateReportId: () => {
      return `RPT_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    },

    validateEmail: (email) => {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      return emailRegex.test(email)
    },

    sanitizeFileName: (fileName) => {
      return fileName.replace(/[^a-z0-9]/gi, "_").toLowerCase()
    },
  },

  // Development and debugging helpers
  dev: {
    log: (...args) => {
      if (process.env.NODE_ENV === "development") {
        console.log("[Renderer]", ...args)
      }
    },

    error: (...args) => {
      if (process.env.NODE_ENV === "development") {
        console.error("[Renderer Error]", ...args)
      }
    },
  },

  // Platform info
  isElectron: true,
})
