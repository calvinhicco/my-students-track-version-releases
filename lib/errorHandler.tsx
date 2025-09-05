"use client"

import React from "react"

/**
 * Comprehensive error handling and logging system
 */

export interface ErrorContext {
  component?: string
  action?: string
  userId?: string
  timestamp: Date
  userAgent?: string
  url?: string
}

export interface AppError extends Error {
  code?: string
  context?: ErrorContext
  severity?: "low" | "medium" | "high" | "critical"
}

export interface ErrorLog {
  id: string
  timestamp: string
  level: "error" | "warning" | "info"
  message: string
  context?: Record<string, any>
  sessionId: string
}

class ErrorHandler {
  private static instance: ErrorHandler
  private errors: AppError[] = []
  private maxErrors = 100
  private logs: ErrorLog[] = []
  private maxLogs = 1000
  private sessionId: string

  constructor() {
    this.sessionId = this.generateSessionId()
    this.setupGlobalErrorHandlers()
  }

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler()
    }
    return ErrorHandler.instance
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private setupGlobalErrorHandlers() {
    if (typeof window !== "undefined") {
      // Handle unhandled promise rejections
      window.addEventListener("unhandledrejection", (event) => {
        const error = this.createError(
          `Unhandled Promise Rejection: ${event.reason}`,
          "UNHANDLED_PROMISE_REJECTION",
          "high",
        )
        error.context = {
          timestamp: new Date(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }
        this.logError(error)
      })

      // Handle global errors
      window.addEventListener("error", (event) => {
        const error = this.createError(event.message, "UNHANDLED_ERROR", "high")
        error.context = {
          timestamp: new Date(),
          url: window.location.href,
          userAgent: navigator.userAgent,
        }
        this.logError(error)
      })
    }
  }

  logError(error: AppError): void {
    // Add timestamp if not present
    if (!error.context) {
      error.context = { timestamp: new Date() }
    } else if (!error.context.timestamp) {
      error.context.timestamp = new Date()
    }

    // Add to errors array
    this.errors.unshift(error)

    // Keep only the most recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors)
    }

    // Log to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("App Error:", {
        message: error.message,
        code: error.code,
        severity: error.severity,
        context: error.context,
        stack: error.stack,
      })
    }

    // Store in localStorage for persistence
    try {
      localStorage.setItem("app_errors", JSON.stringify(this.errors.slice(0, 10)))
    } catch (e) {
      console.warn("Could not store errors in localStorage:", e)
    }
  }

  getErrors(): AppError[] {
    return [...this.errors]
  }

  clearErrors(): void {
    this.errors = []
    try {
      localStorage.removeItem("app_errors")
    } catch (e) {
      console.warn("Could not clear errors from localStorage:", e)
    }
  }

  createError(message: string, code?: string, severity: AppError["severity"] = "medium"): AppError {
    const error = new Error(message) as AppError
    error.code = code
    error.severity = severity
    return error
  }

  logWarning(message: string, context?: Record<string, any>): string {
    const warningLog: ErrorLog = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      level: "warning",
      message,
      context,
      sessionId: this.sessionId,
    }

    this.addLog(warningLog)

    if (process.env.NODE_ENV === "development") {
      console.warn("Warning logged:", warningLog)
    }

    return warningLog.id
  }

  logInfo(message: string, context?: Record<string, any>): string {
    const infoLog: ErrorLog = {
      id: this.generateErrorId(),
      timestamp: new Date().toISOString(),
      level: "info",
      message,
      context,
      sessionId: this.sessionId,
    }

    this.addLog(infoLog)

    if (process.env.NODE_ENV === "development") {
      console.info("Info logged:", infoLog)
    }

    return infoLog.id
  }

  private addLog(log: ErrorLog) {
    this.logs.unshift(log)

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(0, this.maxLogs)
    }

    // Save to localStorage for persistence
    this.saveLogsToStorage()
  }

  private saveLogsToStorage() {
    try {
      if (typeof window !== "undefined") {
        const recentLogs = this.logs.slice(0, 100) // Save only recent 100 logs
        localStorage.setItem("app_error_logs", JSON.stringify(recentLogs))
      }
    } catch (error) {
      console.warn("Failed to save error logs to storage:", error)
    }
  }

  private loadLogsFromStorage() {
    try {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("app_error_logs")
        if (stored) {
          const logs = JSON.parse(stored) as ErrorLog[]
          this.logs = [...logs, ...this.logs]
        }
      }
    } catch (error) {
      console.warn("Failed to load error logs from storage:", error)
    }
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  getLogs(level?: "error" | "warning" | "info"): ErrorLog[] {
    if (level) {
      return this.logs.filter((log) => log.level === level)
    }
    return [...this.logs]
  }

  getErrorStats(): {
    total: number
    errors: number
    warnings: number
    info: number
    recentErrors: number
  } {
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)

    return {
      total: this.logs.length,
      errors: this.logs.filter((log) => log.level === "error").length,
      warnings: this.logs.filter((log) => log.level === "warning").length,
      info: this.logs.filter((log) => log.level === "info").length,
      recentErrors: this.logs.filter((log) => log.level === "error" && new Date(log.timestamp) > oneHourAgo).length,
    }
  }

  clearLogs() {
    this.logs = []
    if (typeof window !== "undefined") {
      localStorage.removeItem("app_error_logs")
    }
  }

  exportLogs(): string {
    return JSON.stringify(this.logs, null, 2)
  }

  // Specific error handling methods
  handleStudentDataError(error: Error, studentId?: string) {
    return this.logError(error, {
      component: "StudentData",
      studentId,
      action: "data_operation",
    })
  }

  handleCalculationError(error: Error, calculationType: string, studentId?: string) {
    return this.logError(error, {
      component: "Calculations",
      calculationType,
      studentId,
      action: "calculation",
    })
  }

  handleExportError(error: Error, exportType: string, recordCount?: number) {
    return this.logError(error, {
      component: "Export",
      exportType,
      recordCount,
      action: "export",
    })
  }

  handleValidationError(error: Error, validationType: string, data?: any) {
    return this.logWarning(`Validation failed: ${error.message}`, {
      component: "Validation",
      validationType,
      data: data ? JSON.stringify(data).substring(0, 500) : undefined,
      action: "validation",
    })
  }
}

