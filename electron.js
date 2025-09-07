console.log("Electron main process started")
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require("electron")
const path = require("path")
const crypto = require("crypto")
const fs = require("fs")
const twilio = require("twilio")

// Load environment variables from .env.local
require('dotenv').config({ path: path.join(__dirname, '.env.local') })

const isDev = process.env.NODE_ENV === "development" || process.argv.includes("--dev")

let mainWindow
let splashWindow

const APP_CONFIG = {
  name: "My Students Track",
  version: "2.0.0",
  publisher: "Calch Media",
  minWidth: 1200,
  minHeight: 800,
  defaultWidth: 1400,
  defaultHeight: 900,
}

const SECRET_KEY = "MyStudentTrack2024SecretKey!@#$%^&*()1234567890ABCDEF"
const ALGORITHM = "aes-256-cbc"

function getKey() {
  return crypto.createHash("sha256").update(SECRET_KEY).digest()
}

function decryptLicense(encryptedLicense) {
  try {
    const decoded = Buffer.from(encryptedLicense, "base64").toString("utf8")
    const [ivHex, encryptedData] = decoded.split(":")
    if (!ivHex || !encryptedData) throw new Error("Invalid license format")

    const key = getKey()
    const iv = Buffer.from(ivHex, "hex")
    if (iv.length !== 16) throw new Error("IV must be 16 bytes")

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    let decrypted = decipher.update(encryptedData, "hex", "utf8")
    decrypted += decipher.final("utf8")

    const licenseData = JSON.parse(decrypted)
    if (!licenseData.schoolName || !licenseData.expiresOn || !licenseData.licenseType) {
      throw new Error("Invalid license structure")
    }

    return licenseData
  } catch (error) {
    console.error("Decryption error:", error)
    throw new Error("Invalid or corrupted license")
  }
}

function encryptLicense(licenseData) {
  try {
    const key = getKey()
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

    let encrypted = cipher.update(JSON.stringify(licenseData), "utf8", "hex")
    encrypted += cipher.final("hex")

    const result = iv.toString("hex") + ":" + encrypted
    return Buffer.from(result, "utf8").toString("base64")
  } catch (error) {
    console.error("Encryption error:", error)
    throw new Error("Failed to encrypt license")
  }
}

function createWindow() {
  // Splash first
  splashWindow = new BrowserWindow({
    width: 500,
    height: 350,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    show: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true
    }
  })
  splashWindow.loadFile(path.join(__dirname, "splash.html"))
  splashWindow.setAlwaysOnTop(true, 'screen-saver')

  // Main window

  console.log("Creating BrowserWindow...")

  // Check if preload file exists
  const preloadPath = path.join(__dirname, "preload.js")
  if (!fs.existsSync(preloadPath)) {
    console.error("Preload file not found at:", preloadPath)
    dialog.showErrorBox("Missing File", "preload.js file is missing. Please ensure all files are present.")
    app.quit()
    return
  }

  mainWindow = new BrowserWindow({
    width: APP_CONFIG.defaultWidth,
    height: APP_CONFIG.defaultHeight,
    minWidth: APP_CONFIG.minWidth,
    minHeight: APP_CONFIG.minHeight,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      preload: preloadPath,
    },
    show: false,
    title: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
    icon: path.join(__dirname, "public", "logo.ico"),
  })

  if (isDev) {
    const appURL = "https://my-students-track-version-releases-ltio7x6e4.vercel.app"
    console.log(`Loading from: ${appURL}`)
    mainWindow.loadURL(appURL)
    .then(() => {
      // When main window is ready, close splash after a small delay
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close()
          splashWindow = null
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
        }
      }, 1000) // 1 second delay to ensure smooth transition
    })
    mainWindow.once("close", () => {
      if (splashWindow) splashWindow.close()
    }).catch((err) => {
      console.error("Failed to load dev URL:", err)
      dialog.showErrorBox(
        "Development Server Error",
        "Could not connect to development server. Make sure 'npm run dev' is running.",
      )
    })
    mainWindow.webContents.openDevTools()
  } else {
    const filePath = path.join(__dirname, "out", "index.html")
    console.log(`Loading file: ${filePath}`)

    // Check if build output exists
    if (!fs.existsSync(filePath)) {
      console.error("Build output not found at:", filePath)
      dialog.showErrorBox("Build Error", "Build output not found. Please run 'npm run build' first.")
      app.quit()
      return
    }

    mainWindow.loadFile(filePath)
    .then(() => {
      // When main window is ready, close splash after a small delay
      setTimeout(() => {
        if (splashWindow && !splashWindow.isDestroyed()) {
          splashWindow.close()
          splashWindow = null
        }
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show()
        }
      }, 1000) // 1 second delay to ensure smooth transition
    })
    .catch((err) => {
      console.error("Failed to load file:", err)
      dialog.showErrorBox("Load Error", "Failed to load the application. Please check the build output.")
    })
  }

  mainWindow.once("ready-to-show", () => {
    mainWindow.show()
    console.log(`${APP_CONFIG.name} is ready!`)
  })

  mainWindow.on("closed", () => {
    mainWindow = null
  })

  mainWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription, validatedURL) => {
    console.error("Failed to load:", validatedURL, "Error:", errorCode, errorDescription)
    dialog.showErrorBox("Load Failed", `Failed to load: ${validatedURL}\nError: ${errorDescription}`)
  })

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  createMenu()
}

