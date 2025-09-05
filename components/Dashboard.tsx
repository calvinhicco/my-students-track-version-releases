"use client"
import ConfirmDialog from "@/components/ConfirmDialog"
import { useState, useEffect, useMemo } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { cn } from "@/lib/utils"


import type { User, Student, AppSettings, TransferredStudent, FeePayment } from "../types"

import { DEFAULT_SETTINGS, DEFAULT_CLASS_GROUPS, BillingCycle, TERMS } from "../types/index"
import { SchoolDataStorage } from "../lib/storage"

import {
  calculateStudentTotals,
  calculateOutstandingFromEnrollment,
  calculateMonthlyCollections,
  calculateTotalOutstandingFromEnrollment,
} from "../lib/calculations"
import { calculateTransportOutstanding } from "@/lib/transportUtils"

import { getCurrentDate, getCurrentMonth, getCurrentYear, getStartOfMonth, getStartOfTerm } from "../lib/dateUtils"

import { getCurrentAcademicYear } from "../lib/academicUtils"

import {
  performAutomaticPromotions,
  getPromotionPreview,
  manualTransferStudent,
  cleanupOldTransfers,
} from "../lib/promotionUtils"

import { migrateStudentsData, needsMigration } from "../lib/migration"
import BackupManager from "../lib/backupManager"

import {
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Plus,
  Search,
  Trash2,
  Calendar,
  Filter,
  Settings,
  Clock,
  RefreshCw,
  UserX,
  GraduationCap,
  ListRestart,
  FileText,
  HardDriveDownload,
  Receipt,
  MessageSquare,
} from "lucide-react"

import StudentDetails from "./StudentDetails"
import StudentForm from "./StudentForm"
import SettingsModal from "./SettingsModal"
import BackupRestorePage from "./BackupRestorePage"
import OutstandingStudentsList from "./OutstandingStudentsList"
import TransferredStudentsList from "./TransferredStudentsList"
import PendingPromotedStudentsList from "./PendingPromotedStudentsList"
import ReportsPage from "./ReportsPage"
import EnhancedStudentCard from "./EnhancedStudentCard"
import ExtraBillingPage, { type ExtraBillingPageType } from "./ExtraBillingPage"
import ExtraBillingOverviewPage from "./ExtraBillingOverviewPage" // New import
import { ExpensesPage } from "./ExpensesPage"
import RealTimeSync from "./RealTimeSync"

interface DashboardProps {
  user: User
  onLogout: () => void
  goToBroadcast: () => void
}

const STORAGE_KEYS = {
  STUDENTS: "studentTrackStudents",
  SETTINGS: "studentTrackSettings",
  TRANSFERRED: "studentTrackTransferred",
  EXTRA_BILLING: "studentTrackExtraBilling",
}

// Initialize storage instance
const storage = new SchoolDataStorage()

// Initialize backup manager instance
const backupManager = new BackupManager("Dashboard User")

