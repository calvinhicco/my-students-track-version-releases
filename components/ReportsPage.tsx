"use client"

import { useState, useMemo } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"

import type { Student, AppSettings } from "../types/index"
import { BillingCycle } from "../types/index"

import { calculateStudentTotals, calculateOutstandingFromEnrollment } from "../lib/calculations"
import { getMonthName, formatCurrency } from "../lib/dateUtils"
import { exportOutstandingStudentsPDF, exportOutstandingStudentsPDFSimple } from "../lib/outstandingPdfExport"
import { exportComprehensiveReportPDF, exportClassReportPDF, exportAllStudentsSummaryPDF } from "../lib/pdfExport"

import {
  FileText,
  Download,
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  AlertCircle,
  CheckCircle,
  BarChart3,
  PieChart,
  ArrowLeft,
  Filter,
  RefreshCw,
} from "lucide-react"

interface ReportsPageProps {
  students: Student[]
  settings: AppSettings
  onBack: () => void
}

// Enhanced report types with more comprehensive options
const REPORT_TYPES = [
  {
    id: "comprehensive",
    name: "Comprehensive Financial Report",
    description: "Complete overview of all financial data with analytics",
    icon: BarChart3,
    color: "bg-purple-500",
  },
  {
    id: "outstanding",
    name: "Outstanding Payments Analysis",
    description: "Detailed analysis of unpaid fees with recommendations",
    icon: AlertCircle,
    color: "bg-red-500",
  },
  {
    id: "outstanding-simple",
    name: "Outstanding Payments (Simple)",
    description: "Basic list of students with outstanding payments",
    icon: FileText,
    color: "bg-orange-500",
  },
  {
    id: "class-summary",
    name: "Class-wise Summary",
    description: "Financial breakdown by class groups",
    icon: Users,
    color: "bg-blue-500",
  },
  {
    id: "all-students",
    name: "All Students Summary",
    description: "Complete list of all students with payment status",
    icon: Users,
    color: "bg-green-500",
  },
  {
    id: "payment-trends",
    name: "Payment Trends Analysis",
    description: "Monthly/termly payment collection trends",
    icon: TrendingUp,
    color: "bg-indigo-500",
  },
  {
    id: "transport-report",
    name: "Transport Payments Report",
    description: "Analysis of transport fee collections",
    icon: TrendingUp,
    color: "bg-teal-500",
  },
]

const REPORT_PERIODS = [
  { id: "daily", name: "Daily", description: "Last 24 hours" },
  { id: "3-day", name: "3-Day", description: "Last 3 days" },
  { id: "weekly", name: "Weekly", description: "Last 7 days" },
  { id: "monthly", name: "Monthly", description: "Current month" },
  { id: "termly", name: "Termly", description: "Current term" },
  { id: "yearly", name: "Yearly", description: "Current academic year" },
]