export const errorHandler = ErrorHandler.getInstance()

// Global error handler for unhandled errors
if (typeof window !== "undefined") {
  window.addEventListener("error", (event) => {
    const error = errorHandler.createError(event.message, "UNHANDLED_ERROR", "high")
    error.context = {
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }
    errorHandler.logError(error)
  })

  window.addEventListener("unhandledrejection", (event) => {
    const error = errorHandler.createError(
      `Unhandled Promise Rejection: ${event.reason}`,
      "UNHANDLED_PROMISE_REJECTION",
      "high",
    )
    error.context = {
      timestamp: new Date(),
      url: window.location.href,
      userAgent: navigator.userAgent,
    }
    errorHandler.logError(error)
  })
}

// Error boundary helper
export function withErrorHandling<T extends (...args: any[]) => any>(fn: T, context?: Record<string, any>): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args)

      // Handle async functions
      if (result instanceof Promise) {
        return result.catch((error) => {
          errorHandler.logError(error, { ...context, args })
          throw error
        })
      }

      return result
    } catch (error) {
      errorHandler.logError(error as Error, { ...context, args })
      throw error
    }
  }) as T
}

// React error boundary component
export function createErrorBoundary(fallbackComponent?: React.ComponentType<{ error: Error }>) {
  return class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    { hasError: boolean; error?: Error }
  > {
    constructor(props: { children: React.ReactNode }) {
      super(props)
      this.state = { hasError: false }
    }

    static getDerivedStateFromError(error: Error) {
      return { hasError: true, error }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
      errorHandler.logError(error, {
        component: "ErrorBoundary",
        errorInfo,
        action: "component_error",
      })
    }

    render() {
      if (this.state.hasError) {
        if (fallbackComponent) {
          const FallbackComponent = fallbackComponent
          return <FallbackComponent error={this.state.error!} />
        }

        return (
          <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold">!</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">Something went wrong</h2>
              </div>
              <p className="text-gray-600 mb-4">An unexpected error occurred. Please refresh the page and try again.</p>
              <div className="flex gap-2">
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => this.setState({ hasError: false })}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        )
      }

      return this.props.children
    }
  }
}
