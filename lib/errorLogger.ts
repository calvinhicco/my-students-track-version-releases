/**
 * Comprehensive error logging system for debugging transport and other issues
 */

interface LogEntry {
  timestamp: string
  level: "ERROR" | "WARN" | "INFO" | "DEBUG"
  category: string
  message: string
  data?: any
  stackTrace?: string
  userAgent?: string
  url?: string
}

class ErrorLogger {
  private logs: LogEntry[] = []
  private maxLogs = 1000 // Keep last 1000 logs in memory

  private formatTimestamp(): string {
    const now = new Date()
    return now.toISOString().replace("T", " ").substring(0, 19)
  }

  private createLogEntry(
    level: LogEntry["level"],
    category: string,
    message: string,
    data?: any,
    error?: Error,
  ): LogEntry {
    return {
      timestamp: this.formatTimestamp(),
      level,
      category,
      message,
      data: data ? JSON.stringify(data, null, 2) : undefined,
      stackTrace: error?.stack,
      userAgent: typeof window !== "undefined" ? window.navigator.userAgent : "Server",
      url: typeof window !== "undefined" ? window.location.href : "N/A",
    }
  }

  private addLog(entry: LogEntry) {
    this.logs.push(entry)

    // Keep only the last maxLogs entries
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }

    // Also log to console for immediate debugging
    const consoleMessage = `[${entry.level}] ${entry.category}: ${entry.message}`
    switch (entry.level) {
      case "ERROR":
        console.error(consoleMessage, entry.data ? JSON.parse(entry.data) : "")
        break
      case "WARN":
        console.warn(consoleMessage, entry.data ? JSON.parse(entry.data) : "")
        break
      case "INFO":
        console.info(consoleMessage, entry.data ? JSON.parse(entry.data) : "")
        break
      case "DEBUG":
        console.debug(consoleMessage, entry.data ? JSON.parse(entry.data) : "")
        break
    }
  }

  // Public logging methods
  error(category: string, message: string, data?: any, error?: Error) {
    this.addLog(this.createLogEntry("ERROR", category, message, data, error))
  }

  warn(category: string, message: string, data?: any) {
    this.addLog(this.createLogEntry("WARN", category, message, data))
  }

  info(category: string, message: string, data?: any) {
    this.addLog(this.createLogEntry("INFO", category, message, data))
  }

  debug(category: string, message: string, data?: any) {
    this.addLog(this.createLogEntry("DEBUG", category, message, data))
  }

  // Transport-specific logging methods
  transportError(message: string, studentData?: any, error?: Error) {
    this.error("TRANSPORT", message, studentData, error)
  }

  transportInfo(message: string, studentData?: any) {
    this.info("TRANSPORT", message, studentData)
  }

  transportDebug(message: string, studentData?: any) {
    this.debug("TRANSPORT", message, studentData)
  }

  // UI-specific logging methods
  uiError(message: string, componentData?: any, error?: Error) {
    this.error("UI", message, componentData, error)
  }

  uiWarn(message: string, componentData?: any) {
    this.warn("UI", message, componentData)
  }

  // State management logging
  stateError(message: string, stateData?: any, error?: Error) {
    this.error("STATE", message, stateData, error)
  }

  stateInfo(message: string, stateData?: any) {
    this.info("STATE", message, stateData)
  }

  // Get logs for export
  getLogs(category?: string, level?: LogEntry["level"]): LogEntry[] {
    let filteredLogs = this.logs

    if (category) {
      filteredLogs = filteredLogs.filter((log) => log.category === category)
    }

    if (level) {
      filteredLogs = filteredLogs.filter((log) => log.level === level)
    }

    return filteredLogs
  }

  // Export logs as text file
  exportLogsAsText(filename?: string): void {
    const timestamp = new Date().toISOString().split("T")[0]
    const defaultFilename = `app-logs-${timestamp}.txt`
    const finalFilename = filename || defaultFilename

    const logText = this.logs
      .map((log) => {
        let entry = `[${log.timestamp}] [${log.level}] ${log.category}: ${log.message}`

        if (log.data) {
          entry += `\nData: ${log.data}`
        }

        if (log.stackTrace) {
          entry += `\nStack Trace: ${log.stackTrace}`
        }

        entry += `\nUser Agent: ${log.userAgent}`
        entry += `\nURL: ${log.url}`
        entry += "\n" + "=".repeat(80) + "\n"

        return entry
      })
      .join("\n")

    // Create and download the file
    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = finalFilename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    this.info("LOGGER", `Logs exported to ${finalFilename}`, { logCount: this.logs.length })
  }

  // Export specific category logs
  exportTransportLogs(): void {
    const transportLogs = this.getLogs("TRANSPORT")
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `transport-logs-${timestamp}.txt`

    const logText = transportLogs
      .map((log) => {
        let entry = `[${log.timestamp}] [${log.level}] ${log.message}`

        if (log.data) {
          entry += `\nData: ${log.data}`
        }

        if (log.stackTrace) {
          entry += `\nStack Trace: ${log.stackTrace}`
        }

        entry += "\n" + "-".repeat(60) + "\n"

        return entry
      })
      .join("\n")

    const blob = new Blob([logText], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    this.info("LOGGER", `Transport logs exported to ${filename}`, { logCount: transportLogs.length })
  }

  // Clear logs
  clearLogs(): void {
    const logCount = this.logs.length
    this.logs = []
    this.info("LOGGER", `Cleared ${logCount} log entries`)
  }

  // Get summary of logs
  getLogSummary(): { total: number; byLevel: Record<string, number>; byCategory: Record<string, number> } {
    const summary = {
      total: this.logs.length,
      byLevel: {} as Record<string, number>,
      byCategory: {} as Record<string, number>,
    }

    this.logs.forEach((log) => {
      summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1
      summary.byCategory[log.category] = (summary.byCategory[log.category] || 0) + 1
    })

    return summary
  }
}

// Create singleton instance
export const logger = new ErrorLogger()

// Helper function for performance monitoring
export function measurePerformance<T>(category: string, operation: string, fn: () => T): T {
  const start = performance.now()

  try {
    const result = fn()
    const duration = performance.now() - start

    logger.info(category, `${operation} completed`, {
      duration: `${duration.toFixed(2)}ms`,
      success: true,
    })

    return result
  } catch (error) {
    const duration = performance.now() - start

    logger.error(
      category,
      `${operation} failed`,
      {
        duration: `${duration.toFixed(2)}ms`,
        success: false,
      },
      error as Error,
    )

    throw error
  }
}

// Helper function for async performance monitoring
export async function measureAsyncPerformance<T>(
  category: string,
  operation: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = performance.now()

  try {
    const result = await fn()
    const duration = performance.now() - start

    logger.info(category, `${operation} completed`, {
      duration: `${duration.toFixed(2)}ms`,
      success: true,
    })

    return result
  } catch (error) {
    const duration = performance.now() - start

    logger.error(
      category,
      `${operation} failed`,
      {
        duration: `${duration.toFixed(2)}ms`,
        success: false,
      },
      error as Error,
    )

    throw error
  }
}

// Export types for use in other files
export type { LogEntry }