// Enhanced analytics calculations
const calculateReportAnalytics = (students: Student[], settings: AppSettings) => {
  const analytics = {
    totalStudents: students.length,
    totalExpected: 0,
    totalCollected: 0,
    totalOutstanding: 0,
    studentsWithOutstanding: 0,
    studentsFullyPaid: 0,
    studentsPartiallyPaid: 0,
    studentsNeverPaid: 0,
    averagePaymentRate: 0,
    highestOutstanding: 0,
    lowestOutstanding: 0,
    classBreakdown: new Map<string, any>(),
    paymentStatusBreakdown: new Map<string, number>(),
    monthlyCollections: new Map<string, number>(),
    transportAnalytics: {
      studentsWithTransport: 0,
      transportRevenue: 0,
      transportOutstanding: 0,
    },
  }

  students.forEach((student) => {
    const totals = calculateStudentTotals(student, settings.billingCycle)
    const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

    // Use expectedToDate instead of annualFeeCalculated to only include periods up to current date
    analytics.totalExpected += totals.expectedToDate
    analytics.totalCollected += totals.totalPaid
    analytics.totalOutstanding += outstanding

    // Payment status categorization
    if (outstanding <= 0.01) {
      analytics.studentsFullyPaid++
      analytics.paymentStatusBreakdown.set("Fully Paid", (analytics.paymentStatusBreakdown.get("Fully Paid") || 0) + 1)
    } else if (totals.totalPaid > 0) {
      analytics.studentsPartiallyPaid++
      analytics.paymentStatusBreakdown.set(
        "Partially Paid",
        (analytics.paymentStatusBreakdown.get("Partially Paid") || 0) + 1,
      )
    } else {
      analytics.studentsNeverPaid++
      analytics.paymentStatusBreakdown.set("Never Paid", (analytics.paymentStatusBreakdown.get("Never Paid") || 0) + 1)
    }

    if (outstanding > 0.01) {
      analytics.studentsWithOutstanding++
      analytics.highestOutstanding = Math.max(analytics.highestOutstanding, outstanding)
      if (analytics.lowestOutstanding === 0 || outstanding < analytics.lowestOutstanding) {
        analytics.lowestOutstanding = outstanding
      }
    }

    // Class breakdown
    const classGroup = settings.classGroups.find((g) => g.id === student.classGroup)
    const className = classGroup?.name || "Unknown"

    if (!analytics.classBreakdown.has(className)) {
      analytics.classBreakdown.set(className, {
        students: 0,
        expected: 0,
        collected: 0,
        outstanding: 0,
      })
    }

    const classData = analytics.classBreakdown.get(className)!
    classData.students++
    classData.expected += totals.expectedToDate // Use expectedToDate for class breakdown as well
    classData.collected += totals.totalPaid
    classData.outstanding += outstanding

    // Transport analytics
    if (student.hasTransport) {
      analytics.transportAnalytics.studentsWithTransport++
      analytics.transportAnalytics.transportRevenue += totals.transportPaid || 0
      analytics.transportAnalytics.transportOutstanding += totals.transportOutstanding || 0
    }

    // Monthly collections (for current year)
    if (Array.isArray(student.feePayments)) {
      student.feePayments.forEach((payment) => {
        if (payment.paid && payment.amountPaid > 0) {
          const monthKey =
            settings.billingCycle === BillingCycle.MONTHLY ? getMonthName(payment.period) : `Term ${payment.period}`

          analytics.monthlyCollections.set(
            monthKey,
            (analytics.monthlyCollections.get(monthKey) || 0) + payment.amountPaid,
          )
        }
      })
    }
  })

  analytics.averagePaymentRate =
    analytics.totalExpected > 0 ? (analytics.totalCollected / analytics.totalExpected) * 100 : 0

  return analytics
}

// Enhanced payment status determination
const getPaymentStatusCategory = (student: Student, settings: AppSettings) => {
  const { totalPaid, annualFeeCalculated } = calculateStudentTotals(student, settings.billingCycle)
  const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
  const paymentRate = annualFeeCalculated > 0 ? (totalPaid / annualFeeCalculated) * 100 : 0

  if (outstanding <= 0.01) {
    return { category: "Fully Paid", priority: 5, color: "bg-green-500" }
  } else if (paymentRate >= 90) {
    return { category: "Nearly Complete", priority: 4, color: "bg-blue-500" }
  } else if (paymentRate >= 75) {
    return { category: "Good Standing", priority: 3, color: "bg-indigo-500" }
  } else if (paymentRate >= 50) {
    return { category: "Partial Payment", priority: 2, color: "bg-orange-500" }
  } else if (paymentRate >= 25) {
    return { category: "Behind Schedule", priority: 1, color: "bg-red-400" }
  } else {
    return { category: "Critical", priority: 0, color: "bg-red-600" }
  }
}