function createMenu() {
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "About",
          click: () => {
            dialog.showMessageBox({
              type: "info",
              title: `About ${APP_CONFIG.name}`,
              message: `${APP_CONFIG.name} v${APP_CONFIG.version}`,
              detail: `Professional School Management System\n\nDeveloped by ${APP_CONFIG.publisher}`,
            })
          },
        },
      ],
    },
  ]
  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ===== IPC HANDLERS =====

// License handlers
ipcMain.handle("decrypt-license", async (event, encryptedText) => {
  try {
    return { success: true, decryptedText: decryptLicense(encryptedText) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

ipcMain.handle("encrypt-license", async (event, licenseData) => {
  try {
    return { success: true, encryptedText: encryptLicense(licenseData) }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// PDF operations - FIXED VERSION
ipcMain.handle("save-pdf", async (event, fileName, pdfData) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: fileName,
      filters: [{ name: "PDF Files", extensions: ["pdf"] }],
    })

    if (!result.canceled && result.filePath) {
      // Convert ArrayBuffer to Buffer if needed
      let buffer
      if (pdfData instanceof ArrayBuffer) {
        buffer = Buffer.from(pdfData)
      } else if (Buffer.isBuffer(pdfData)) {
        buffer = pdfData
      } else if (typeof pdfData === "string") {
        buffer = Buffer.from(pdfData, "binary")
      } else {
        // Handle Uint8Array or other typed arrays
        buffer = Buffer.from(pdfData)
      }

      fs.writeFileSync(result.filePath, buffer)
      return { success: true, filePath: result.filePath }
    }
    return { success: false, error: "Save cancelled" }
  } catch (error) {
    console.error("Save PDF error:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("print-to-pdf", async (event, options) => {
  try {
    const pdfData = await mainWindow.webContents.printToPDF(options || {})
    return { success: true, data: pdfData }
  } catch (error) {
    console.error("Print to PDF error:", error)
    return { success: false, error: error.message }
  }
})

// Export functions
ipcMain.handle("export-student-report", async (event, studentData, reportType) => {
  try {
    // Placeholder implementation - you can enhance this
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `student-report-${Date.now()}.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    })

    if (!result.canceled && result.filePath) {
      const reportData = {
        student: studentData,
        reportType: reportType,
        generatedAt: new Date().toISOString(),
      }
      fs.writeFileSync(result.filePath, JSON.stringify(reportData, null, 2))
      return { success: true, filePath: result.filePath }
    }
    return { success: false, error: "Export cancelled" }
  } catch (error) {
    console.error("Export student report error:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("export-class-report", async (event, classData, billingCycle) => {
  try {
    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: `class-report-${Date.now()}.json`,
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
    })

    if (!result.canceled && result.filePath) {
      const reportData = {
        class: classData,
        billingCycle: billingCycle,
        generatedAt: new Date().toISOString(),
      }
      fs.writeFileSync(result.filePath, JSON.stringify(reportData, null, 2))
      return { success: true, filePath: result.filePath }
    }
    return { success: false, error: "Export cancelled" }
  } catch (error) {
    console.error("Export class report error:", error)
    return { success: false, error: error.message }
  }
})

// Message dialogs
ipcMain.handle("show-message", async (event, options) => {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: options.type || "info",
      title: options.title || "Message",
      message: options.message || "",
      detail: options.detail || "",
      buttons: options.buttons || ["OK"],
    })
    return { success: true, response: result.response }
  } catch (error) {
    console.error("Show message error:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("show-confirmation", async (event, options) => {
  try {
    const result = await dialog.showMessageBox(mainWindow, {
      type: "question",
      title: options.title || "Confirmation",
      message: options.message || "Are you sure?",
      detail: options.detail || "",
      buttons: ["Cancel", "OK"],
      defaultId: 1,
      cancelId: 0,
    })
    return { success: true, confirmed: result.response === 1 }
  } catch (error) {
    console.error("Show confirmation error:", error)
    return { success: false, error: error.message }
  }
})

// Data management
ipcMain.handle("save-data-backup", async (event, data, fileName, isRoot) => {
  try {
    let savePath;
    if (isRoot) {
      savePath = path.join(app.getAppPath(), fileName);
    } else {
      const result = await dialog.showSaveDialog(mainWindow, {
        defaultPath: fileName,
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });
      if (result.canceled) {
        return { success: false, error: "Save cancelled" };
      }
      savePath = result.filePath;
    }

    if (savePath) {
      fs.writeFileSync(savePath, data);
      return { success: true, filePath: savePath };
    }
    return { success: false, error: "Save cancelled" };
  } catch (error) {
    console.error("Save data backup error:", error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle("load-data-backup", async (event) => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [
        { name: "JSON Files", extensions: ["json"] },
        { name: "All Files", extensions: ["*"] },
      ],
      properties: ["openFile"],
    })

    if (!result.canceled && result.filePaths.length > 0) {
      const data = fs.readFileSync(result.filePaths[0], "utf8")
      return { success: true, data: JSON.parse(data) }
    }
    return { success: false, error: "Load cancelled" }
  } catch (error) {
    console.error("Load data backup error:", error)
    return { success: false, error: error.message }
  }
})

// ===== Removable drives detection =====
ipcMain.handle("get-removable-drives", async () => {
  try {
    const drives = []
    if (process.platform === "win32") {
      // Use wmic to list removable drives
      const { execSync } = require("child_process")
      const output = execSync('wmic logicaldisk where drivetype=2 get deviceid', {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      })
      output
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && line.startsWith(""))
        .forEach((line) => {
          const match = line.match(/^([A-Z]:)/i)
          if (match) drives.push(match[1] + "\\")
        })
    } else if (process.platform === "darwin") {
      const { execSync } = require("child_process")
      const output = execSync("diskutil list -plist external | plutil -convert json -o - -", {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "ignore"],
      })
      const data = JSON.parse(output)
      if (data.AllDisksAndPartitions) {
        data.AllDisksAndPartitions.forEach((disk) => {
          if (disk.VolumeName && disk.MountPoint) drives.push(disk.MountPoint)
        })
      }
    } else if (process.platform === "linux") {
      const { execSync } = require("child_process")
      try {
        const output = execSync("lsblk -J -o NAME,MOUNTPOINT,RM", { encoding: "utf8" })
        const lsblk = JSON.parse(output)
        const walk = (nodes) => {
          nodes.forEach((n) => {
            if (n.rm === 1 && n.mountpoint) drives.push(n.mountpoint)
            if (n.children) walk(n.children)
          })
        }
        walk(lsblk.blockdevices || [])
      } catch {}
    }
    return { success: true, drives }
  } catch (error) {
    console.error("Detect removable drives error:", error)
    return { success: false, drives: [], error: error.message }
  }
})

// System information
ipcMain.handle("get-system-info", async (event) => {
  try {
    const os = require("os")
    const systemInfo = {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      osType: os.type(),
      osRelease: os.release(),
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
    }
    return { success: true, systemInfo }
  } catch (error) {
    console.error("Get system info error:", error)
    return { success: false, error: error.message }
  }
})

// Application preferences (simple file-based storage)
const preferencesPath = path.join(app.getPath("userData"), "preferences.json")

ipcMain.handle("set-preference", async (event, key, value) => {
  try {
    let preferences = {}
    if (fs.existsSync(preferencesPath)) {
      preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"))
    }
    preferences[key] = value
    fs.writeFileSync(preferencesPath, JSON.stringify(preferences, null, 2))
    return { success: true }
  } catch (error) {
    console.error("Set preference error:", error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle("get-preference", async (event, key) => {
  try {
    if (fs.existsSync(preferencesPath)) {
      const preferences = JSON.parse(fs.readFileSync(preferencesPath, "utf8"))
      return { success: true, value: preferences[key] }
    }
    return { success: true, value: undefined }
  } catch (error) {
    console.error("Get preference error:", error)
    return { success: false, error: error.message }
  }
})

// Firebase sync handler
ipcMain.handle("sync-to-firestore", async (event, collection, data) => {
  try {
    // Import Firebase Admin SDK here to avoid Next.js build issues
    const { firebaseSync } = require('./lib/firebaseSync.js')
    
    switch (collection) {
      case 'students':
        await firebaseSync.syncStudents(data)
        break
      case 'transferredStudents':
        await firebaseSync.syncTransferredStudents(data)
        break
      case 'pendingPromoted':
        await firebaseSync.syncPendingPromoted(data)
        break
      case 'settings':
        await firebaseSync.syncSettings(data)
        break
      case 'expenses':
        await firebaseSync.syncExpenses(data)
        break
      case 'extraBilling':
        await firebaseSync.syncExtraBilling(data)
        break
      case 'outstandingStudents':
        await firebaseSync.syncOutstandingStudents(data)
        break
      default:
        console.warn(`Unknown collection: ${collection}`)
    }
    
    console.log(`Successfully synced ${collection} to Firestore`)
    return { success: true }
  } catch (error) {
    console.error(`Failed to sync ${collection} to Firestore:`, error)
    return { success: false, error: error.message }
  }
})

// Twilio Messaging
ipcMain.handle("send-twilio-message", async (event, { message, recipients, type }) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = type === 'whatsapp' 
    ? process.env.TWILIO_WHATSAPP_NUMBER 
    : process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Twilio credentials are not configured in .env.local");
    return { success: false, error: 'Twilio credentials are not configured.' };
  }

  const client = twilio(accountSid, authToken);

  try {
    const messagePromises = recipients.map((to) => {
      const fullToNumber = type === 'whatsapp' ? `whatsapp:${to}` : to;
      return client.messages.create({
        body: message,
        from: fromNumber,
        to: fullToNumber,
      });
    });

    await Promise.all(messagePromises);
    console.log("Messages sent successfully via Twilio");
    return { success: true, message: 'Messages sent successfully!' };
  } catch (error) {
    console.error('Error sending messages via Twilio:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return { success: false, error: `Failed to send messages: ${errorMessage}` };
  }
});

// ===== APP LIFECYCLE =====

app
  .whenReady()
  .then(() => {
    console.log("App is ready, creating window...")
    createWindow()

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
      }
    })
  })
  .catch((error) => {
    console.error("Error during app ready:", error)
    dialog.showErrorBox("Startup Error", "Failed to start the application: " + error.message)
  })

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})

app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const allowedOrigins = isDev ? ["http://localhost:3000"] : ["file://"]
    const isAllowed = allowedOrigins.some((origin) => navigationUrl.startsWith(origin))

    if (!isAllowed) {
      event.preventDefault()
      shell.openExternal(navigationUrl)
    }
  })
})

// Enhanced error handling
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error)
  dialog.showErrorBox(
    "Application Error",
    `An unexpected error occurred: ${error.message}\n\nThe application will now close.`,
  )
  app.quit()
})

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason)
  dialog.showErrorBox("Application Error", `An unexpected error occurred: ${reason}\n\nThe application will now close.`)
})

console.log("Electron main script loaded successfully")
