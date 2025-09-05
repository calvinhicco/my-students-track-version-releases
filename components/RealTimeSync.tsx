"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

import type { Student, AppSettings } from "../types/index"
import { validatePaymentCalculations } from "../lib/calculations"

import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Clock, Database, Wifi, WifiOff } from "lucide-react"

interface RealTimeSyncProps {
  students: Student[]
  settings: AppSettings
  onDataUpdate: (students: Student[]) => void
  onSettingsUpdate: (settings: AppSettings) => void
}

interface SyncStatus {
  status: "idle" | "syncing" | "error" | "success"
  lastSync: Date
  errors: string[]
  warnings: string[]
  dataIntegrityScore: number
}

export default function RealTimeSync({ students, settings, onDataUpdate, onSettingsUpdate }: RealTimeSyncProps) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    status: "idle",
    lastSync: new Date(),
    errors: [],
    warnings: [],
    dataIntegrityScore: 100,
  })

  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  const [syncInterval, setSyncInterval] = useState(30) // seconds
  const [isOnline, setIsOnline] = useState(true)
  const [syncProgress, setSyncProgress] = useState(0)

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
    }
  }, [])

  // Auto-sync effect
  useEffect(() => {
    if (!autoSyncEnabled || !isOnline) return

    const interval = setInterval(() => {
      performSync()
    }, syncInterval * 1000)

    return () => clearInterval(interval)
  }, [autoSyncEnabled, syncInterval, isOnline, students, settings])

  const performSync = async () => {
    setSyncStatus((prev) => ({ ...prev, status: "syncing" }))
    setSyncProgress(0)

    try {
      // Simulate sync progress
      const progressSteps = [
        { step: "Validating data integrity...", progress: 20 },
        { step: "Checking calculations...", progress: 40 },
        { step: "Updating local storage...", progress: 60 },
        { step: "Verifying sync...", progress: 80 },
        { step: "Complete", progress: 100 },
      ]

      for (const { step, progress } of progressSteps) {
        setSyncProgress(progress)
        await new Promise((resolve) => setTimeout(resolve, 200))
      }

      // Perform actual data validation
      const validationResults = validateAllStudents()
      const integrityScore = calculateDataIntegrityScore(validationResults)

      // Update local storage
      localStorage.setItem("studentTrackStudents", JSON.stringify(students))
      localStorage.setItem("studentTrackSettings", JSON.stringify(settings))

      setSyncStatus({
        status: validationResults.errors.length > 0 ? "error" : "success",
        lastSync: new Date(),
        errors: validationResults.errors,
        warnings: validationResults.warnings,
        dataIntegrityScore: integrityScore,
      })
    } catch (error) {
      setSyncStatus((prev) => ({
        ...prev,
        status: "error",
        errors: ["Sync failed: " + (error as Error).message],
      }))
    } finally {
      setSyncProgress(0)
    }
  }

  const validateAllStudents = () => {
    const errors: string[] = []
    const warnings: string[] = []

    students.forEach((student) => {
      const validation = validatePaymentCalculations(student)
      errors.push(...validation.errors.map((e) => `${student.fullName}: ${e}`))
      warnings.push(...validation.warnings.map((w) => `${student.fullName}: ${w}`))
    })

    // Additional validations
    const duplicateIds = findDuplicateIds()
    if (duplicateIds.length > 0) {
      errors.push(`Duplicate student IDs found: ${duplicateIds.join(", ")}`)
    }

    const orphanedStudents = findOrphanedStudents()
    if (orphanedStudents.length > 0) {
      warnings.push(`${orphanedStudents.length} students have invalid class groups`)
    }

    return { errors, warnings }
  }

  const findDuplicateIds = () => {
    const ids = students.map((s) => s.id)
    return ids.filter((id, index) => ids.indexOf(id) !== index)
  }

  const findOrphanedStudents = () => {
    const validClassGroupIds = settings.classGroups.map((g) => g.id)
    return students.filter((s) => !validClassGroupIds.includes(s.classGroup))
  }

  const calculateDataIntegrityScore = (validation: { errors: string[]; warnings: string[] }) => {
    const totalIssues = validation.errors.length + validation.warnings.length * 0.5
    const maxScore = 100
    const penaltyPerIssue = 5

    return Math.max(0, maxScore - totalIssues * penaltyPerIssue)
  }

  const manualSync = () => {
    performSync()
  }

  const fixDataIssues = () => {
    // Auto-fix common issues
    const fixedStudents = students.map((student) => {
      // Ensure fee payments array exists
      if (!Array.isArray(student.feePayments)) {
        return { ...student, feePayments: [] }
      }

      // Recalculate outstanding amounts
      const updatedPayments = student.feePayments.map((payment) => ({
        ...payment,
        outstandingAmount: Math.max(0, payment.amountDue - payment.amountPaid),
      }))

      return { ...student, feePayments: updatedPayments }
    })

    onDataUpdate(fixedStudents)
    performSync()
  }

  const getSyncStatusIcon = () => {
    switch (syncStatus.status) {
      case "syncing":
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
      case "success":
        return <CheckCircle className="w-4 h-4 text-green-600" />
      case "error":
        return <XCircle className="w-4 h-4 text-red-600" />
      default:
        return <Clock className="w-4 h-4 text-gray-600" />
    }
  }

  const getSyncStatusColor = () => {
    switch (syncStatus.status) {
      case "syncing":
        return "border-blue-200 bg-blue-50"
      case "success":
        return "border-green-200 bg-green-50"
      case "error":
        return "border-red-200 bg-red-50"
      default:
        return "border-gray-200 bg-gray-50"
    }
  }

  return (
    <Card className={`${getSyncStatusColor()} transition-colors`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Database className="w-4 h-4" />
            Real-time Sync
            {isOnline ? <Wifi className="w-3 h-3 text-green-600" /> : <WifiOff className="w-3 h-3 text-red-600" />}
          </CardTitle>
          <div className="flex items-center gap-2">
            {getSyncStatusIcon()}
            <Badge variant={syncStatus.status === "error" ? "destructive" : "secondary"}>{syncStatus.status}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Sync Progress */}
        {syncStatus.status === "syncing" && (
          <div className="space-y-2">
            <Progress value={syncProgress} className="h-2" />
            <p className="text-xs text-gray-600">Syncing data...</p>
          </div>
        )}

        {/* Data Integrity Score */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Data Integrity</span>
            <span
              className={`font-medium ${
                syncStatus.dataIntegrityScore >= 90
                  ? "text-green-600"
                  : syncStatus.dataIntegrityScore >= 70
                    ? "text-orange-600"
                    : "text-red-600"
              }`}
            >
              {syncStatus.dataIntegrityScore.toFixed(0)}%
            </span>
          </div>
          <Progress
            value={syncStatus.dataIntegrityScore}
            className={`h-2 ${
              syncStatus.dataIntegrityScore >= 90
                ? "[&>div]:bg-green-500"
                : syncStatus.dataIntegrityScore >= 70
                  ? "[&>div]:bg-orange-500"
                  : "[&>div]:bg-red-500"
            }`}
          />
        </div>

        {/* Last Sync Info */}
        <div className="text-xs text-gray-600">Last sync: {syncStatus.lastSync.toLocaleTimeString()}</div>

        {/* Errors and Warnings */}
        {syncStatus.errors.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-red-600">
              <XCircle className="w-3 h-3" />
              <span className="text-xs font-medium">{syncStatus.errors.length} Error(s)</span>
            </div>
            <div className="max-h-20 overflow-y-auto">
              {syncStatus.errors.slice(0, 3).map((error, index) => (
                <p key={index} className="text-xs text-red-600 truncate">
                  • {error}
                </p>
              ))}
              {syncStatus.errors.length > 3 && (
                <p className="text-xs text-red-500">...and {syncStatus.errors.length - 3} more</p>
              )}
            </div>
          </div>
        )}

        {syncStatus.warnings.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="w-3 h-3" />
              <span className="text-xs font-medium">{syncStatus.warnings.length} Warning(s)</span>
            </div>
            <div className="max-h-16 overflow-y-auto">
              {syncStatus.warnings.slice(0, 2).map((warning, index) => (
                <p key={index} className="text-xs text-orange-600 truncate">
                  • {warning}
                </p>
              ))}
              {syncStatus.warnings.length > 2 && (
                <p className="text-xs text-orange-500">...and {syncStatus.warnings.length - 2} more</p>
              )}
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-2 pt-2 border-t border-gray-200">
          <Button
            onClick={manualSync}
            size="sm"
            variant="outline"
            disabled={syncStatus.status === "syncing" || !isOnline}
            className="flex-1"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Sync Now
          </Button>

          {(syncStatus.errors.length > 0 || syncStatus.warnings.length > 0) && (
            <Button
              onClick={fixDataIssues}
              size="sm"
              variant="outline"
              className="text-orange-600 border-orange-600 hover:bg-orange-50"
            >
              Auto-fix
            </Button>
          )}
        </div>

        {/* Auto-sync toggle */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-200">
          <span className="text-xs text-gray-600">Auto-sync</span>
          <button
            onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
              autoSyncEnabled ? "bg-purple-600" : "bg-gray-300"
            }`}
          >
            <span
              className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                autoSyncEnabled ? "translate-x-3.5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
