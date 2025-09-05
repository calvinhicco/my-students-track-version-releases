import type { Student, AppSettings } from "../types/index"
import { BillingCycle, TERMS } from "../types/index"
import { calculateStudentTotals, calculateOutstandingFromEnrollment } from "./calculations"
import { getMonthName } from "./dateUtils"
import { SchoolDataStorage } from "./storage"

export interface ReportOptions {
  reportType: "summary" | "detailed" | "outstanding" | "payments" | "class" | "transport" | "financial"
  period: "daily" | "weekly" | "monthly" | "termly" | "yearly" | "custom"
  startDate?: string
  endDate?: string
  classFilter?: string
  includeTransferred?: boolean
  format: "json" | "csv" | "html" | "pdf"
  groupBy?: "class" | "payment_status" | "outstanding" | "transport"
}

export interface ReportData {
  metadata: {
    title: string
    generatedAt: string
    period: string
    totalStudents: number
    reportType: string
    filters: Record<string, any>
  }
  summary: {
    totalExpected: number
    totalCollected: number
    totalOutstanding: number
    collectionRate: number
    studentsWithOutstanding: number
    averagePayment: number
  }
  classBreakdown: Array<{
    className: string
    classGroup: string
    studentCount: number
    totalExpected: number
    totalCollected: number
    totalOutstanding: number
    collectionRate: number
    students: Array<{
      id: string
      name: string
      totalPaid: number
      totalOwed: number
      outstandingAmount: number
      paymentStatus: string
      lastPaymentDate?: string
    }>
  }>
  transportAnalysis?: {
    totalWithTransport: number
    totalTransportRevenue: number
    averageTransportFee: number
    utilizationRate: number
  }
  paymentTrends?: Array<{
    period: string
    collected: number
    expected: number
    rate: number
  }>
  outstandingDetails?: Array<{
    studentId: string
    studentName: string
    className: string
    outstandingAmount: number
    daysPastDue: number
    lastPaymentDate?: string
    contactInfo: string
  }>
}

/**
 * Advanced Report Generator for My School Track
 * Generates comprehensive reports with multiple formats and analysis
 */
export class ReportGenerator {
  private storage: SchoolDataStorage
  private settings: AppSettings

  constructor(settings: AppSettings) {
    this.storage = new SchoolDataStorage()
    this.settings = settings
  }

  /**
   * Generate comprehensive report based on options
   */
  async generateReport(options: ReportOptions): Promise<ReportData> {
    const students = this.storage.getStudents()
    const transferredStudents = options.includeTransferred ? this.storage.getTransferredStudents() : []

    // Filter students based on criteria
    const filteredStudents = this.filterStudentsByPeriod(students, options)

    const reportData: ReportData = {
      metadata: this.generateMetadata(options, filteredStudents.length),
      summary: this.generateSummary(filteredStudents),
      classBreakdown: this.generateClassBreakdown(filteredStudents),
    }

    // Add optional sections based on report type
    if (options.reportType === "transport" || options.reportType === "detailed") {
      reportData.transportAnalysis = this.generateTransportAnalysis(filteredStudents)
    }

    if (options.reportType === "payments" || options.reportType === "detailed") {
      reportData.paymentTrends = this.generatePaymentTrends(filteredStudents)
    }

    if (options.reportType === "outstanding" || options.reportType === "detailed") {
      reportData.outstandingDetails = this.generateOutstandingDetails(filteredStudents)
    }

    return reportData
  }