export default function ReportsPage({ students, settings, onBack }: ReportsPageProps) {
  const [selectedReportType, setSelectedReportType] = useState<string>("")
  const [selectedClassGroup, setSelectedClassGroup] = useState<string>("")
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>("")
  const [selectedPeriod, setSelectedPeriod] = useState<string>("monthly")
  const [generatedReport, setGeneratedReport] = useState<any>(null)
  const [showInAppReport, setShowInAppReport] = useState(false)

  // Enhanced analytics calculation
  const analytics = useMemo(() => calculateReportAnalytics(students, settings), [students, settings])

  // Filtered students based on current filters
  const filteredStudents = useMemo(() => {
    let filtered = [...students]

    if (selectedClassGroup) {
      filtered = filtered.filter((s) => s.classGroup === selectedClassGroup)
    }

    if (dateRange.startDate || dateRange.endDate) {
      filtered = filtered.filter((student) => {
        const admissionDate = new Date(student.admissionDate)
        const startDate = dateRange.startDate ? new Date(dateRange.startDate) : null
        const endDate = dateRange.endDate ? new Date(dateRange.endDate) : null

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
      })
    }

    if (filterStatus) {
      filtered = filtered.filter((student) => {
        const { category } = getPaymentStatusCategory(student, settings)
        return category === filterStatus
      })
    }

    return filtered
  }, [students, selectedClassGroup, dateRange, filterStatus, settings])

  const generateInAppReport = () => {
    console.log("🔍 Generate Report button clicked")
    console.log("Selected period:", selectedPeriod)
    console.log("Filtered students:", filteredStudents.length)

    if (!selectedPeriod) {
      alert("Please select a report period first")
      return
    }

    setIsGenerating(true)

    try {
      // Use current filtered students (don't filter by period again)
      const studentsToReport = filteredStudents.length > 0 ? filteredStudents : students
      console.log("Students to report:", studentsToReport.length)

      // Group students by class in ascending order
      const groupedStudents = groupStudentsByClass(studentsToReport, settings)
      console.log("Grouped students:", Object.keys(groupedStudents))

      // Calculate comprehensive data with exact format specified
      const reportData = {
        type: "comprehensive",
        period: selectedPeriod,
        generatedAt: new Date().toISOString(),
        students: groupedStudents,
        summary: calculateSchoolWideSummary(studentsToReport, settings),
        classBreakdowns: calculateClassBreakdowns(groupedStudents, settings),
        filters: {
          classGroup: selectedClassGroup,
          paymentStatus: filterStatus,
          dateRange: dateRange,
        },
      }

      console.log("Report data generated:", reportData)
      setGeneratedReport(reportData)
      setShowInAppReport(true)
      console.log("showInAppReport set to true")
    } catch (error) {
      console.error("Error generating report:", error)
      alert(`Error generating report: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsGenerating(false)
    }
  }

  const filterStudentsByPeriod = (students: Student[], period: string) => {
    const now = new Date()
    const startDate = new Date()

    switch (period) {
      case "daily":
        startDate.setDate(now.getDate() - 1)
        break
      case "3-day":
        startDate.setDate(now.getDate() - 3)
        break
      case "weekly":
        startDate.setDate(now.getDate() - 7)
        break
      case "monthly":
        startDate.setMonth(now.getMonth() - 1)
        break
      case "termly":
        startDate.setMonth(now.getMonth() - 4)
        break
      case "yearly":
        startDate.setFullYear(now.getFullYear() - 1)
        break
      default:
        return students
    }

    return students.filter((student) => {
      const admissionDate = new Date(student.admissionDate)
      return admissionDate >= startDate
    })
  }

  const groupStudentsByClass = (students: Student[], settings: AppSettings) => {
    const classOrder = [
      "ECD A",
      "ECD B",
      "Grade 1",
      "Grade 2",
      "Grade 3",
      "Grade 4",
      "Grade 5",
      "Grade 6",
      "Grade 7",
      "Form 1",
      "Form 2",
      "Form 3",
      "Form 4",
      "Form 5",
      "Form 6",
    ]

    const grouped = students.reduce(
      (acc, student) => {
        const classGroup = settings.classGroups.find((g) => g.id === student.classGroup)
        const className = classGroup?.name || "Unknown"

        if (!acc[className]) {
          acc[className] = []
        }
        acc[className].push(student)
        return acc
      },
      {} as Record<string, Student[]>,
    )

    // Sort by class order
    const sortedGroups = Object.keys(grouped)
      .sort((a, b) => {
        const indexA = classOrder.indexOf(a)
        const indexB = classOrder.indexOf(b)
        if (indexA === -1 && indexB === -1) return a.localeCompare(b)
        if (indexA === -1) return 1
        if (indexB === -1) return -1
        return indexA - indexB
      })
      .reduce(
        (acc, className) => {
          acc[className] = grouped[className]
          return acc
        },
        {} as Record<string, Student[]>,
      )

    return sortedGroups
  }

  const calculateReportSummary = (students: Student[], settings: AppSettings) => {
    let totalExpected = 0
    let totalCollected = 0
    let totalOutstanding = 0

    students.forEach((student) => {
      const totals = calculateStudentTotals(student, settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

      totalExpected += totals.annualFeeCalculated
      totalCollected += totals.totalPaid
      totalOutstanding += outstanding
    })

    return {
      totalStudents: students.length,
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    }
  }

  const exportToExcel = () => {
    if (!generatedReport) return

    // Create Excel export logic here
    const csvContent = generateCSVContent(generatedReport)
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = `${generatedReport.type}-${new Date().toISOString().split("T")[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const generateCSVContent = (reportData: any) => {
    let csv = "Class,Student Name,Expected,Paid,Outstanding,Status\n"

    Object.entries(reportData.students).forEach(([className, students]: [string, any]) => {
      students.forEach((student: Student) => {
        const totals = calculateStudentTotals(student, settings.billingCycle)
        const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
        const status = outstanding <= 0.01 ? "Paid" : totals.totalPaid > 0 ? "Partial" : "Unpaid"

        csv += `"${student.className || "Not assigned"}","${student.fullName}",${totals.annualFeeCalculated},${totals.totalPaid},${outstanding},"${status}"\n`
      })
    })

    return csv
  }

  const handleGenerateReport = async (reportType: string) => {
    setIsGenerating(true)
    try {
      const studentsToUse = filteredStudents.length > 0 ? filteredStudents : students

      switch (reportType) {
        case "comprehensive":
          await exportComprehensiveReportPDF(studentsToUse, settings)
          break

        case "outstanding":
          const result = await exportOutstandingStudentsPDF(studentsToUse, settings, (student: Student) =>
            calculateOutstandingFromEnrollment(student, settings.billingCycle),
          )
          if (!result) {
            console.warn("Outstanding PDF export returned false")
          }
          break

        case "outstanding-simple":
          const simpleResult = await exportOutstandingStudentsPDFSimple(studentsToUse, settings, (student: Student) =>
            calculateOutstandingFromEnrollment(student, settings.billingCycle),
          )
          if (!simpleResult) {
            console.warn("Simple outstanding PDF export returned false")
          }
          break

        case "class-summary":
          if (selectedClassGroup && selectedClassGroup !== "all") {
            await exportClassReportPDF(studentsToUse, selectedClassGroup, settings)
          } else {
            // Generate reports for all classes
            for (const classGroup of settings.classGroups) {
              const classStudents = studentsToUse.filter((s) => s.classGroup === classGroup.id)
              if (classStudents.length > 0) {
                await exportClassReportPDF(classStudents, classGroup.id, settings)
              }
            }
          }
          break

        case "all-students":
          await exportAllStudentsSummaryPDF(studentsToUse, settings)
          break

        case "payment-trends":
          // Show message that this is coming soon
          if (typeof window !== "undefined" && window.electronAPI) {
            await window.electronAPI.showMessage({
              type: "info",
              title: "Feature Coming Soon",
              message: "Payment trends report is under development",
              detail: "This feature will be available in the next update.",
            })
          } else {
            alert("Payment trends report is coming soon!")
          }
          break

        case "transport-report":
          // Show message that this is coming soon
          if (typeof window !== "undefined" && window.electronAPI) {
            await window.electronAPI.showMessage({
              type: "info",
              title: "Feature Coming Soon",
              message: "Transport report is under development",
              detail: "This feature will be available in the next update.",
            })
          } else {
            alert("Transport report is coming soon!")
          }
          break

        default:
          console.warn("Unknown report type:", reportType)
          if (typeof window !== "undefined" && window.electronAPI) {
            await window.electronAPI.showMessage({
              type: "error",
              title: "Unknown Report Type",
              message: `Report type "${reportType}" is not recognized`,
              detail: "Please select a valid report type.",
            })
          } else {
            alert(`Unknown report type: ${reportType}`)
          }
      }
    } catch (error) {
      console.error("Error generating report:", error)

      if (typeof window !== "undefined" && window.electronAPI) {
        await window.electronAPI.showMessage({
          type: "error",
          title: "Report Generation Failed",
          message: "An error occurred while generating the report",
          detail: error instanceof Error ? error.message : "Unknown error occurred",
        })
      } else {
        alert(`Failed to generate report: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  const clearFilters = () => {
    setSelectedClassGroup("")
    setDateRange({ startDate: "", endDate: "" })
    setFilterStatus("")
  }

  const hasActiveFilters = selectedClassGroup || dateRange.startDate || dateRange.endDate || filterStatus

  const calculateComprehensiveReportSummary = (students: Student[], settings: AppSettings) => {
    let totalExpected = 0
    let totalCollected = 0
    let totalOutstanding = 0
    let totalTransportExpected = 0
    let totalTransportPaid = 0
    let totalTransportOutstanding = 0

    students.forEach((student) => {
      const totals = calculateStudentTotals(student, settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

      totalExpected += totals.expectedToDate
      totalCollected += totals.totalPaid
      totalOutstanding += outstanding

      if (student.hasTransport) {
        totalTransportExpected += totals.transportFeesTotal || 0
        totalTransportPaid += totals.transportPaid || 0
        totalTransportOutstanding += totals.transportOutstanding || 0
      }
    })

    return {
      totalStudents: students.length,
      totalExpected,
      totalCollected,
      totalOutstanding,
      totalTransportExpected,
      totalTransportPaid,
      totalTransportOutstanding,
      collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    }
  }

  const calculateClassBreakdowns = (groupedStudents: Record<string, Student[]>, settings: AppSettings) => {
    const classBreakdowns: Record<string, any> = {}

    Object.entries(groupedStudents).forEach(([className, students]) => {
      let classExpected = 0
      let classCollected = 0
      let classOutstanding = 0
      let classTransportExpected = 0
      let classTransportPaid = 0
      let classTransportOutstanding = 0

      students.forEach((student) => {
        const totals = calculateStudentTotals(student, settings.billingCycle)
        const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

        classExpected += totals.annualFeeCalculated
        classCollected += totals.totalPaid
        classOutstanding += outstanding

        if (student.hasTransport) {
          classTransportExpected += totals.transportFeesTotal || 0
          classTransportPaid += totals.transportPaid || 0
          classTransportOutstanding += totals.transportOutstanding || 0
        }
      })

      classBreakdowns[className] = {
        studentCount: students.length,
        expected: classExpected,
        collected: classCollected,
        outstanding: classOutstanding,
        transportExpected: classTransportExpected,
        transportPaid: classTransportPaid,
        transportOutstanding: classTransportOutstanding,
        collectionRate: classExpected > 0 ? (classCollected / classExpected) * 100 : 0,
      }
    })

    return classBreakdowns
  }

  const calculateSchoolWideSummary = (students: Student[], settings: AppSettings) => {
    const totalStudents = students.length
    let totalExpected = 0
    let totalCollected = 0
    let totalOutstanding = 0

    students.forEach((student) => {
      const totals = calculateStudentTotals(student, settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

      totalExpected += totals.annualFeeCalculated
      totalCollected += totals.totalPaid
      totalOutstanding += outstanding
    })

    return {
      totalStudents,
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
    }
  }

  const exportToPDF = async () => {
    try {
      const studentsToUse = filteredStudents.length > 0 ? filteredStudents : students
      await exportComprehensiveReportPDF(studentsToUse, settings)
      alert("PDF exported successfully!")
    } catch (error) {
      console.error("PDF export error:", error)
      alert(`Error exporting PDF: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button onClick={onBack} variant="outline" className="text-purple-600 border-purple-600 hover:bg-purple-50">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-purple-800">Reports & Analytics</h1>
            <p className="text-gray-600">Generate comprehensive reports and analyze student payment data</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowAnalytics(!showAnalytics)}
            variant="outline"
            className="text-blue-600 border-blue-600 hover:bg-blue-50"
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            {showAnalytics ? "Hide" : "Show"} Analytics
          </Button>
        </div>
      </div>

      {/* Analytics Grid */}
      {showAnalytics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Payment Status Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-purple-800 flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Payment Status Breakdown
              </CardTitle>
              <CardDescription>Distribution of students by payment status</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from(analytics.paymentStatusBreakdown.entries()).map(([status, count]) => {
                  const percentage = ((count / analytics.totalStudents) * 100).toFixed(1)

                  const colorMap: Record<string, string> = {
                    'Fully Paid': 'bg-green-500',
                    'Nearly Complete': 'bg-blue-500',
                    'Good Standing': 'bg-indigo-500',
                    'Partial Payment': 'bg-orange-500',
                    'Behind Schedule': 'bg-red-400',
                    'Critical': 'bg-red-600',
                  }

                  const color = colorMap[status] || 'bg-gray-400'

                  return (
                    <div key={status} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${color}`}></div>
                        <span className="text-sm font-medium">{status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{count} students</span>
                        <Badge variant="outline" className="text-xs">
                          {percentage}%
                        </Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Class-wise Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="text-purple-800 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Class-wise Performance
              </CardTitle>
              <CardDescription>Collection rates by class groups</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from(analytics.classBreakdown.entries())
                  .sort(([, a], [, b]) => (b.collected / b.expected) * 100 - (a.collected / a.expected) * 100)
                  .slice(0, 5)
                  .map(([className, data]) => {
                    const collectionRate = data.expected > 0 ? (data.collected / data.expected) * 100 : 0

                    return (
                      <div key={className} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium">{className}</span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-600">{data.students} students</span>
                            <Badge
                              variant="outline"
                              className={`text-xs ${
                                collectionRate >= 90
                                  ? "text-green-600"
                                  : collectionRate >= 75
                                    ? "text-blue-600"
                                    : collectionRate >= 50
                                      ? "text-orange-600"
                                      : "text-red-600"
                              }`}
                            >
                              {collectionRate.toFixed(1)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              collectionRate >= 90
                                ? "bg-green-500"
                                : collectionRate >= 75
                                  ? "bg-blue-500"
                                  : collectionRate >= 50
                                    ? "bg-orange-500"
                                    : "bg-red-500"
                            }`}
                            style={{ width: `${Math.min(collectionRate, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Report Filters
          </CardTitle>
          <CardDescription>Apply filters to customize your reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="classGroup">Class Group</Label>
              <Select value={selectedClassGroup} onValueChange={setSelectedClassGroup}>
                <SelectTrigger>
                  <SelectValue placeholder="All classes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Classes</SelectItem>
                  {settings.classGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="paymentStatus">Payment Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Fully Paid">Fully Paid</SelectItem>
                  <SelectItem value="Nearly Complete">Nearly Complete</SelectItem>
                  <SelectItem value="Good Standing">Good Standing</SelectItem>
                  <SelectItem value="Partial Payment">Partial Payment</SelectItem>
                  <SelectItem value="Behind Schedule">Behind Schedule</SelectItem>
                  <SelectItem value="Critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="reportPeriod">Report Period</Label>
              <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                <SelectTrigger>
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  {REPORT_PERIODS.map((period) => (
                    <SelectItem key={period.id} value={period.id}>
                      {period.name} - {period.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="startDate">Start Date</Label>
              <Input
                id="startDate"
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
              />
            </div>

            <div>
              <Label htmlFor="endDate">End Date</Label>
              <Input
                id="endDate"
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span>Active filters:</span>
                {selectedClassGroup && (
                  <Badge variant="secondary">
                    Class: {settings.classGroups.find((g) => g.id === selectedClassGroup)?.name}
                  </Badge>
                )}
                {filterStatus && <Badge variant="secondary">Status: {filterStatus}</Badge>}
                {dateRange.startDate && (
                  <Badge variant="secondary">From: {new Date(dateRange.startDate).toLocaleDateString()}</Badge>
                )}
                {dateRange.endDate && (
                  <Badge variant="secondary">To: {new Date(dateRange.endDate).toLocaleDateString()}</Badge>
                )}
                <span className="text-purple-600 font-medium">({filteredStudents.length} students)</span>
              </div>
              <Button onClick={clearFilters} variant="outline" size="sm" className="text-red-600 border-red-300">
                <RefreshCw className="w-4 h-4 mr-1" />
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Single Report Generation Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Generate Comprehensive Report
          </CardTitle>
          <CardDescription>
            Generate detailed report with student fees, transport payments, and outstanding amounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center">
            <Button
              onClick={() => {
                console.log("Button clicked!")
                generateInAppReport()
              }}
              disabled={isGenerating || !selectedPeriod}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 text-lg"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <BarChart3 className="w-5 h-5 mr-2" />
                  Generate Report
                </>
              )}
            </Button>
            <p className="text-sm text-gray-600 mt-2">
              Report Period: {REPORT_PERIODS.find((p) => p.id === selectedPeriod)?.name} | Students:{" "}
              {hasActiveFilters ? filteredStudents.length : students.length}
            </p>
            {!selectedPeriod && <p className="text-sm text-red-600 mt-1">Please select a report period above</p>}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats for Filtered Data */}
      {hasActiveFilters && (
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-800 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Filtered Data Summary
            </CardTitle>
            <CardDescription>Statistics for currently filtered students</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-800">{filteredStudents.length}</div>
                <div className="text-sm text-gray-600">Students</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-800">
                  {formatCurrency(
                    filteredStudents.reduce((sum, student) => {
                      const { expectedToDate } = calculateStudentTotals(student, settings.billingCycle)
                      return sum + expectedToDate
                    }, 0),
                  )}
                </div>
                <div className="text-sm text-gray-600">Expected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-800">
                  {formatCurrency(
                    filteredStudents.reduce((sum, student) => {
                      const { totalPaid } = calculateStudentTotals(student, settings.billingCycle)
                      return sum + totalPaid
                    }, 0),
                  )}
                </div>
                <div className="text-sm text-gray-600">Collected</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-800">
                  {formatCurrency(
                    filteredStudents.reduce((sum, student) => {
                      return sum + calculateOutstandingFromEnrollment(student, settings.billingCycle)
                    }, 0),
                  )}
                </div>
                <div className="text-sm text-gray-600">Outstanding</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* In-App Report Display */}
      {showInAppReport && generatedReport && (
        <Card>
          <CardHeader>
            <CardTitle className="text-purple-800 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Comprehensive Financial Report
            </CardTitle>
            <CardDescription>
              Period: {REPORT_PERIODS.find((p) => p.id === generatedReport.period)?.name} | Generated:{" "}
              {new Date(generatedReport.generatedAt).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* School-wide Summary */}
            <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
              <h3 className="font-bold text-lg text-purple-800 mb-3">School-wide Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-purple-800">{generatedReport.summary.totalStudents}</div>
                  <div className="text-sm text-gray-600">Total Students</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-red-800">
                    {formatCurrency(generatedReport.summary.totalOutstanding)}
                  </div>
                  <div className="text-sm text-gray-600">Total Outstanding (School-wide)</div>
                </div>
              </div>
            </div>

            {/* Students by Class with Exact Format */}
            <div className="space-y-6 mb-6">
              {Object.entries(generatedReport.students).map(([className, students]: [string, any]) => {
                const classBreakdown = generatedReport.classBreakdowns[className]

                return (
                  <div key={className} className="border rounded-lg p-4">
                    {/* Class Header with Payments Summary */}
                    <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 rounded">
                      <h3 className="font-bold text-lg text-purple-800">{className}</h3>
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-600">
                          Students: {classBreakdown.studentCount} | Payments Summary
                        </span>
                      </div>
                    </div>

                    {/* Student Details Table with Exact Fields */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="border-b-2 bg-gray-100">
                            <th className="text-left p-3 font-semibold border">Student Name</th>
                            <th className="text-left p-3 font-semibold border">Class Name</th>
                            <th className="text-right p-3 font-semibold border">
                              Fees Paid ({settings.billingCycle === BillingCycle.MONTHLY ? "Monthly" : "Termly"})
                            </th>
                            <th className="text-right p-3 font-semibold border">Transport Paid</th>
                            <th className="text-right p-3 font-semibold border">Total Expected (Per Student)</th>
                            <th className="text-right p-3 font-semibold border">Outstanding (Per Student)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {students.map((student: Student) => {
                            const totals = calculateStudentTotals(student, settings.billingCycle)
                            const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

                            // Get transport payment details with exact format
                            const getTransportPaymentDisplay = () => {
                              if (!student.hasTransport) return "" // Blank if transport not applicable

                              const transportPayments = student.transportPayments || []
                              const skippedMonths = transportPayments.filter((p) => p.isSkipped).length
                              const totalPaid = transportPayments.reduce((sum, p) => sum + p.amountPaid, 0)

                              let display = formatCurrency(totalPaid)
                              if (skippedMonths > 0) {
                                display += ` (${skippedMonths} Skipped)` // Skipped months indicated as "Skipped"
                              }
                              return display
                            }

                            return (
                              <tr key={student.id} className="border-b hover:bg-gray-50">
                                <td className="p-3 font-medium border">{student.fullName}</td>
                                <td className="p-3 border">{student.className || "Not assigned"}</td>
                                <td className="p-3 text-right border">{formatCurrency(totals.totalPaid)}</td>
                                <td className="p-3 text-right border">{getTransportPaymentDisplay()}</td>
                                <td className="p-3 text-right border">{formatCurrency(totals.expectedToDate)}</td>
                                <td className="p-3 text-right border">
                                  <span className={outstanding > 0 ? "text-red-600 font-semibold" : "text-green-600"}>
                                    {formatCurrency(outstanding)}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Export Options */}
            <div className="flex gap-4 justify-center">
              <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
                <Download className="w-4 h-4 mr-2" />
                Export to Excel
              </Button>
              <Button onClick={exportToPDF} className="bg-red-600 hover:bg-red-700">
                <Download className="w-4 h-4 mr-2" />
                Export to PDF
              </Button>
              <Button onClick={() => setShowInAppReport(false)} variant="outline">
                Close Report
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Debug Information */}
      {process.env.NODE_ENV === "development" && (
        <div className="text-xs text-gray-500 mt-2">
          Debug: showInAppReport={showInAppReport.toString()}, generatedReport={generatedReport ? "exists" : "null"}
        </div>
      )}
    </div>
  )
}