// Enhanced Promotion Dialog Component
const PromotionDialog = ({
  promotionPreview,
  onClose,
  onConfirm,
  progress,
  statusMessage,
}: {
  promotionPreview: { promoted: Student[]; retained: Student[] }
  onClose: () => void
  onConfirm: () => void
  progress: number
  statusMessage: string
}) => (
  <Card className="w-full max-w-2xl mx-auto">
    <CardHeader>
      <CardTitle className="text-purple-800 flex items-center gap-2">
        <GraduationCap className="w-5 h-5" />
        Automatic Promotion Preview
      </CardTitle>
      <CardDescription>Review students eligible for promotion to the next class group</CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {promotionPreview.promoted.length > 0 && (
        <div>
          <h4 className="font-medium text-green-800 mb-3">
            Students to be Promoted ({promotionPreview.promoted.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {promotionPreview.promoted.map((student) => (
              <div key={student.id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                <span className="text-sm">{student.fullName}</span>
                <span className="text-xs text-green-600">{student.className} → Next Level</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {promotionPreview.retained.length > 0 && (
        <div>
          <h4 className="font-medium text-orange-800 mb-3">
            Students to be Retained ({promotionPreview.retained.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {promotionPreview.retained.map((student) => (
              <div key={student.id} className="flex justify-between items-center p-2 bg-orange-50 rounded">
                <span className="text-sm">{student.fullName}</span>
                <span className="text-xs text-orange-600">Stays in {student.className}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {progress > 0 && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600">{statusMessage}</p>
        </div>
      )}

      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onConfirm} className="bg-purple-600 hover:bg-purple-700">
          Confirm Promotions
        </Button>
      </div>
    </CardContent>
  </Card>
)

// Enhanced Migration Dialog Component
const MigrationDialog = ({ onClose, onMigrate }: { onClose: () => void; onMigrate: () => void }) => (
  <Card className="w-full max-w-md mx-auto">
    <CardHeader>
      <CardTitle className="text-purple-800">Data Migration Required</CardTitle>
      <CardDescription>Your student data needs to be updated to support new features</CardDescription>
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="bg-blue-50 p-4 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-2">What will be updated:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Enhanced transport payment tracking</li>
          <li>• Improved class group structure</li>
          <li>• Better fee calculation system</li>
          <li>• Enhanced promotion system</li>
        </ul>
      </div>
      <div className="flex justify-end gap-4">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onMigrate} className="bg-purple-600 hover:bg-purple-700">
          Update Data
        </Button>
      </div>
    </CardContent>
  </Card>
)

// Enhanced Transfer Dialog Component
const TransferDialog = ({
  student,
  classGroups,
  onClose,
  onTransfer,
}: {
  student: Student
  classGroups: any[]
  onClose: () => void
  onTransfer: (studentId: string, newClassGroupId: string, transferNotes: string, transferReason: string) => void
}) => {
  const [selectedClassGroup, setSelectedClassGroup] = useState("")
  const [transferReason, setTransferReason] = useState("")
  const [transferNotes, setTransferNotes] = useState("")

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-purple-800">Transfer Student</CardTitle>
        <CardDescription>Transfer {student.fullName} to a different class group</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>New Class Group</Label>
          <Select value={selectedClassGroup} onValueChange={setSelectedClassGroup}>
            <SelectTrigger>
              <SelectValue placeholder="Select class group" />
            </SelectTrigger>
            <SelectContent>
              {classGroups.map((group) => {
                if (group.id !== student.classGroup) {
                  return (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  )
                }
                return (
                  <SelectItem key={group.id} value={group.id} disabled>
                    {group.name}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Transfer Reason</Label>
          <Input
            value={transferReason}
            onChange={(e) => setTransferReason(e.target.value)}
            placeholder="Reason for transfer"
          />
        </div>

        <div>
          <Label>Additional Notes</Label>
          <Input
            value={transferNotes}
            onChange={(e) => setTransferNotes(e.target.value)}
            placeholder="Optional notes"
          />
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => onTransfer(student.id, selectedClassGroup, transferNotes, transferReason)}
            className="bg-red-600 hover:bg-red-700"
            disabled={!selectedClassGroup || !transferReason}
          >
            Transfer Student
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function Dashboard({ user, onLogout, goToBroadcast }: DashboardProps) {
  const [students, setStudents] = useState<Student[]>([])
  const [transferredStudents, setTransferredStudents] = useState<TransferredStudent[]>([])

  const [settings, setSettings] = useState<AppSettings>(() => {
    try {
      const local = localStorage.getItem(STORAGE_KEYS.SETTINGS)
      if (local) {
        const parsed = JSON.parse(local)
        // Ensure all array properties are arrays, and other properties have defaults
        const loadedSettings = {
          ...DEFAULT_SETTINGS, // Start with defaults
          ...parsed, // Overlay with parsed values
          classGroups: Array.isArray(parsed.classGroups) ? parsed.classGroups : DEFAULT_CLASS_GROUPS,
          savedClassNames: Array.isArray(parsed.savedClassNames)
            ? parsed.savedClassNames
            : DEFAULT_SETTINGS.savedClassNames,
          billingCycle: parsed.billingCycle || DEFAULT_SETTINGS.billingCycle,
          paymentDueDate: parsed.paymentDueDate || 1,
        }
        return loadedSettings
      }
    } catch (error) {
      console.warn("Failed to parse settings from localStorage, using defaults:", error)
    }
    return DEFAULT_SETTINGS
  })

  // Enhanced state for real-time sync and UI improvements
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error">("idle")
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true)
  // Dashboard view state
  const [dashboardView, setDashboardView] = useState<"table" | "compact">("compact")
  const [notifications, setNotifications] = useState<
    Array<{
      id: string
      type: "info" | "warning" | "error" | "success" | "backup-reminder"
      message: string
      timestamp: Date
      dismissed: boolean
    }>
  >([])

  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showOutstandingStudents, setShowOutstandingStudents] = useState(false)
  const [showTransferredStudents, setShowTransferredStudents] = useState(false)
  const [showReports, setShowReports] = useState(false)
  const [showBackupRestore, setShowBackupRestore] = useState(false)
  const [showExpenses, setShowExpenses] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [dateFilters, setDateFilters] = useState({
    startDate: "",
    endDate: "",
  })
  const [academicYear] = useState(getCurrentAcademicYear())
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate] = useState(getCurrentDate())
  const [currentMonth] = useState(getCurrentMonth())
  const [isMounted, setIsMounted] = useState(false)
  const [migrationStatus, setMigrationStatus] = useState<string>("")
  const currentYear = getCurrentYear()

  // Add pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [studentsPerPage] = useState(30)

  // Enhanced state management
  const [showPromotionDialog, setShowPromotionDialog] = useState(false)
  const [promotionPreviewData, setPromotionPreviewData] = useState<{
    promoted: Student[]
    retained: Student[]
  } | null>(null)
  const [showPendingPromotedStudents, setShowPendingPromotedStudents] = useState(false)

  // State for Confirm Dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmDialogTitle, setConfirmDialogTitle] = useState("")
  const [confirmDialogMessage, setConfirmDialogMessage] = useState("")
  const [confirmDialogOnConfirm, setConfirmDialogOnConfirm] = useState<() => void>(() => {})
  const [confirmDialogOnCancel, setConfirmDialogOnCancel] = useState<() => void>(() => {})

  // State for Migration Dialog
  const [showMigrationDialog, setShowMigrationDialog] = useState(false)
  const [migrationRequired, setMigrationRequired] = useState(false)

  // State for Transfer Dialog
  const [showTransferDialog, setShowTransferDialog] = useState(false)

  // State for Reports
  const [reportPeriod, setReportPeriod] = useState("monthly")
  const [reportStartDate, setReportStartDate] = useState("")
  const [reportEndDate, setReportEndDate] = useState("")

  // Extra Billing state
  const [extraBillingPages, setExtraBillingPages] = useState<ExtraBillingPageType[]>([])
  // Changed to manage overall view
  const [currentView, setCurrentView] = useState<"dashboard" | "extraBillingOverview" | "extraBillingDetail">(
    "dashboard",
  )
  const [activeExtraBillingPageId, setActiveExtraBillingPageId] = useState<string | null>(null)

  // Expenses state
  const [expenses, setExpenses] = useState([])

  // Add currentNotificationIndex state
  const [currentNotificationIndex, setCurrentNotificationIndex] = useState(0)

  // Enhanced function to calculate tuition fees collected in the current calendar month
  const calculateMonthlyTuitionCollections = (students: Student[]) => {
    const currentYear = getCurrentYear()
    const currentMonth = getCurrentMonth() // 1-12 for Jan-Dec
    
    console.log('Tuition calculation - Current month:', currentMonth, 'Current year:', currentYear)

    return students.reduce((total, student) => {
      if (!Array.isArray(student.feePayments)) return total

      // Get all payments that have any amount paid in the current month
      const studentTuitionPaymentsInCurrentMonth = student.feePayments.filter((payment) => {
        // Include any payment with amountPaid > 0 for current month period OR with paidDate in current month
        if ((payment.amountPaid || 0) <= 0) return false

        // Check if this is a payment for the current month period (period 9 = September)
        const isCurrentMonthPeriod = payment.period === currentMonth
        
        // Check if this payment was made in the current calendar month (paidDate)
        let isPaidInCurrentMonth = false
        if (payment.paidDate) {
          try {
            const paymentDate = new Date(payment.paidDate)
            isPaidInCurrentMonth = paymentDate.getFullYear() === currentYear && paymentDate.getMonth() + 1 === currentMonth
          } catch (error) {
            console.warn("Invalid fee payment paidDate:", payment.paidDate, error)
          }
        }
        
        const shouldInclude = isCurrentMonthPeriod || isPaidInCurrentMonth
        if (shouldInclude) {
          console.log('Found tuition payment:', student.fullName, 'Amount:', payment.amountPaid, 'Period:', payment.period, 'PaidDate:', payment.paidDate)
        }
        return shouldInclude
      })

      // Calculate tuition portion only (exclude transport component)
      const sumForStudent = studentTuitionPaymentsInCurrentMonth.reduce((sum, payment) => {
        const totalPaid = payment.amountPaid || 0
        
        // For students with active transport, subtract transport component from payment
        if (student.hasTransport && !payment.isTransportWaived) {
          const transportPortion = student.transportFee || 0
          const tuitionPortion = Math.max(0, totalPaid - transportPortion)
          return sum + tuitionPortion
        } else {
          // For students without transport or with waived transport, count full payment as tuition
          return sum + totalPaid
        }
      }, 0)

      return total + sumForStudent
    }, 0)
  }

  // Memoized total tuition collections for the current month
  const currentMonthTuitionFees = useMemo(() => {
    // Calculate tuition collections for current month regardless of billing cycle
    return calculateMonthlyTuitionCollections(students)
  }, [students])

  // Memoized total collections for current term
  const currentTermCollections = useMemo(() => {
    if (settings.billingCycle === BillingCycle.TERMLY) {
      return calculateMonthlyCollections(students, BillingCycle.TERMLY)
    }
    return 0 // Return 0 if billing cycle is not termly
  }, [students, settings.billingCycle])

  // Persist current month collections so other pages (e.g., ExpensesPage)  // Persist term as well
  useEffect(() => {
    try {
      const existingRaw = localStorage.getItem("schoolCollections")
      const existing = existingRaw ? JSON.parse(existingRaw) : {}
      localStorage.setItem(
        "schoolCollections",
        JSON.stringify({
          ...existing,
          termCollections: currentTermCollections,
        }),
      )
    } catch (error) {
      console.error("Error persisting term collections:", error)
    }
  }, [currentTermCollections])

  // Sync outstanding students to Firebase when students or settings change
  useEffect(() => {
    if (!isLoading && isMounted && Array.isArray(students)) {
      const studentsWithOutstanding = students.filter((student) => {
        const outstanding = calculateOutstandingFromEnrollment(
          { ...student, feePayments: Array.isArray(student.feePayments) ? student.feePayments : [] },
          settings.billingCycle,
        )
        return outstanding > 0
      })

      if (studentsWithOutstanding.length > 0) {
        const outstandingData = studentsWithOutstanding.map(student => ({
          id: student.id,
          fullName: student.fullName,
          className: student.className,
          parentContact: student.parentContact,
          outstandingAmount: calculateOutstandingFromEnrollment(
            { ...student, feePayments: Array.isArray(student.feePayments) ? student.feePayments : [] },
            settings.billingCycle,
          ),
          admissionDate: student.admissionDate,
          hasTransport: student.hasTransport,
          transportFee: student.transportFee,
          classGroup: student.classGroup,
          lastUpdated: new Date().toISOString()
        }))
        storage.saveOutstandingStudents(outstandingData)
      }
    }
  }, [students, settings, isLoading, isMounted])

  // Enhanced transport fees collected calculation for current month - mirrors tuition logic
  const currentMonthTransportFees = useMemo(() => {
    const currentMonth = getCurrentMonth()
    const currentYear = getCurrentYear()
    
    console.log('Transport calculation - Current month:', currentMonth, 'Current year:', currentYear)

    return students.reduce((total, student) => {
      if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
        return total
      }

      // Get all transport payments that have any amount paid in the current month
      const studentTransportPaymentsInCurrentMonth = student.transportPayments.filter((payment) => {
        // Include any payment with amountPaid > 0 for current month period OR with paidDate in current month
        if ((payment.amountPaid || 0) <= 0 || payment.isSkipped) return false

        // Check if this is a payment for the current month period (month 9 = September)
        const isCurrentMonthPeriod = payment.month === currentMonth
        
        // Check if this payment was made in the current calendar month (paidDate)
        let isPaidInCurrentMonth = false
        if (payment.paidDate) {
          try {
            const paymentDate = new Date(payment.paidDate)
            isPaidInCurrentMonth = paymentDate.getFullYear() === currentYear && paymentDate.getMonth() + 1 === currentMonth
          } catch (error) {
            console.warn("Invalid transport payment paidDate:", payment.paidDate, error)
          }
        }
        
        const shouldInclude = isCurrentMonthPeriod || isPaidInCurrentMonth
        if (shouldInclude) {
          console.log('Found transport payment:', student.fullName, 'Amount:', payment.amountPaid, 'Month:', payment.month, 'PaidDate:', payment.paidDate)
        }
        return shouldInclude
      })

      // Sum the transport payments made in current month
      const sumForStudent = studentTransportPaymentsInCurrentMonth.reduce((sum, payment) => {
        return sum + (payment.amountPaid || 0)
      }, 0)

      return total + sumForStudent
    }, 0)
  }, [students])

  // Current term label e.g., "Term 2 (May - Aug)"

  // Current term label e.g., "Term 2 (May - Aug)"
  const currentTermLabel = useMemo(() => {
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ]
    const nowMonth = getCurrentMonth()
    const term = TERMS.find((t) => t.months.includes(nowMonth))
    if (!term) return ""
    const startName = monthNames[term.months[0] - 1]
    const endName = monthNames[term.months[term.months.length - 1] - 1]
    return `${term.name} (${startName} - ${endName})`
  }, [currentMonth])

  // Persist term as well
  useEffect(() => {
    try {
      const existingRaw = localStorage.getItem("schoolCollections")
      const existing = existingRaw ? JSON.parse(existingRaw) : {}
      localStorage.setItem(
        "schoolCollections",
        JSON.stringify({
          ...existing,
          currentMonth: currentMonthTuitionFees, // Changed to tuition fees
          currentTerm: currentTermCollections,
        }),
      )
    } catch (err) {
      console.warn("Failed to persist collection stats", err)
    }
  }, [currentMonthTuitionFees, currentTermCollections])

  useEffect(() => {
    setIsMounted(true)
    
    // Initialize automatic monthly backup on 27th of each month
    try {
      backupManager.scheduleMonthlyBackup()
      console.log("Automatic monthly backup scheduler initialized (27th of each month)")
    } catch (error) {
      console.error("Failed to initialize automatic backup scheduler:", error)
    }
  }, [])

  // Load Extra Billing pages
  useEffect(() => {
    if (!isMounted) return
    try {
      const extraBillingData = storage.getExtraBilling()
      if (Array.isArray(extraBillingData)) {
        setExtraBillingPages(extraBillingData)
      }
    } catch (err) {
      console.error("Failed to load extra billing pages", err)
    }
  }, [isMounted])

  useEffect(() => {
    if (!isMounted) return undefined

    if (typeof window !== "undefined" && (window as any).electronAPI) {
      ;(window as any).electronAPI.onMenuNewStudent(() => {
        setShowAddForm(true)
      })

      return () => {
        ;(window as any).electronAPI.removeAllListeners("menu-new-student")
      }
    }

    return undefined
  }, [isMounted])

  useEffect(() => {
    if (!isMounted) return undefined

    const loadDataWithMigration = async (): Promise<void> => {
      try {
        setMigrationStatus("Checking for data updates...")

        const savedStudentsRaw = localStorage.getItem(STORAGE_KEYS.STUDENTS)
        const savedStudentsParsed: Student[] | null = savedStudentsRaw ? JSON.parse(savedStudentsRaw) : null

        // Load settings first to ensure they are available for migration and other logic
        const savedSettingsRaw = localStorage.getItem(STORAGE_KEYS.SETTINGS)
        let currentSettings: AppSettings = DEFAULT_SETTINGS
        if (savedSettingsRaw) {
          try {
            const parsedSettings = JSON.parse(savedSettingsRaw)
            currentSettings = {
              ...DEFAULT_SETTINGS,
              ...parsedSettings,
              classGroups: Array.isArray(parsedSettings.classGroups)
                ? parsedSettings.classGroups
                : DEFAULT_CLASS_GROUPS,
              savedClassNames: Array.isArray(parsedSettings.savedClassNames)
                ? parsedSettings.savedClassNames
                : DEFAULT_SETTINGS.savedClassNames,
              billingCycle: parsedSettings.billingCycle || DEFAULT_SETTINGS.billingCycle,
              paymentDueDate: parsedSettings.paymentDueDate || 1,
            }
            setSettings(currentSettings) // Update state with robustly loaded settings
          } catch (error) {
            console.error("Error parsing settings in useEffect, using defaults:", error)
            setSettings(DEFAULT_SETTINGS)
          }
        } else {
          setSettings(DEFAULT_SETTINGS)
        }

        if (needsMigration(savedStudentsParsed)) {
          setMigrationRequired(true)
          setMigrationStatus("Updating student data structure...")

          // Use the potentially updated currentSettings for migration
          const migrationResult = migrateStudentsData(savedStudentsParsed || [], currentSettings)

          if (migrationResult.success) {
            if (migrationResult.studentsUpdated > 0) {
              setMigrationStatus(`Updated ${migrationResult.studentsUpdated} students with class group structure`)
            }
          } else {
            console.error("Migration errors:", migrationResult.errors)
            setMigrationStatus("Data update completed with some warnings")
          }

          if (migrationResult.updatedStudents) {
            setStudents(migrationResult.updatedStudents)
            storage.saveStudents(migrationResult.updatedStudents)
          }
        } else {
          // Removed: setMigrationStatus("Data structure up-to-date.")
        }

        try {
          const savedStudents = localStorage.getItem(STORAGE_KEYS.STUDENTS)
          const savedTransferred = localStorage.getItem(STORAGE_KEYS.TRANSFERRED)

          if (savedStudents) {
            const parsed = JSON.parse(savedStudents)
            if (Array.isArray(parsed)) setStudents(parsed)
          }

          if (savedTransferred) {
            const parsed = JSON.parse(savedTransferred)
            if (Array.isArray(parsed)) setTransferredStudents(parsed)
          }
        } catch (error) {
          console.error("Error loading local student data:", error)
        }

        // Cleanup old transfers with proper type safety
        cleanupOldTransfers(
          Array.isArray(savedStudentsParsed) ? savedStudentsParsed : [],
          currentSettings.transferRetentionYears || 5, // Default to 5 years if not set
          (progress: number, message: string) => {
            // Optional: Add progress handling if needed
            console.log(`Cleanup progress: ${progress}% - ${message}`)
          },
        )
      } catch (error) {
        console.error("Error loading data:", error)
        setStudents([])
        setTransferredStudents([])
        setSettings(DEFAULT_SETTINGS)
        setMigrationStatus("Error loading data - please refresh the page")
      } finally {
        setIsLoading(false)
      }
    }

    loadDataWithMigration()
    return undefined
  }, [isMounted]) // Removed 'settings' from dependency array to prevent infinite loop, as settings are now loaded within this effect.

  // Real-time sync effect
  useEffect(() => {
    if (!autoSyncEnabled || !isMounted) return

    const syncInterval = setInterval(() => {
      setSyncStatus("syncing")
      setLastSyncTime(new Date())

      // Simulate data validation and sync
      setTimeout(() => {
        setSyncStatus("idle")

        // Check for data inconsistencies and notify
        const inconsistencies = validateDataIntegrity()
        if (inconsistencies.length > 0) {
          setNotifications((prev) => [
            ...prev,
            {
              id: Date.now().toString(),
              type: "warning",
              message: `${inconsistencies.length} data inconsistencies detected`,
              timestamp: new Date(),
              dismissed: false,
            },
          ])
        }
      }, 30000) // Sync every 30 seconds
    }, 30000) // Sync every 30 seconds

    return () => clearInterval(syncInterval)
  }, [autoSyncEnabled, isMounted, students, settings])

  useEffect(() => {
    if (!isLoading && isMounted) {
      if (Array.isArray(extraBillingPages)) {
        storage.saveExtraBilling(extraBillingPages)
      }
      if (Array.isArray(students)) {
        storage.saveStudents(students)
      }
      if (settings) {
        storage.saveSettings(settings)
      }
      if (Array.isArray(transferredStudents)) {
        storage.saveTransferredStudents(transferredStudents)
      }
    }
  }, [students, settings, transferredStudents, extraBillingPages, isLoading, isMounted])

  // Weekly backup reminder (every Monday)
  useEffect(() => {
    if (!isMounted) return

    const today = new Date()
    // getDay(): 0-Sunday, 1-Monday, ...
    if (today.getDay() === 1) {
      const todayStr = today.toISOString().slice(0, 10) // YYYY-MM-DD
      const lastShown = localStorage.getItem("backupNotificationLastShown")

      if (lastShown !== todayStr) {
        setNotifications((prev) => [
          {
            id: `backup-${todayStr}`,
            type: "backup-reminder", // Changed type here
            message:
              "Back-Up Notification : Save your current work by backing up your data on a removable USB flash drive or external hard drive disk",
            timestamp: today,
            dismissed: false,
          },
          ...prev,
        ])
        localStorage.setItem("backupNotificationLastShown", todayStr)
      }
    }
  }, [isMounted])

  // Add a useEffect hook to manage notification cycling
  useEffect(() => {
    const activeNotifications = notifications.filter((n) => !n.dismissed)
    if (activeNotifications.length > 1) {
      const interval = setInterval(() => {
        setCurrentNotificationIndex((prevIndex) => (prevIndex + 1) % activeNotifications.length)
      }, 5000) // Cycle every 5 seconds
      return () => clearInterval(interval)
    } else {
      setCurrentNotificationIndex(0) // Reset if only one or no active notifications
      return () => {}
    }
  }, [notifications])

  // -------------------- Extra Billing modal & handlers --------------------
  // Removed showAddBillingModal and related state/handlers from Dashboard
  // Functionality moved to ExtraBillingOverviewPage

  const handleAddExtraBillingPage = (name: string) => {
    const newPage: ExtraBillingPageType = {
      id: Date.now().toString(),
      name,
      entries: [],
      createdAt: new Date().toISOString(),
    }
    setExtraBillingPages((prev) => [...prev, newPage])
    setActiveExtraBillingPageId(newPage.id)
    setCurrentView("extraBillingDetail") // Navigate to the new page's detail view
  }

  const handleSelectExtraBillingPage = (id: string) => {
    setActiveExtraBillingPageId(id)
    setCurrentView("extraBillingDetail")
  }

  const handleDeleteExtraBillingPage = (id: string) => {
    setExtraBillingPages((prev) => prev.filter((p) => p.id !== id))
    if (activeExtraBillingPageId === id) {
      setActiveExtraBillingPageId(null)
      setCurrentView("extraBillingOverview") // Go back to overview if active page is deleted
    }
  }

  const updateExtraBillingPage = (updated: ExtraBillingPageType) => {
    setExtraBillingPages((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
  }

  // Prepare Extra Billing page component if active
  const activeExtraBillingPage = activeExtraBillingPageId
    ? extraBillingPages.find((p) => p.id === activeExtraBillingPageId) || null
    : null

  // -------------------- Existing handlers --------------------
  const handleAutomaticPromotions = () => {
    setConfirmDialogOnConfirm(() => {
      return () => {
        if (!Array.isArray(students) || !settings) {
          setConfirmDialogOpen(false)
          return
        }

        const result = performAutomaticPromotions(
          students,
          settings.promotionThreshold || 0, // Provide a default value if undefined
          settings.graduationClassGroup || "",
          academicYear,
          settings.classGroups,
        )

        if (result && (result.promoted?.length > 0 || result.transferred?.length > 0)) {
          let updatedStudents = [...students]

          // Handle promoted students
          if (result.promoted?.length > 0) {
            updatedStudents = updatedStudents.map((student) => {
              const promoted = result.promoted.find((p) => p.id === student.id)
              if (promoted) {
                return {
                  ...student,
                  classGroup: promoted.classGroup || student.classGroup,
                  className: promoted.className || student.className,
                  academicYear: promoted.academicYear || student.academicYear,
                  feePayments: promoted.feePayments || student.feePayments,
                  totalPaid: promoted.totalPaid ?? student.totalPaid,
                  totalOwed: promoted.totalOwed ?? student.totalOwed,
                }
              }
              return student
            })
          }

          // Handle transferred students
          if (result.transferred?.length > 0) {
            updatedStudents = updatedStudents.filter((student) => !result.transferred.some((t) => t.id === student.id))
            setTransferredStudents((prev) => [...prev, ...(result.transferred as TransferredStudent[])])
          }

          setStudents(updatedStudents)

          const message = `Automatic promotions completed: ${result.promoted.length} promoted, ${result.transferred.length} transferred`
          setMigrationStatus(message)
          setTimeout(() => setMigrationStatus(""), 5000)
        } else {
          setMigrationStatus("No students needed promotion or transfer.")
          setTimeout(() => setMigrationStatus(""), 3000)
        }
        setConfirmDialogOpen(false)
      }
    })
    setConfirmDialogOnCancel(() => () => setConfirmDialogOpen(false))
    setConfirmDialogTitle("Confirm Automatic Promotion")
    setConfirmDialogMessage(
      "Are you sure you want to run automatic promotions? This will update student class groups and reset billing for the new academic year.",
    )
    setConfirmDialogOpen(true)
  }

  const handleManualTransfer = (student: Student) => {
    setSelectedStudent(student)
    setShowTransferDialog(true)
  }

  const confirmManualTransfer = (
    studentId: string,
    newClassGroupId: string,
    transferNotes: string,
    transferReason: string,
  ) => {
    setConfirmDialogOnConfirm(() => {
      return () => {
        const studentToTransfer = students.find((s) => s.id === studentId)
        if (!studentToTransfer) {
          console.error("Student not found for transfer:", studentId)
          setConfirmDialogOpen(false)
          return
        }

        const transferred = manualTransferStudent(studentToTransfer, newClassGroupId, transferNotes, transferReason)
        setStudents((prev) => prev.filter((s) => s.id !== studentId))
        setTransferredStudents((prev) => [...prev, transferred])
        setSelectedStudent(null)
        setShowTransferDialog(false)
        setConfirmDialogOpen(false)
        setMigrationStatus(`Student ${studentToTransfer.fullName} transferred.`)
        setTimeout(() => setMigrationStatus(""), 3000)
      }
    })
    setConfirmDialogOnCancel(() => () => setConfirmDialogOpen(false))
    setConfirmDialogTitle("Confirm Student Transfer")
    setConfirmDialogMessage(
      `Are you sure you want to transfer ${students.find((s) => s.id === studentId)?.fullName}? This action will move them to transferred students.`,
    )
    setConfirmDialogOpen(true)
  }

  const filteredStudents = useMemo(() => {
    let currentFilteredStudents = Array.isArray(students) ? [...students] : []

    currentFilteredStudents = currentFilteredStudents
      .filter((student) => {
        const matchesSearch =
          searchTerm === "" ||
          student.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.parentContact?.includes(searchTerm) ||
          student.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.id?.includes(searchTerm) ||
          (student.classGroup &&
            (Array.isArray(settings.classGroups) ? settings.classGroups : [])
              .find((g: { id: string; name: string }) => g.id === student.classGroup)
              ?.name.toLowerCase()
              .includes(searchTerm.toLowerCase())) ||
          (student.className && student.className.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (student.notes && student.notes.toLowerCase().includes(searchTerm.toLowerCase()))

        const matchesDateRange = (() => {
          if (!dateFilters.startDate && !dateFilters.endDate) return true

          const admissionDate = new Date(student.admissionDate)
          const startDate = dateFilters.startDate ? new Date(dateFilters.startDate) : null
          const endDate = dateFilters.endDate ? new Date(dateFilters.endDate) : null

          if (startDate && endDate) {
            return admissionDate >= startDate && admissionDate <= endDate
          }
          if (startDate) {
            return admissionDate >= startDate
          }
          if (endDate) {
            return admissionDate <= endDate
          }
          return true
        })()

        return matchesSearch && matchesDateRange
      })
      .sort((a, b) => {
        const idA = Number.parseInt(a.id, 10)
        const idB = Number.parseInt(b.id, 10)
        return idB - idA
      })
    return currentFilteredStudents
  }, [students, searchTerm, dateFilters, settings.classGroups])

  // Add pagination calculations
  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage)
  const startIndex = (currentPage - 1) * studentsPerPage
  const endIndex = startIndex + studentsPerPage
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex)

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, dateFilters.startDate, dateFilters.endDate])

  // Calculate fees data including monthly collections, total fees, and outstanding amounts
  const { monthlyCollections, totalFeesCollected, outstandingFromEnrollment, allStudentsOutstandingFromEnrollment } =
    useMemo(() => {
      // Initialize monthly collections with 0 for each month
      const monthly = Array(12).fill(0)

      // Calculate total fees collected and monthly breakdown
      const total = students.reduce((sum: number, student: Student) => {
        // Add to monthly collections based on payment dates
        if (Array.isArray(student.feePayments)) {
          student.feePayments.forEach((payment: FeePayment) => {
            if (payment.paid && payment.paidDate) {
              try {
                const date = new Date(payment.paidDate)
                if (!isNaN(date.getTime())) {
                  // Check if date is valid
                  const month = date.getMonth() // 0-11 for Jan-Dec
                  monthly[month] += payment.amountPaid || 0
                }
              } catch (error) {
                console.warn("Error processing payment date:", payment.paidDate, error)
              }
            }
          })
        }

        return sum + (student.totalPaid || 0)
      }, 0)

      // Calculate outstanding amounts
      const outstanding = settings?.billingCycle
        ? calculateTotalOutstandingFromEnrollment(students, settings.billingCycle)
        : 0

      const allStudentsOutstanding = settings?.billingCycle
        ? calculateTotalOutstandingFromEnrollment(students, settings.billingCycle)
        : 0

      return {
        monthlyCollections: monthly,
        totalFeesCollected: total,
        outstandingFromEnrollment: outstanding,
        allStudentsOutstandingFromEnrollment: allStudentsOutstanding,
      }
    }, [students, settings?.billingCycle])

  const grandTotals = useMemo(() => {
    return filteredStudents.reduce(
      (totals, student) => {
        const studentWithGuardedFeePayments = {
          ...student,
          feePayments: Array.isArray(student.feePayments) ? student.feePayments : [],
        }
        const studentCalculatedTotals = calculateStudentTotals(studentWithGuardedFeePayments, settings.billingCycle)
        return {
          totalExpected: totals.totalExpected + studentCalculatedTotals.annualFeeCalculated,
        }
      },
      { totalExpected: 0 },
    )
  }, [filteredStudents, settings.billingCycle])

  const allStudentsTotals = useMemo(() => {
    return Array.isArray(students)
      ? students.reduce(
          (totals, student) => {
            const studentWithGuardedFeePayments = {
              ...student,
              feePayments: Array.isArray(student.feePayments) ? student.feePayments : [],
            }
            const studentCalculatedTotals = calculateStudentTotals(studentWithGuardedFeePayments, settings.billingCycle)
            return {
              totalExpected: totals.totalExpected + studentCalculatedTotals.annualFeeCalculated,
            }
          },
          { totalExpected: 0 },
        )
      : { totalExpected: 0 }
  }, [students, settings.billingCycle])

  const studentsByClassGroup = useMemo(() => {
    return Array.isArray(students)
      ? students.reduce(
          (acc, student) => {
            const groupId = student.classGroup || "unassigned"
            if (!acc[groupId]) {
              acc[groupId] = []
            }
            acc[groupId].push(student)
            return acc
          },
          {} as Record<string, Student[]>,
        )
      : {}
  }, [students])

  const promotionPreview = useMemo(() => {
    return Array.isArray(students)
      ? getPromotionPreview(
          students,
          typeof settings.promotionThreshold === "number" ? settings.promotionThreshold : 50, // Default to 50 if not set
          settings.graduationClassGroup || "Grade 7", // Default graduation class if not set
          academicYear,
          Array.isArray(settings.classGroups) ? settings.classGroups : [],
        )
      : { promoted: [], retained: [] }
  }, [students, academicYear, settings.promotionThreshold, settings.graduationClassGroup, settings.classGroups])

  const handleStudentUpdate = (updatedStudent: Student) => {
    setStudents((prev) => prev.map((student) => (student.id === updatedStudent.id ? updatedStudent : student)))
    setSelectedStudent(updatedStudent)
    // Cleanup old transfers with progress callback
    cleanupOldTransfers(
      students,
      typeof settings.transferRetentionYears === "number" ? settings.transferRetentionYears : 5, // Default to 5 years if not set
      (progress: number, message: string) => {
        // Just log the progress, we don't need to update the UI for this
        console.log(`Cleanup progress: ${progress}% - ${message}`)
      },
    )
  }

  const handleDeleteStudent = (studentId: string) => {
    setConfirmDialogOnConfirm(() => {
      return () => {
        setStudents((prev) => prev.filter((student) => student.id !== studentId))
        if (selectedStudent?.id === studentId) {
          setSelectedStudent(null)
        }
        setConfirmDialogOpen(false)
        setMigrationStatus(`Student ${studentId} deleted.`)
        setTimeout(() => setMigrationStatus(""), 3000)
      }
    })
    setConfirmDialogOnCancel(() => () => setConfirmDialogOpen(false))
    setConfirmDialogTitle("Confirm Deletion")
    setConfirmDialogMessage(
      `Are you sure you want to permanently delete this student? This action cannot be undone. Student ID: ${studentId}`,
    )
    setConfirmDialogOpen(true)
  }

  const handleDeleteTransferredStudent = (studentId: string) => {
    setConfirmDialogOnConfirm(() => {
      return () => {
        setTransferredStudents((prev) => prev.filter((student) => student.id !== studentId))
        setConfirmDialogOpen(false)
        setMigrationStatus(`Transferred student ${studentId} removed.`)
        setTimeout(() => setMigrationStatus(""), 3000)
      }
    })
    setConfirmDialogOnCancel(() => () => setConfirmDialogOpen(false))
    setConfirmDialogTitle("Confirm Removal")
    setConfirmDialogMessage(
      `Are you sure you want to remove this transferred student from the list? This action cannot be undone.`,
    )
    setConfirmDialogOpen(true)
  }

  const handleAddStudent = (
    newStudentData: Omit<Student, "id" | "academicYear" | "feePayments" | "totalPaid" | "totalOwed">,
  ) => {
    const newId = (Date.now() + Math.floor(Math.random() * 1000)).toString()

    const selectedGroup = (Array.isArray(settings.classGroups) ? settings.classGroups : []).find(
      (g) => g.id === newStudentData.classGroup,
    )
    const standardFee = selectedGroup ? selectedGroup.standardFee : 0
    const admissionDateObj = new Date(newStudentData.admissionDate)

    const feePayments: FeePayment[] = []
    let totalOwed = 0

    if (settings.billingCycle === BillingCycle.MONTHLY) {
      for (let i = 0; i < 12; i++) {
        const month = i + 1
        const dueDate = new Date(currentYear, i, settings.paymentDueDate || 1).toISOString().split("T")[0]

        let amountDue = newStudentData.hasCustomFees && newStudentData.customSchoolFee 
          ? newStudentData.customSchoolFee 
          : standardFee
        const isPeriodAfterAdmission =
          getStartOfMonth(currentYear, month).getTime() >=
          getStartOfMonth(admissionDateObj.getFullYear(), admissionDateObj.getMonth() + 1).getTime()

        if (newStudentData.hasTransport && isPeriodAfterAdmission) {
          amountDue += newStudentData.transportFee
        }

        const feePayment: FeePayment = {
          period: month,
          amountDue: amountDue,
          amountPaid: 0,
          paid: false,
          dueDate: dueDate,
          isTransportWaived: false,
          outstandingAmount: amountDue,
        }
        feePayments.push(feePayment)

        if (isPeriodAfterAdmission) {
          totalOwed += amountDue
        }
      }
    } else {
      // Termly
      TERMS.forEach((term) => {
        const firstMonthOfTerm = term.months[0]
        const dueDate = new Date(currentYear, firstMonthOfTerm - 1, settings.paymentDueDate || 1)
          .toISOString()
          .split("T")[0]

        let amountDue = newStudentData.hasCustomFees && newStudentData.customSchoolFee 
          ? newStudentData.customSchoolFee 
          : standardFee
        const isPeriodAfterAdmission =
          getStartOfTerm(currentYear, term.period).getTime() >=
          getStartOfMonth(admissionDateObj.getFullYear(), admissionDateObj.getMonth() + 1).getTime()

        if (newStudentData.hasTransport && isPeriodAfterAdmission) {
          amountDue += newStudentData.transportFee
        }

        const feePayment: FeePayment = {
          period: term.period,
          amountDue: amountDue,
          amountPaid: 0,
          paid: false,
          dueDate: dueDate,
          isTransportWaived: false,
          outstandingAmount: amountDue,
        }
        feePayments.push(feePayment)

        if (isPeriodAfterAdmission) {
          totalOwed += amountDue
        }
      })
    }

    const newStudent: Student = {
      ...newStudentData,
      id: newId,
      academicYear: currentYear.toString(),
      feePayments: feePayments,
      totalPaid: 0,
      totalOwed: totalOwed,
      hasTransport: newStudentData.hasTransport,
      transportFee: newStudentData.transportFee,
    }

    const updatedSettings = {
      ...settings,
      savedClassNames: [
        ...new Set([
          ...(Array.isArray(settings.savedClassNames) ? settings.savedClassNames : []),
          newStudentData.className,
        ]),
      ],
    }
    storage.saveSettings(updatedSettings)
    setSettings(updatedSettings)
    
    // Update students state and save with Firebase sync
    const updatedStudents = [...students, newStudent]
    setStudents(updatedStudents)
    storage.saveStudents(updatedStudents)
    
    setShowAddForm(false)
    setSelectedStudent(newStudent)
  }

  const handleSettingsSave = (newSettings: AppSettings) => {
    const settingsToSave = {
      ...newSettings,
      classGroups: Array.isArray(newSettings.classGroups) ? newSettings.classGroups : DEFAULT_CLASS_GROUPS,
      savedClassNames: Array.isArray(newSettings.savedClassNames)
        ? newSettings.savedClassNames
        : DEFAULT_SETTINGS.savedClassNames,
    }
    setSettings(settingsToSave)
    setShowSettings(false)
  }

  const handleBackToDashboard = () => {
    try {
      setSelectedStudent(null)
      setShowAddForm(false)
      setShowSettings(false)
      setShowOutstandingStudents(false)
      setShowTransferredStudents(false)
      setShowPromotionDialog(false)
      setShowPendingPromotedStudents(false)
      setShowMigrationDialog(false)
      setShowTransferDialog(false)
      setShowReports(false)
      setShowBackupRestore(false)
      setShowExpenses(false)
      setCurrentView("dashboard") // Reset view to dashboard
      setActiveExtraBillingPageId(null) // Clear active extra billing page
    } catch (error) {
      console.error("Error returning to dashboard:", error)
      window.location.reload()
    }
  }

  const handleLogoutClick = () => {
    handleBackToDashboard()
    onLogout()
  }

  const handleClearFilters = () => {
    setSearchTerm("")
    setDateFilters({ startDate: "", endDate: "" })
    setShowFilters(false)
  }

  const exportStudentsToPDF = async () => {
    // Only run on client side
    if (typeof window === "undefined") {
      console.warn("PDF export is only available in the browser")
      return
    }

    try {
      // Use the current year as fallback if academic year is not set in settings
      const currentYear = (settings as any).academicYear || new Date().getFullYear()

      // Sort students by class name and then by student name
      const sortedStudents = [...filteredStudents].sort((a, b) => {
        // First sort by class name
        const classCompare = (a.className || "").localeCompare(b.className || "")
        if (classCompare !== 0) return classCompare
        // If same class, sort by student name
        return (a.fullName || "").localeCompare(b.fullName || "")
      })

      // Dynamically import jsPDF and jspdf-autotable
      const { jsPDF } = await import("jspdf")
      // Import autoTable directly from jspdf-autotable
      const autoTable = (await import("jspdf-autotable")).default

      // Initialize jsPDF with proper type
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      })

      // Add header
      doc.setFont("helvetica", "bold")
      doc.setFontSize(20)
      doc.setTextColor(40)
      doc.text(settings.schoolName || "School", 14, 22)

      doc.setFont("helvetica", "normal")
      doc.setFontSize(12)
      doc.text(
        `Students List - ${new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })}`,
        14,
        30,
      )

      doc.text(`Academic Year: ${currentYear}`, 14, 36)

      // Prepare data for the table
      const tableColumn = ["#", "Student Name", "Class", "Expected", "Paid", "Balance"]
      const tableRows = sortedStudents.map((student, index) => {
        const { totalOwed, totalPaid } = calculateStudentTotals(student, settings.billingCycle)
        const transportOwed = student.hasTransport ? calculateTransportOutstanding(student) : 0
        const totalTransportPaid = student.hasTransport
          ? student.transportPayments?.reduce((acc, p) => acc + (p.amountPaid || 0), 0) || 0
          : 0

        const expected = totalOwed + transportOwed
        const paid = totalPaid + totalTransportPaid
        const balance = expected - paid

        return [
          (index + 1).toString(),
          student.fullName || "N/A",
          student.className || "N/A",
          `${settings.currency} ${expected.toFixed(2)}`,
          `${settings.currency} ${paid.toFixed(2)}`,
          `${settings.currency} ${balance.toFixed(2)}`,
        ]
      })

      // Add the table
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 45,
        styles: {
          font: "helvetica",
          fontSize: 10,
          cellPadding: 3,
          valign: "middle",
          overflow: "linebreak",
          cellWidth: "wrap",
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: [79, 70, 229], // Purple color
          textColor: 255,
          fontStyle: "bold",
          cellPadding: 5,
          lineWidth: 0.1,
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251], // Light gray for alternate rows
        },
        margin: {
          top: 10,
          right: 14,
          bottom: 20,
          left: 14,
        },
        didDrawPage: (data: any) => {
          // Footer with page numbers on each page
          const pageCount = doc.getNumberOfPages()
          const pageSize = doc.internal.pageSize
          const pageHeight = pageSize.height ? pageSize.height : pageSize.getHeight()
          const pageWidth = pageSize.width ? pageSize.width : pageSize.getWidth()

          doc.setFont("helvetica", "normal")
          doc.setFontSize(8)
          doc.setTextColor(100)

          // Left-aligned text
          doc.text(
            `Page ${data.pageNumber} of ${pageCount} • ${sortedStudents.length} Students`,
            data.settings.margin.left,
            pageHeight - 10,
            { align: "left" },
          )

          // Right-aligned text
          doc.text("Generated by My Students Track", pageWidth - data.settings.margin.right, pageHeight - 10, {
            align: "right",
          })
        },
      })

      // Save the PDF
      const fileName = `Students_List_${new Date().toISOString().split("T")[0]}.pdf`
      doc.save(fileName)
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("Error generating PDF. Please try again.")
    }
  }

  const getOverallStudentPaymentStatus = (student: Student) => {
    if (!student || !Array.isArray(student.feePayments)) {
      return { status: "Unknown", color: "bg-gray-500", icon: AlertCircle }
    }

    // Totals paid and outstanding up to the current date
    const { totalPaid } = calculateStudentTotals(student, settings.billingCycle)
    const tuitionPlusTransportOutstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

    // Remove the transport component so colour logic mirrors StudentDetails.tsx
    const transportOutstanding = calculateTransportOutstanding(student)
    const tuitionOutstanding = Math.max(0, tuitionPlusTransportOutstanding - transportOutstanding)

    if (tuitionOutstanding <= 0.01) {
      return { status: "Paid in Full", color: "bg-green-500", icon: CheckCircle }
    }

    if (totalPaid > 0 && tuitionOutstanding > 0.01) {
      return { status: "Partial Payment", color: "bg-orange-500", icon: AlertCircle }
    }

    return { status: "Outstanding", color: "bg-red-500", icon: AlertCircle }
  }

  // Calculate current term and termly collections
  const getCurrentTerm = () => {
    const month = new Date().getMonth()
    if (month >= 0 && month <= 3) return "1st Term (Jan - Apr)"
    if (month >= 4 && month <= 7) return "2nd Term (May - Aug)"
    return "3rd Term (Sep - Dec)"
  }

  const getCurrentMonthCollections = () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()

    return students.reduce((total, student) => {
      if (!Array.isArray(student.feePayments)) return total

      const studentPayments = student.feePayments.filter((payment) => {
        // Check if payment is marked as paid and has a valid paidDate
        const isPaid = payment.paid === true || String(payment.paid).toLowerCase() === "true"
        if (!isPaid) return false
        if (!payment.paidDate) return false

        try {
          // Handle both string and Date objects for paidDate
          const paymentDate =
            typeof payment.paidDate === "string" ? new Date(payment.paidDate) : new Date(payment.paidDate)

          // Check if the date is valid
          if (isNaN(paymentDate.getTime())) {
            console.warn("Invalid payment date:", payment.paidDate)
            return false
          }

          return paymentDate.getFullYear() === currentYear && paymentDate.getMonth() === currentMonth
        } catch (error) {
          console.warn("Error processing payment date:", payment.paidDate, error)
          return false // Add this line
        }
      })

      const studentTotal = studentPayments.reduce((sum, payment) => {
        const amount = typeof payment.amountPaid === "number" ? payment.amountPaid : 0
        return sum + (amount || 0)
      }, 0)

      return total + studentTotal
    }, 0)
  }

  const calculateTermlyCollection = () => {
    const currentYear = new Date().getFullYear()
    const currentMonth = new Date().getMonth()
    let startMonth, endMonth

    if (currentMonth >= 0 && currentMonth <= 3) {
      // 1st Term: Jan-Apr
      startMonth = 0
      endMonth = 3
    } else if (currentMonth >= 4 && currentMonth <= 7) {
      // 2nd Term: May-Aug
      startMonth = 4
      endMonth = 7
    } else {
      // 3rd Term: Sep-Dec
      startMonth = 8
      endMonth = 11
    }

    return students.reduce((total, student) => {
      if (!Array.isArray(student.feePayments)) return total

      const termPayments = student.feePayments.filter((payment) => {
        // Check if payment is marked as paid and has a valid paidDate
        const isPaid = payment.paid === true || String(payment.paid).toLowerCase() === "true"
        if (!isPaid) return false
        if (!payment.paidDate) return false

        try {
          // Handle both string and Date objects for paidDate
          const paymentDate =
            typeof payment.paidDate === "string" ? new Date(payment.paidDate) : new Date(payment.paidDate)

          // Check if the date is valid
          if (isNaN(paymentDate.getTime())) {
            console.warn("Invalid payment date:", payment.paidDate)
            return false
          }

          const paymentMonth = paymentDate.getMonth()
          return paymentDate.getFullYear() === currentYear && paymentMonth >= startMonth && paymentMonth <= endMonth
        } catch (error) {
          console.warn("Error processing payment date:", payment.paidDate, error)
          return false
        }
      })

      const studentTotal = termPayments.reduce((sum, payment) => {
        const amount = typeof payment.amountPaid === "number" ? payment.amountPaid : 0
        return sum + (amount || 0)
      }, 0)

      return total + studentTotal
    }, 0)
  }

  const hasActiveFilters = searchTerm !== "" || dateFilters.startDate !== "" || dateFilters.endDate !== ""

  const handleStudentSelect = (student: Student) => {
    try {
      setSelectedStudent(student)
      setShowAddForm(false)
      setShowSettings(false)
      setShowOutstandingStudents(false)
      setShowTransferredStudents(false)
      setShowPromotionDialog(false)
      setShowPendingPromotedStudents(false)
      setShowMigrationDialog(false)
      setShowTransferDialog(false)
      setShowReports(false)
      setShowBackupRestore(false)
      setCurrentView("dashboard") // Ensure we are on dashboard view when selecting student
    } catch (error) {
      console.error("Error selecting student:", error)
      setSelectedStudent(null)
    }
  }

  const handleExportReport = async () => {
    // Implementation for report export will be added in next batch
    console.log("Export report functionality to be implemented")
  }

  const validateDataIntegrity = () => {
    const issues: string[] = []

    students.forEach((student) => {
      if (!Array.isArray(student.feePayments)) {
        issues.push(`Student ${student.fullName}: Invalid fee payments structure`)
      }

      if (student.hasTransport && (!student.transportPayments || !Array.isArray(student.transportPayments))) {
        issues.push(`Student ${student.fullName}: Missing transport payment data`)
      }

      const totals = calculateStudentTotals(student, settings.billingCycle)
      if (totals.totalPaid < 0 || totals.totalOwed < 0) {
        issues.push(`Student ${student.fullName}: Negative payment amounts detected`)
      }
    })

    return issues
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, dismissed: true } : n)))
  }

  const clearAllNotifications = () => {
    setNotifications([])
  }

  if (!isMounted || isLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600">{migrationStatus || "Loading your students..."}</p>
          {migrationStatus && (
            <div className="mt-2 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span className="text-sm text-gray-600">Updating data structure</span>
            </div>
          )}
        </div>
      </div>
    )
  }

  // Render Extra Billing Overview or Detail page if active
  if (currentView === "extraBillingOverview") {
    return (
      <ExtraBillingOverviewPage
        pages={extraBillingPages}
        onAddPage={handleAddExtraBillingPage}
        onSelectPage={handleSelectExtraBillingPage}
        onDeletePage={handleDeleteExtraBillingPage}
        onBack={handleBackToDashboard}
      />
    )
  }

  if (currentView === "extraBillingDetail" && activeExtraBillingPage) {
    return (
      <ExtraBillingPage
        page={activeExtraBillingPage}
        onUpdate={updateExtraBillingPage}
        onDelete={handleDeleteExtraBillingPage}
        onBack={() => setCurrentView("extraBillingOverview")} // Go back to overview from detail
      />
    )
  }

  if (selectedStudent) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToDashboard}
                className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-purple-800">Student Details</h1>
                <p className="text-sm text-gray-600">Academic Year: {academicYear}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Removed unused buttons: Transfer Student, Delete Student, Logout */}
            </div>
          </div>
        </div>

        <div className="p-6">
          <StudentDetails student={selectedStudent} onUpdate={handleStudentUpdate} settings={settings} />
        </div>

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  if (showAddForm) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToDashboard}
                className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-purple-800">Add New Student</h1>
                <p className="text-sm text-gray-600">Academic Year: {academicYear}</p>
              </div>
            </div>
            <Button
              onClick={handleLogoutClick}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="p-6">
          <StudentForm
            onSubmit={handleAddStudent}
            settings={{ ...settings, classGroups: Array.isArray(settings.classGroups) ? settings.classGroups : [] }}
          />
        </div>

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  if (showSettings && settings) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold text-purple-800">My Students Track</h1>
              <p className="text-gray-600">Academic Year: {academicYear}</p>
            </div>
            <Button
              onClick={handleLogoutClick}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>

        <SettingsModal
          settings={{ ...settings, classGroups: Array.isArray(settings.classGroups) ? settings.classGroups : [] }}
          onSave={handleSettingsSave}
          onClose={() => setShowSettings(false)}
          studentCount={students.length}
        />

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  if (showTransferredStudents) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToDashboard}
                className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-purple-800">Transferred Students</h1>
                <p className="text-sm text-gray-600">Academic Year: {academicYear}</p>
              </div>
            </div>
            <Button
              onClick={handleLogoutClick}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="p-6">
          <TransferredStudentsList students={transferredStudents} onDeleteStudent={handleDeleteTransferredStudent} />
        </div>

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  if (showOutstandingStudents) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToDashboard}
                className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-purple-800">Students with Outstanding Payments</h1>
                <p className="text-sm text-gray-600">Academic Year: {academicYear}</p>
              </div>
            </div>
            <Button
              onClick={handleLogoutClick}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="p-6">
          {(() => {
            const studentsWithOutstanding = filteredStudents.filter((student) => {
              const outstanding = calculateOutstandingFromEnrollment(
                { ...student, feePayments: Array.isArray(student.feePayments) ? student.feePayments : [] },
                settings.billingCycle,
              )
              return outstanding > 0
            })

            return (
              <OutstandingStudentsList
                students={studentsWithOutstanding}
                onSelectStudent={handleStudentSelect}
                calculateOutstanding={(student: Student) =>
                  calculateOutstandingFromEnrollment(
                    { ...student, feePayments: Array.isArray(student.feePayments) ? student.feePayments : [] },
                    settings.billingCycle,
                  )
                }
                getPaymentStatus={(student: Student) => getOverallStudentPaymentStatus(student)}
                settings={settings}
              />
            )
          })()}
        </div>

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  if (showBackupRestore) {
    return <BackupRestorePage onBack={handleBackToDashboard} />
  }

  if (showExpenses) {
    return <ExpensesPage settings={settings} onBack={handleBackToDashboard} />
  }

  if (showReports) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToDashboard}
                className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-purple-800">Reports & Analytics</h1>
                <p className="text-sm text-gray-600">Academic Year: {academicYear}</p>
              </div>
            </div>
            <Button
              onClick={handleLogoutClick}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="p-6">
          <ReportsPage students={students} settings={settings} onBack={handleBackToDashboard} />
        </div>

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  if (showPendingPromotedStudents) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBackToDashboard}
                className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
              >
                ← Back to Dashboard
              </Button>
              <div>
                <h1 className="text-xl font-semibold text-purple-800">Pending Promoted Students</h1>
                <p className="text-sm text-gray-600">Academic Year: {academicYear}</p>
              </div>
            </div>
            <Button
              onClick={handleLogoutClick}
              variant="outline"
              size="sm"
              className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
            >
              Logout
            </Button>
          </div>
        </div>

        <div className="p-6">
          <PendingPromotedStudentsList onBack={() => setShowPendingPromotedStudents(false)} settings={settings} />
        </div>

        <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
          <p>Powered by Calch Media</p>
        </div>
      </div>
    )
  }

  const isJanuary1st = new Date().getMonth() === 0 && new Date().getDate() === 1
  if (showPromotionDialog && (promotionPreview.promoted.length > 0 || promotionPreview.retained.length > 0)) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold text-purple-800">Promotion Preview</h1>
              <p className="text-gray-600">Review automatic promotions for January 1st</p>
            </div>
          </div>
        </div>

        <div className="p-6 max-w-4xl mx-auto">
          <PromotionDialog
            promotionPreview={promotionPreview}
            onClose={() => {
              setShowPromotionDialog(false)
              setPromotionPreviewData(null)
            }}
            onConfirm={handleAutomaticPromotions}
            progress={0}
            statusMessage=""
          />
        </div>
      </div>
    )
  }

  if (showMigrationDialog && migrationRequired) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold text-purple-800">Data Migration</h1>
              <p className="text-gray-600">Your data needs to be updated.</p>
            </div>
          </div>
        </div>
        <div className="p-6 max-w-md mx-auto">
          <MigrationDialog
            onClose={() => setShowMigrationDialog(false)}
            onMigrate={() => {
              const savedStudentsRaw = localStorage.getItem(STORAGE_KEYS.STUDENTS)
              const savedStudentsParsed: Student[] = savedStudentsRaw ? JSON.parse(savedStudentsRaw) : []
              const migrationResult = migrateStudentsData(savedStudentsParsed, settings)
              if (migrationResult.success) {
                setStudents(migrationResult.updatedStudents || savedStudentsParsed)
                localStorage.setItem(
                  STORAGE_KEYS.STUDENTS,
                  JSON.stringify(migrationResult.updatedStudents || savedStudentsParsed),
                )
                setMigrationRequired(false)
                setShowMigrationDialog(false)
                setMigrationStatus("Data migration successful!")
                setTimeout(() => setMigrationStatus(""), 3000)
              } else {
                setMigrationStatus("Migration failed with errors. Check console.")
                console.error("Migration dialog error:", migrationResult.errors)
              }
            }}
          />
        </div>
      </div>
    )
  }

  if (showTransferDialog && selectedStudent) {
    return (
      <div className="min-h-screen bg-purple-50">
        <div className="bg-white shadow-sm border-b p-4">
          <div className="flex items-center justify-between max-w-7xl mx-auto">
            <div>
              <h1 className="text-2xl font-bold text-purple-800">Transfer Student</h1>
              <p className="text-gray-600">
                Transferring {selectedStudent ? (selectedStudent as Student).fullName : "Student"}
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 max-w-md mx-auto">
          <TransferDialog
            student={selectedStudent}
            classGroups={Array.isArray(settings.classGroups) ? settings.classGroups : []}
            onClose={() => setShowTransferDialog(false)}
            onTransfer={confirmManualTransfer}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-purple-50">
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-purple-600">{migrationStatus || "Loading your students..."}</p>
            {migrationStatus && (
              <div className="mt-2 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span className="text-sm text-gray-600">Updating data structure</span>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={confirmDialogOpen}
        title={confirmDialogTitle}
        message={confirmDialogMessage}
        onConfirm={confirmDialogOnConfirm}
        onCancel={confirmDialogOnCancel}
      />

      {!isLoading && migrationStatus && (
        <div className="bg-green-50 border-b border-green-200 p-3">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm text-gray-600">{migrationStatus}</span>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-bold text-purple-800">My Students Track</h1>
            <div className="flex items-center gap-4 text-sm text-gray-600">
              <span>Academic Year: {academicYear}</span>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <span>{currentDate}</span>
              </div>
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full ${
                    syncStatus === "syncing"
                      ? "bg-blue-500 animate-pulse"
                      : syncStatus === "error"
                        ? "bg-red-500"
                        : "bg-green-500"
                  }`}
                ></div>
                <span className="text-xs">
                  {syncStatus === "syncing"
                    ? "Syncing..."
                    : syncStatus === "error"
                      ? "Sync Error"
                      : `Last sync: ${lastSyncTime.toLocaleTimeString()}`}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-right text-[11px] text-gray-600">Welcome, {user.name}!</span>

            <div className="flex flex-wrap gap-1.5 max-w-2xl justify-end">
              <div className="flex gap-1.5">
                <Button
                  size="sm"
                  onClick={() => setShowPendingPromotedStudents(true)}
                  variant="outline"
                  className="text-blue-600 border-blue-600 hover:bg-blue-50 flex items-center text-xs px-2 py-1"
                >
                  <Users className="w-3 h-3 mr-1" />
                  Pending
                </Button>
              </div>
              <div className="flex gap-1.5">
                {transferredStudents.length > 0 && (
                  <Button
                    onClick={() => setShowTransferredStudents(true)}
                    size="sm"
                    variant="outline"
                    className="text-blue-600 border-blue-600 hover:bg-blue-50 text-xs px-2 py-1"
                  >
                    <UserX className="w-4 h-4 mr-2" />
                    Transferred ({transferredStudents.length})
                  </Button>
                )}
                <Button
                  onClick={() => setShowReports(true)}
                  size="sm"
                  variant="outline"
                  className="text-green-600 border-green-600 hover:bg-green-50 text-xs px-2 py-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Reports
                </Button>
                {/* Removed Add Billing button from here, functionality moved to ExtraBillingOverviewPage */}
                <Button
                  onClick={() => setCurrentView("extraBillingOverview")} // Navigate to ExtraBillingOverviewPage
                  size="sm"
                  variant="outline"
                  className="text-teal-600 border-teal-600 hover:bg-teal-50 text-xs px-2 py-1"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Extra Billing
                </Button>
                <Button
                  onClick={() => setShowExpenses(true)}
                  size="sm"
                  variant="outline"
                  className="text-amber-600 border-amber-600 hover:bg-amber-50 text-xs px-2 py-1"
                >
                  <Receipt className="w-4 h-4 mr-2" />
                  Expenses
                </Button>

                <Button
                  variant="outline"
                  onClick={goToBroadcast}
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Broadcast
                </Button>

                <Button
                  onClick={() => setShowBackupRestore(true)}
                  size="sm"
                  variant="outline"
                  className="text-indigo-600 border-indigo-600 hover:bg-indigo-50 text-xs px-2 py-1"
                >
                  <HardDriveDownload className="w-4 h-4 mr-2" />
                  Backup & Restore
                </Button>
                <Button
                  onClick={() => setShowSettings(true)}
                  size="sm"
                  variant="outline"
                  className="text-purple-600 border-purple-600 hover:bg-purple-50 text-xs px-2 py-1"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
                <Button
                  onClick={handleLogoutClick}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-600 hover:bg-red-50 bg-transparent"
                >
                  Logout
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Notifications Bar (cycling) */}
        {notifications.filter((n) => !n.dismissed).length > 0 &&
          (() => {
            const activeNotifications = notifications.filter((n) => !n.dismissed)
            const notificationToDisplay = activeNotifications[currentNotificationIndex]

            if (!notificationToDisplay) return null

            return (
              <div className="mt-3 max-w-7xl mx-auto">
                <div
                  key={notificationToDisplay.id} // Key for transition
                  className={cn(
                    "transition-opacity duration-500 ease-in-out rounded-lg p-3",
                    notificationToDisplay.type === "backup-reminder"
                      ? "bg-orange-50 border border-orange-200 animate-pulse"
                      : "bg-yellow-50 border border-yellow-200",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {notificationToDisplay.type === "backup-reminder" ? (
                        <AlertCircle className="w-4 h-4 text-orange-600" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                      )}
                      <span
                        className={cn(
                          "text-sm",
                          notificationToDisplay.type === "backup-reminder" ? "text-orange-800" : "text-yellow-800",
                        )}
                      >
                        {notificationToDisplay.message}
                      </span>
                    </div>
                    <Button
                      onClick={() => dismissNotification(notificationToDisplay.id)}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        notificationToDisplay.type === "backup-reminder"
                          ? "text-orange-600 hover:text-orange-800"
                          : "text-yellow-600 hover:text-yellow-800",
                      )}
                    >
                      ×
                    </Button>
                  </div>
                  {activeNotifications.length > 1 && (
                    <div className="mt-2 text-xs text-gray-500 flex justify-between items-center">
                      <span>
                        Showing {currentNotificationIndex + 1} of {activeNotifications.length} notifications.
                      </span>
                      <Button
                        onClick={clearAllNotifications}
                        variant="outline"
                        size="sm"
                        className={cn(
                          "text-xs px-2 py-1",
                          notificationToDisplay.type === "backup-reminder"
                            ? "text-orange-600 border-orange-300 hover:bg-orange-100 bg-transparent"
                            : "text-yellow-600 border-yellow-300 hover:bg-yellow-100 bg-transparent",
                        )}
                      >
                        Clear All
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })()}
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium">Total Students</CardTitle>
              <Users className="h-3 w-3 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-800">{students.length}</div>
              {hasActiveFilters && <p className="text-[10px] text-gray-600">({filteredStudents.length} filtered)</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium">Tuition Fees Collected (Current Month Only)</CardTitle>
              <DollarSign className="h-3 w-3 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-blue-800">
                $
                {currentMonthTuitionFees.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[10px] text-gray-600">
                {new Date(0, new Date().getMonth()).toLocaleString("default", { month: "long" })}
              </p>
            </CardContent>
          </Card>

          {/* Transport Fees Collected Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium">Transport Fees Collected (Current Month Only)</CardTitle>
              <DollarSign className="h-3 w-3 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-purple-800">
                $
                {currentMonthTransportFees.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[10px] text-gray-600">
                {new Date(0, new Date().getMonth()).toLocaleString("default", { month: "long" })}
              </p>
            </CardContent>
          </Card>

          {/* Current Term Collections Card */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium">Current Term Collections</CardTitle>
              <DollarSign className="h-3 w-3 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-green-800">
                $
                {currentTermCollections.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[10px] text-gray-600">{currentTermLabel}</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setShowOutstandingStudents(true)}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium">Outstanding (Since Enrollment)</CardTitle>
              <AlertCircle className="h-3 w-3 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold text-red-800">
                $
                {hasActiveFilters
                  ? outstandingFromEnrollment.toLocaleString()
                  : allStudentsOutstandingFromEnrollment.toLocaleString()}
              </div>
              <div className="flex justify-between items-center">
                <p className="text-[10px] text-gray-600">School fees + Transport fees</p>
                <Badge variant="outline" className="text-xs">
                  View List →
                </Badge>
              </div>
              {hasActiveFilters && <p className="text-[10px] text-gray-600">Filtered view</p>}
            </CardContent>
          </Card>
        </div>

        {/* Real-time Sync Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-8">
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-purple-800">Students Overview</CardTitle>
                    <CardDescription>
                      Organized by class groups • Click on a student to view details and manage payments
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={exportStudentsToPDF}
                        className="text-purple-600 border-purple-600 hover:bg-purple-50 bg-transparent"
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        Export PDF
                      </Button>
                      <Button
                        onClick={() => setShowAddForm(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Student
                      </Button>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-6 space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search by name, phone, address, class, student ID, or notes..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setShowFilters(!showFilters)}
                      className={`${showFilters ? "bg-purple-50 border-purple-300" : ""}`}
                    >
                      <Filter className="w-4 h-4 mr-2" />
                      Filters
                    </Button>
                    {hasActiveFilters && (
                      <Button
                        variant="outline"
                        onClick={handleClearFilters}
                        className="text-red-600 border-red-300 bg-transparent"
                      >
                        <ListRestart className="w-4 h-4 mr-2" />
                        Clear All
                      </Button>
                    )}
                  </div>

                  {showFilters && (
                    <div className="bg-gray-50 p-4 rounded-lg border">
                      <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Filter by Admission Date Range
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="startDate" className="text-xs text-gray-600">
                            From Date
                          </Label>
                          <Input
                            id="startDate"
                            type="date"
                            value={dateFilters.startDate}
                            onChange={(e) => setDateFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="endDate" className="text-xs text-gray-600">
                            To Date
                          </Label>
                          <Input
                            id="endDate"
                            type="date"
                            value={dateFilters.endDate}
                            onChange={(e) => setDateFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="mt-1"
                          />
                        </div>
                      </div>
                      {(dateFilters.startDate || dateFilters.endDate) && (
                        <div className="mt-3 text-xs text-gray-600">
                          {dateFilters.startDate && dateFilters.endDate
                            ? `Showing students admitted between ${new Date(dateFilters.startDate).toLocaleDateString()} and ${new Date(dateFilters.endDate).toLocaleDateString()}`
                            : dateFilters.startDate
                              ? `Showing students admitted from ${new Date(dateFilters.startDate).toLocaleDateString()} onwards`
                              : `Showing students admitted up to ${new Date(dateFilters.endDate).toLocaleDateString()}`}
                        </div>
                      )}
                    </div>
                  )}

                  {hasActiveFilters && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>Active filters:</span>
                      {searchTerm && (
                        <Badge variant="secondary" className="text-xs">
                          Search: "{searchTerm}"
                        </Badge>
                      )}
                      {dateFilters.startDate && (
                        <Badge variant="secondary" className="text-xs">
                          From: {new Date(dateFilters.startDate).toLocaleDateString()}
                        </Badge>
                      )}
                      {dateFilters.endDate && (
                        <Badge variant="secondary" className="text-xs">
                          To: {new Date(dateFilters.endDate).toLocaleDateString()}
                        </Badge>
                      )}
                      <span className="text-purple-600 font-medium">
                        ({filteredStudents.length} of {students.length} students)
                      </span>
                    </div>
                  )}
                </div>

                {/* Students Display - Only compact view is supported */}
                {dashboardView === "table" ? (
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left p-3 font-medium text-gray-700">Student</th>
                          <th className="text-left p-3 font-medium text-gray-700">Class</th>
                          <th className="text-left p-3 font-medium text-gray-700">Contact</th>
                          <th className="text-left p-3 font-medium text-gray-700">Payment Progress</th>
                          <th className="text-left p-3 font-medium text-gray-700">Outstanding</th>
                          <th className="text-left p-3 font-medium text-gray-700">Status</th>
                          <th className="text-left p-3 font-medium text-gray-700">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedStudents.map((student) => (
                          <EnhancedStudentCard
                            key={student.id}
                            student={student}
                            settings={settings}
                            onSelect={handleStudentSelect}
                            onTransfer={handleManualTransfer}
                            viewMode="table"
                            showQuickActions={false}
                          />
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : dashboardView === "compact" ? (
                  <div className="space-y-1">
                    {paginatedStudents.map((student) => (
                      <EnhancedStudentCard
                        key={student.id}
                        student={student}
                        settings={settings}
                        onSelect={handleStudentSelect}
                        onTransfer={handleManualTransfer}
                        viewMode="compact"
                        showQuickActions={false}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedStudents.map((student) => (
                      <EnhancedStudentCard
                        key={student.id}
                        student={student}
                        settings={settings}
                        onSelect={handleStudentSelect}
                        onTransfer={handleManualTransfer}
                        viewMode="cards"
                        showQuickActions={false}
                      />
                    ))}
                  </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      Showing {startIndex + 1} - {Math.min(endIndex, filteredStudents.length)} of{" "}
                      {filteredStudents.length} students
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        Previous
                      </Button>
                      <span className="text-sm text-gray-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1">
            <RealTimeSync
              students={students}
              settings={settings}
              onDataUpdate={setStudents}
              onSettingsUpdate={setSettings}
            />
          </div>
        </div>
      </div>

      <div className="fixed bottom-4 left-4 text-xs text-gray-500 bg-white px-2 py-1 rounded shadow">
        <p>Powered by Calch Media</p>
      </div>
    </div>
  )
}