  /**
   * Generate financial summary report
   */
  generateFinancialSummary(period: "monthly" | "termly" | "yearly" = "monthly"): {
    totalRevenue: number
    expectedRevenue: number
    collectionEfficiency: number
    outstandingAmount: number
    revenueByClass: Record<string, number>
    paymentTrends: Array<{ period: string; amount: number }>
    topPerformingClasses: Array<{ className: string; collectionRate: number }>
    studentsAtRisk: Array<{ name: string; outstandingAmount: number; daysPastDue: number }>
  } {
    const students = this.storage.getStudents()

    let totalRevenue = 0
    let expectedRevenue = 0
    let outstandingAmount = 0
    const revenueByClass: Record<string, number> = {}
    const classPerformance: Record<string, { collected: number; expected: number }> = {}

    students.forEach((student) => {
      const totals = calculateStudentTotals(student, this.settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

      totalRevenue += totals.totalPaid
      expectedRevenue += totals.annualFeeCalculated
      outstandingAmount += outstanding

      // Revenue by class
      if (!revenueByClass[student.className]) {
        revenueByClass[student.className] = 0
      }
      revenueByClass[student.className] += totals.totalPaid

      // Class performance tracking
      if (!classPerformance[student.className]) {
        classPerformance[student.className] = { collected: 0, expected: 0 }
      }
      classPerformance[student.className].collected += totals.totalPaid
      classPerformance[student.className].expected += totals.annualFeeCalculated
    })

    // Calculate collection efficiency
    const collectionEfficiency = expectedRevenue > 0 ? (totalRevenue / expectedRevenue) * 100 : 0

    // Generate payment trends
    const paymentTrends = this.generatePaymentTrendsData(students, period)

    // Top performing classes
    const topPerformingClasses = Object.entries(classPerformance)
      .map(([className, data]) => ({
        className,
        collectionRate: data.expected > 0 ? (data.collected / data.expected) * 100 : 0,
      }))
      .sort((a, b) => b.collectionRate - a.collectionRate)
      .slice(0, 5)

    // Students at risk (high outstanding amounts)
    const studentsAtRisk = students
      .map((student) => {
        const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
        const daysPastDue = this.calculateDaysPastDue(student)
        return {
          name: student.fullName,
          outstandingAmount: outstanding,
          daysPastDue,
        }
      })
      .filter((student) => student.outstandingAmount > 0)
      .sort((a, b) => b.outstandingAmount - a.outstandingAmount)
      .slice(0, 10)

    return {
      totalRevenue,
      expectedRevenue,
      collectionEfficiency,
      outstandingAmount,
      revenueByClass,
      paymentTrends,
      topPerformingClasses,
      studentsAtRisk,
    }
  }

  /**
   * Generate class performance report
   */
  generateClassPerformanceReport(): Array<{
    className: string
    classGroup: string
    studentCount: number
    totalExpected: number
    totalCollected: number
    collectionRate: number
    averagePayment: number
    studentsWithOutstanding: number
    transportUtilization: number
    recommendations: string[]
  }> {
    const students = this.storage.getStudents()
    const classSummary: Record<
      string,
      {
        students: Student[]
        classGroup: string
      }
    > = {}

    // Group students by class
    students.forEach((student) => {
      if (!student.isTransferred) {
        if (!classSummary[student.className]) {
          classSummary[student.className] = {
            students: [],
            classGroup: student.classGroup,
          }
        }
        classSummary[student.className].students.push(student)
      }
    })

    return Object.entries(classSummary)
      .map(([className, data]) => {
        const classStudents = data.students
        let totalExpected = 0
        let totalCollected = 0
        let studentsWithOutstanding = 0
        let studentsWithTransport = 0

        classStudents.forEach((student) => {
          const totals = calculateStudentTotals(student, this.settings.billingCycle)
          const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

          totalExpected += totals.annualFeeCalculated
          totalCollected += totals.totalPaid

          if (outstanding > 0) studentsWithOutstanding++
          if (student.hasTransport) studentsWithTransport++
        })

        const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0
        const averagePayment = classStudents.length > 0 ? totalCollected / classStudents.length : 0
        const transportUtilization = classStudents.length > 0 ? (studentsWithTransport / classStudents.length) * 100 : 0

        // Generate recommendations
        const recommendations: string[] = []
        if (collectionRate < 70) {
          recommendations.push("Implement payment reminder system")
        }
        if (studentsWithOutstanding > classStudents.length * 0.3) {
          recommendations.push("Schedule parent meetings for outstanding payments")
        }
        if (transportUtilization > 80) {
          recommendations.push("Consider expanding transport services")
        }
        if (averagePayment < (totalExpected / classStudents.length) * 0.5) {
          recommendations.push("Review payment plan options")
        }

        return {
          className,
          classGroup: data.classGroup,
          studentCount: classStudents.length,
          totalExpected,
          totalCollected,
          collectionRate,
          averagePayment,
          studentsWithOutstanding,
          transportUtilization,
          recommendations,
        }
      })
      .sort((a, b) => b.collectionRate - a.collectionRate)
  }

  /**
   * Generate outstanding payments report with action items
   */
  generateOutstandingPaymentsReport(): {
    summary: {
      totalOutstanding: number
      studentsAffected: number
      averageOutstanding: number
      oldestOutstanding: number
    }
    urgentCases: Array<{
      studentId: string
      studentName: string
      className: string
      parentContact: string
      outstandingAmount: number
      daysPastDue: number
      recommendedAction: string
    }>
    byClass: Record<
      string,
      {
        totalOutstanding: number
        studentsAffected: number
        averageOutstanding: number
      }
    >
    paymentPlan: Array<{
      studentId: string
      studentName: string
      suggestedMonthlyPayment: number
      paymentPeriods: number
    }>
  } {
    const students = this.storage.getStudents()
    let totalOutstanding = 0
    let studentsAffected = 0
    let oldestOutstanding = 0
    const urgentCases: any[] = []
    const byClass: Record<string, any> = {}
    const paymentPlan: any[] = []

    students.forEach((student) => {
      if (student.isTransferred) return

      const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
      if (outstanding > 0) {
        totalOutstanding += outstanding
        studentsAffected++

        const daysPastDue = this.calculateDaysPastDue(student)
        oldestOutstanding = Math.max(oldestOutstanding, daysPastDue)

        // Classify as urgent if outstanding > $500 or > 90 days past due
        if (outstanding > 500 || daysPastDue > 90) {
          urgentCases.push({
            studentId: student.id,
            studentName: student.fullName,
            className: student.className,
            parentContact: student.parentContact,
            outstandingAmount: outstanding,
            daysPastDue,
            recommendedAction: this.getRecommendedAction(outstanding, daysPastDue),
          })
        }

        // Group by class
        if (!byClass[student.className]) {
          byClass[student.className] = {
            totalOutstanding: 0,
            studentsAffected: 0,
            averageOutstanding: 0,
          }
        }
        byClass[student.className].totalOutstanding += outstanding
        byClass[student.className].studentsAffected++

        // Suggest payment plan
        if (outstanding > 200) {
          const suggestedMonthlyPayment = Math.ceil(outstanding / 6) // 6-month plan
          paymentPlan.push({
            studentId: student.id,
            studentName: student.fullName,
            suggestedMonthlyPayment,
            paymentPeriods: Math.ceil(outstanding / suggestedMonthlyPayment),
          })
        }
      }
    })

    // Calculate averages for each class
    Object.keys(byClass).forEach((className) => {
      const classData = byClass[className]
      classData.averageOutstanding =
        classData.studentsAffected > 0 ? classData.totalOutstanding / classData.studentsAffected : 0
    })

    return {
      summary: {
        totalOutstanding,
        studentsAffected,
        averageOutstanding: studentsAffected > 0 ? totalOutstanding / studentsAffected : 0,
        oldestOutstanding,
      },
      urgentCases: urgentCases.sort((a, b) => b.outstandingAmount - a.outstandingAmount),
      byClass,
      paymentPlan: paymentPlan.sort((a, b) => b.suggestedMonthlyPayment - a.suggestedMonthlyPayment),
    }
  }

  /**
   * Export report to different formats
   */
  async exportReport(reportData: ReportData, format: "csv" | "html" | "json"): Promise<string> {
    switch (format) {
      case "csv":
        return this.exportToCSV(reportData)
      case "html":
        return this.exportToHTML(reportData)
      case "json":
        return JSON.stringify(reportData, null, 2)
      default:
        throw new Error(`Unsupported export format: ${format}`)
    }
  }

  // Private helper methods

  private generateMetadata(options: ReportOptions, totalStudents: number) {
    return {
      title: `${options.reportType.toUpperCase()} Report - ${this.settings.schoolName}`,
      generatedAt: new Date().toISOString(),
      period: options.period,
      totalStudents,
      reportType: options.reportType,
      filters: {
        period: options.period,
        startDate: options.startDate,
        endDate: options.endDate,
        classFilter: options.classFilter,
        includeTransferred: options.includeTransferred,
      },
    }
  }

  private generateSummary(students: Student[]) {
    let totalExpected = 0
    let totalCollected = 0
    let totalOutstanding = 0
    let studentsWithOutstanding = 0

    students.forEach((student) => {
      const totals = calculateStudentTotals(student, this.settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

      totalExpected += totals.annualFeeCalculated
      totalCollected += totals.totalPaid
      totalOutstanding += outstanding

      if (outstanding > 0) studentsWithOutstanding++
    })

    return {
      totalExpected,
      totalCollected,
      totalOutstanding,
      collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
      studentsWithOutstanding,
      averagePayment: students.length > 0 ? totalCollected / students.length : 0,
    }
  }

  private generateClassBreakdown(students: Student[]) {
    const classGroups: Record<string, Student[]> = {}

    students.forEach((student) => {
      if (!classGroups[student.className]) {
        classGroups[student.className] = []
      }
      classGroups[student.className].push(student)
    })

    return Object.entries(classGroups)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([className, classStudents]) => {
      let totalExpected = 0
      let totalCollected = 0
      let totalOutstanding = 0

      const studentDetails = classStudents
        .sort((s1, s2) => s1.fullName.localeCompare(s2.fullName))
        .map((student) => {
        const totals = calculateStudentTotals(student, this.settings.billingCycle)
        const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

        totalExpected += totals.annualFeeCalculated
        totalCollected += totals.totalPaid
        totalOutstanding += outstanding

        return {
          id: student.id,
          name: student.fullName,
          totalPaid: totals.totalPaid,
          totalOwed: totals.totalOwed,
          outstandingAmount: outstanding,
          paymentStatus: this.getPaymentStatus(totals.totalPaid, totals.annualFeeCalculated, outstanding),
          lastPaymentDate: this.getLastPaymentDate(student),
        }
      })

      return {
        className,
        classGroup: classStudents[0]?.classGroup || "",
        studentCount: classStudents.length,
        totalExpected,
        totalCollected,
        totalOutstanding,
        collectionRate: totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0,
        students: studentDetails,
      }
    })
  }

  private generateTransportAnalysis(students: Student[]) {
    const studentsWithTransport = students.filter((s) => s.hasTransport)
    const totalTransportRevenue = studentsWithTransport.reduce((sum, student) => {
      const totals = calculateStudentTotals(student, this.settings.billingCycle)
      return sum + totals.transportFeesTotal
    }, 0)

    return {
      totalWithTransport: studentsWithTransport.length,
      totalTransportRevenue,
      averageTransportFee:
        studentsWithTransport.length > 0
          ? studentsWithTransport.reduce((sum, s) => sum + (s.transportFee || 0), 0) / studentsWithTransport.length
          : 0,
      utilizationRate: students.length > 0 ? (studentsWithTransport.length / students.length) * 100 : 0,
    }
  }

  private generatePaymentTrends(students: Student[]) {
    const trends: Array<{ period: string; collected: number; expected: number; rate: number }> = []

    if (this.settings.billingCycle === BillingCycle.MONTHLY) {
      for (let month = 1; month <= 12; month++) {
        let collected = 0
        let expected = 0

        students.forEach((student) => {
          const payment = student.feePayments?.find((p) => p.period === month)
          if (payment) {
            collected += payment.amountPaid
            expected += payment.amountDue
          }
        })

        trends.push({
          period: getMonthName(month),
          collected,
          expected,
          rate: expected > 0 ? (collected / expected) * 100 : 0,
        })
      }
    } else {
      TERMS.forEach((term) => {
        let collected = 0
        let expected = 0

        students.forEach((student) => {
          const payment = student.feePayments?.find((p) => p.period === term.period)
          if (payment) {
            collected += payment.amountPaid
            expected += payment.amountDue
          }
        })

        trends.push({
          period: term.name,
          collected,
          expected,
          rate: expected > 0 ? (collected / expected) * 100 : 0,
        })
      })
    }

    return trends
  }

  private generateOutstandingDetails(students: Student[]) {
    return students
      .map((student) => {
        const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
        if (outstanding <= 0) return null

        return {
          studentId: student.id,
          studentName: student.fullName,
          className: student.className,
          outstandingAmount: outstanding,
          daysPastDue: this.calculateDaysPastDue(student),
          lastPaymentDate: this.getLastPaymentDate(student),
          contactInfo: student.parentContact,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.outstandingAmount - a!.outstandingAmount) as any[]
  }

  private filterStudentsByPeriod(students: Student[], options: ReportOptions): Student[] {
    if (options.period === "custom" && options.startDate && options.endDate) {
      const startDate = new Date(options.startDate)
      const endDate = new Date(options.endDate)

      return students.filter((student) => {
        const admissionDate = new Date(student.admissionDate)
        return admissionDate >= startDate && admissionDate <= endDate
      })
    }

    if (options.classFilter) {
      return students.filter((student) => student.className === options.classFilter)
    }

    return students
  }

  private calculateDaysPastDue(student: Student): number {
    const now = new Date()
    let oldestUnpaidDate = now

    if (Array.isArray(student.feePayments)) {
      student.feePayments.forEach((payment) => {
        if (!payment.paid && payment.outstandingAmount > 0) {
          const dueDate = new Date(payment.dueDate)
          if (dueDate < oldestUnpaidDate) {
            oldestUnpaidDate = dueDate
          }
        }
      })
    }

    return oldestUnpaidDate < now ? Math.floor((now.getTime() - oldestUnpaidDate.getTime()) / (1000 * 60 * 60 * 24)) : 0
  }

  private getPaymentStatus(totalPaid: number, totalExpected: number, outstanding: number): string {
    if (totalExpected === 0) return "No Fees"
    if (outstanding <= 0.01) return "Paid in Full"
    if (totalPaid > 0) return "Partial Payment"
    return "Unpaid"
  }

  private getLastPaymentDate(student: Student): string | undefined {
    if (!Array.isArray(student.feePayments)) return undefined

    const paidPayments = student.feePayments
      .filter((p) => p.paid && p.paidDate)
      .sort((a, b) => new Date(b.paidDate!).getTime() - new Date(a.paidDate!).getTime())

    return paidPayments[0]?.paidDate
  }

  private getRecommendedAction(outstanding: number, daysPastDue: number): string {
    if (daysPastDue > 180) return "Consider suspension pending payment"
    if (daysPastDue > 120) return "Schedule urgent parent meeting"
    if (daysPastDue > 90) return "Send final notice"
    if (daysPastDue > 60) return "Phone call to parent"
    if (outstanding > 1000) return "Arrange payment plan"
    return "Send payment reminder"
  }

  private generatePaymentTrendsData(
    students: Student[],
    period: "monthly" | "termly" | "yearly",
  ): Array<{ period: string; amount: number }> {
    const trends: Array<{ period: string; amount: number }> = []

    if (period === "monthly") {
      for (let month = 1; month <= 12; month++) {
        let amount = 0
        students.forEach((student) => {
          const payment = student.feePayments?.find((p) => p.period === month)
          if (payment) amount += payment.amountPaid
        })
        trends.push({ period: getMonthName(month), amount })
      }
    }

    return trends
  }

  private exportToCSV(reportData: ReportData): string {
    const lines: string[] = []

    // Header
    lines.push(`"${reportData.metadata.title}"`)
    lines.push(`"Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}"`)
    lines.push("")

    // Summary
    lines.push("SUMMARY")
    lines.push("Total Expected,Total Collected,Total Outstanding,Collection Rate")
    lines.push(
      `${reportData.summary.totalExpected},${reportData.summary.totalCollected},${reportData.summary.totalOutstanding},${reportData.summary.collectionRate.toFixed(2)}%`,
    )
    lines.push("")

    // Class breakdown
    lines.push("CLASS BREAKDOWN")
    lines.push("Class Name,Student Count,Total Expected,Total Collected,Collection Rate")
    reportData.classBreakdown.forEach((classData) => {
      lines.push(
        `"${classData.className}",${classData.studentCount},${classData.totalExpected},${classData.totalCollected},${classData.collectionRate.toFixed(2)}%`,
      )
    })

    return lines.join("\n")
  }

  private exportToHTML(reportData: ReportData): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${reportData.metadata.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .metric { background: white; padding: 15px; border: 1px solid #dee2e6; border-radius: 8px; text-align: center; }
        .metric-value { font-size: 24px; font-weight: bold; color: #495057; }
        .metric-label { color: #6c757d; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #f8f9fa; font-weight: 600; }
        .text-success { color: #28a745; }
        .text-warning { color: #ffc107; }
        .text-danger { color: #dc3545; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${reportData.metadata.title}</h1>
        <p>Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}</p>
        <p>Total Students: ${reportData.metadata.totalStudents}</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <div class="metric-value">$${reportData.summary.totalExpected.toLocaleString()}</div>
            <div class="metric-label">Total Expected</div>
        </div>
        <div class="metric">
            <div class="metric-value">$${reportData.summary.totalCollected.toLocaleString()}</div>
            <div class="metric-label">Total Collected</div>
        </div>
        <div class="metric">
            <div class="metric-value">$${reportData.summary.totalOutstanding.toLocaleString()}</div>
            <div class="metric-label">Total Outstanding</div>
        </div>
        <div class="metric">
            <div class="metric-value">${reportData.summary.collectionRate.toFixed(1)}%</div>
            <div class="metric-label">Collection Rate</div>
        </div>
    </div>
    
    <h2>Class Breakdown</h2>
    <table>
        <thead>
            <tr>
                <th>Class Name</th>
                <th>Students</th>
                <th>Expected</th>
                <th>Collected</th>
                <th>Outstanding</th>
                <th>Collection Rate</th>
            </tr>
        </thead>
        <tbody>
            ${reportData.classBreakdown
              .map(
                (classData) => `
                <tr>
                    <td>${classData.className}</td>
                    <td>${classData.studentCount}</td>
                    <td>$${classData.totalExpected.toLocaleString()}</td>
                    <td>$${classData.totalCollected.toLocaleString()}</td>
                    <td>$${classData.totalOutstanding.toLocaleString()}</td>
                    <td class="${classData.collectionRate >= 80 ? "text-success" : classData.collectionRate >= 60 ? "text-warning" : "text-danger"}">
                        ${classData.collectionRate.toFixed(1)}%
                    </td>
                </tr>
            `,
              )
              .join("")}
        </tbody>
    </table>
</body>
</html>
    `
  }
}

export default ReportGenerator
