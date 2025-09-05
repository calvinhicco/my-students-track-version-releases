"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import type { Student, AppSettings } from "../types/index"
import {
  calculateAdvancedStudentTotals,
  createPaymentPlan,
  type FlexibleFeeStructure,
} from "../lib/advancedCalculations"
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Calculator,
  CreditCard,
  Target,
  ArrowLeft,
  Plus,
  Calendar,
  Users,
  BarChart3,
} from "lucide-react"

interface AdvancedFeeManagementProps {
  students: Student[]
  settings: AppSettings
  onBack: () => void
  onUpdateStudent: (student: Student) => void
}

export default function AdvancedFeeManagement({
  students,
  settings,
  onBack,
  onUpdateStudent,
}: AdvancedFeeManagementProps) {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [activeTab, setActiveTab] = useState<"overview" | "analysis" | "payment-plans" | "adjustments">("overview")
  const [showCreatePaymentPlan, setShowCreatePaymentPlan] = useState(false)
  const [paymentPlanData, setPaymentPlanData] = useState({
    monthlyAmount: 0,
    startDate: new Date().toISOString().split("T")[0],
    notes: "",
  })
  const [feeAdjustments, setFeeAdjustments] = useState<FlexibleFeeStructure>({
    baseAmount: 0,
    discounts: [],
    penalties: [],
    adjustments: [],
    finalAmount: 0,
  })

  // Calculate advanced totals for all students
  const studentAnalytics = useMemo(() => {
    return students.map((student) => ({
      student,
      analytics: calculateAdvancedStudentTotals(student, settings.billingCycle, settings),
    }))
  }, [students, settings])

  // Overall statistics
  const overallStats = useMemo(() => {
    const stats = {
      totalStudents: students.length,
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      averageCompletionRate: 0,
      riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 },
      criticalCases: 0,
      averageConsistencyScore: 0,
    }

    let totalCompletionRate = 0
    let totalConsistencyScore = 0

    studentAnalytics.forEach(({ analytics }) => {
      stats.totalExpected += analytics.annualFeeCalculated
      stats.totalCollected += analytics.totalPaid
      stats.totalOutstanding += analytics.totalOwed
      totalCompletionRate += (analytics.schoolFees.completionRate + analytics.transport.completionRate) / 2
      totalConsistencyScore += analytics.paymentHistory.consistencyScore
      stats.riskDistribution[analytics.projections.riskLevel]++

      if (analytics.outstandingAnalysis.criticalityScore > 60) {
        stats.criticalCases++
      }
    })

    stats.averageCompletionRate = students.length > 0 ? totalCompletionRate / students.length : 0
    stats.averageConsistencyScore = students.length > 0 ? totalConsistencyScore / students.length : 0

    return stats
  }, [studentAnalytics, students.length])

  const selectedStudentAnalytics = selectedStudent
    ? calculateAdvancedStudentTotals(selectedStudent, settings.billingCycle, settings)
    : null

  const handleCreatePaymentPlan = () => {
    if (!selectedStudent || !selectedStudentAnalytics) return

    const plan = createPaymentPlan(
      selectedStudent.id,
      selectedStudentAnalytics.totalOwed,
      paymentPlanData.monthlyAmount,
      paymentPlanData.startDate,
      paymentPlanData.notes,
    )

    // In a real implementation, you would save this plan to the database
    console.log("Created payment plan:", plan)
    alert("Payment plan created successfully!")
    setShowCreatePaymentPlan(false)
  }

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "low":
        return "text-green-600 bg-green-50"
      case "medium":
        return "text-yellow-600 bg-yellow-50"
      case "high":
        return "text-orange-600 bg-orange-50"
      case "critical":
        return "text-red-600 bg-red-50"
      default:
        return "text-gray-600 bg-gray-50"
    }
  }

  const getCriticalityColor = (score: number) => {
    if (score > 80) return "text-red-600"
    if (score > 60) return "text-orange-600"
    if (score > 40) return "text-yellow-600"
    return "text-green-600"
  }

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-purple-800">Advanced Fee Management</h1>
              <p className="text-sm text-gray-600">Comprehensive fee analysis and payment management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-purple-700">
              {students.length} Students
            </Badge>
            <Badge variant="default" className="bg-green-600">
              ${overallStats.totalCollected.toLocaleString()} Collected
            </Badge>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Student List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-purple-800 flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Students
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-96 overflow-y-auto">
                  {studentAnalytics.map(({ student, analytics }) => (
                    <div
                      key={student.id}
                      onClick={() => setSelectedStudent(student)}
                      className={`p-3 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                        selectedStudent?.id === student.id ? "bg-purple-50 border-purple-200" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{student.fullName}</p>
                          <p className="text-xs text-gray-500">{student.className}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge
                            variant="outline"
                            className={`text-xs ${getRiskColor(analytics.projections.riskLevel)}`}
                          >
                            {analytics.projections.riskLevel.toUpperCase()}
                          </Badge>
                          <span className="text-xs font-medium">${analytics.totalOwed.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* Mini progress bar */}
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-1">
                          <div
                            className="bg-purple-600 h-1 rounded-full"
                            style={{
                              width: `${Math.min(100, (analytics.schoolFees.completionRate + analytics.transport.completionRate) / 2)}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Overall Statistics */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="text-purple-800 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="text-center p-2 bg-blue-50 rounded">
                    <p className="font-bold text-blue-800">${overallStats.totalExpected.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Expected</p>
                  </div>
                  <div className="text-center p-2 bg-green-50 rounded">
                    <p className="font-bold text-green-800">${overallStats.totalCollected.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Collected</p>
                  </div>
                  <div className="text-center p-2 bg-red-50 rounded">
                    <p className="font-bold text-red-800">${overallStats.totalOutstanding.toLocaleString()}</p>
                    <p className="text-xs text-gray-600">Outstanding</p>
                  </div>
                  <div className="text-center p-2 bg-orange-50 rounded">
                    <p className="font-bold text-orange-800">{overallStats.criticalCases}</p>
                    <p className="text-xs text-gray-600">Critical</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-600 mb-1">Risk Distribution</p>
                  <div className="space-y-1">
                    {Object.entries(overallStats.riskDistribution).map(([risk, count]) => (
                      <div key={risk} className="flex justify-between text-xs">
                        <span className="capitalize">{risk}:</span>
                        <span className="font-medium">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedStudent && selectedStudentAnalytics ? (
              <div className="space-y-6">
                {/* Student Header */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl text-purple-800">{selectedStudent.fullName}</CardTitle>
                        <p className="text-sm text-gray-600">
                          {selectedStudent.className} • ID: {selectedStudent.id}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={getRiskColor(selectedStudentAnalytics.projections.riskLevel)}
                        >
                          {selectedStudentAnalytics.projections.riskLevel.toUpperCase()} RISK
                        </Badge>
                        <Badge variant="default" className="bg-purple-600">
                          {selectedStudentAnalytics.projections.collectionProbability}% Collection Probability
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                </Card>

                {/* Tab Navigation */}
                <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
                  {[
                    { id: "overview", label: "Overview", icon: BarChart3 },
                    { id: "analysis", label: "Analysis", icon: TrendingUp },
                    { id: "payment-plans", label: "Payment Plans", icon: CreditCard },
                    { id: "adjustments", label: "Adjustments", icon: Calculator },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-white text-purple-700 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      <tab.icon className="w-4 h-4" />
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab Content */}
                {activeTab === "overview" && (
                  <div className="space-y-6">
                    {/* Financial Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <DollarSign className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-blue-800">
                          ${selectedStudentAnalytics.annualFeeCalculated.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Annual Expected</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-green-800">
                          ${selectedStudentAnalytics.totalPaid.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Total Paid</p>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <AlertTriangle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-red-800">
                          ${selectedStudentAnalytics.totalOwed.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">Outstanding</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <Target className="w-8 h-8 text-purple-600 mx-auto mb-2" />
                        <p className="text-2xl font-bold text-purple-800">
                          {(
                            (selectedStudentAnalytics.schoolFees.completionRate +
                              selectedStudentAnalytics.transport.completionRate) /
                            2
                          ).toFixed(1)}
                          %
                        </p>
                        <p className="text-sm text-gray-600">Completion Rate</p>
                      </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* School Fees */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">School Fees</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="flex justify-between">
                            <span>Total Expected:</span>
                            <span className="font-medium">
                              ${selectedStudentAnalytics.schoolFees.total.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Amount Paid:</span>
                            <span className="font-medium text-green-600">
                              ${selectedStudentAnalytics.schoolFees.paid.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Outstanding:</span>
                            <span className="font-medium text-red-600">
                              ${selectedStudentAnalytics.schoolFees.outstanding.toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Periods Owed:</span>
                            <span className="font-medium">{selectedStudentAnalytics.schoolFees.periodsOwed}</span>
                          </div>
                          <div className="mt-3">
                            <div className="flex justify-between text-sm mb-1">
                              <span>Completion Rate</span>
                              <span>{selectedStudentAnalytics.schoolFees.completionRate.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(100, selectedStudentAnalytics.schoolFees.completionRate)}%`,
                                }}
                              ></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Transport Fees */}
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">Transport Fees</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {selectedStudent.hasTransport ? (
                            <>
                              <div className="flex justify-between">
                                <span>Total Expected:</span>
                                <span className="font-medium">
                                  ${selectedStudentAnalytics.transport.total.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Amount Paid:</span>
                                <span className="font-medium text-green-600">
                                  ${selectedStudentAnalytics.transport.paid.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Outstanding:</span>
                                <span className="font-medium text-red-600">
                                  ${selectedStudentAnalytics.transport.outstanding.toLocaleString()}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Active Months:</span>
                                <span className="font-medium">{selectedStudentAnalytics.transport.monthsActive}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Skipped Months:</span>
                                <span className="font-medium text-orange-600">
                                  {selectedStudentAnalytics.transport.monthsSkipped}
                                </span>
                              </div>
                              <div className="mt-3">
                                <div className="flex justify-between text-sm mb-1">
                                  <span>Completion Rate</span>
                                  <span>{selectedStudentAnalytics.transport.completionRate.toFixed(1)}%</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-2">
                                  <div
                                    className="bg-green-600 h-2 rounded-full"
                                    style={{
                                      width: `${Math.min(100, selectedStudentAnalytics.transport.completionRate)}%`,
                                    }}
                                  ></div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <p className="text-gray-500 text-center py-4">No transport service</p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                )}

                {activeTab === "analysis" && (
                  <div className="space-y-6">
                    {/* Payment History Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Payment History Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span>Total Payments:</span>
                              <span className="font-medium">
                                {selectedStudentAnalytics.paymentHistory.totalPayments}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Average Payment:</span>
                              <span className="font-medium">
                                ${selectedStudentAnalytics.paymentHistory.averagePaymentAmount.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Payment Frequency:</span>
                              <span className="font-medium">
                                {selectedStudentAnalytics.paymentHistory.paymentFrequency.toFixed(2)}/month
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Last Payment:</span>
                              <span className="font-medium">
                                {selectedStudentAnalytics.paymentHistory.lastPaymentDate
                                  ? new Date(
                                      selectedStudentAnalytics.paymentHistory.lastPaymentDate,
                                    ).toLocaleDateString()
                                  : "No payments"}
                              </span>
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-sm mb-1">
                              <span>Consistency Score</span>
                              <span>{selectedStudentAnalytics.paymentHistory.consistencyScore.toFixed(1)}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                              <div
                                className={`h-3 rounded-full ${
                                  selectedStudentAnalytics.paymentHistory.consistencyScore > 70
                                    ? "bg-green-600"
                                    : selectedStudentAnalytics.paymentHistory.consistencyScore > 40
                                      ? "bg-yellow-600"
                                      : "bg-red-600"
                                }`}
                                style={{
                                  width: `${Math.min(100, selectedStudentAnalytics.paymentHistory.consistencyScore)}%`,
                                }}
                              ></div>
                            </div>
                            <p className="text-xs text-gray-600 mt-1">
                              {selectedStudentAnalytics.paymentHistory.consistencyScore > 70
                                ? "Excellent payment consistency"
                                : selectedStudentAnalytics.paymentHistory.consistencyScore > 40
                                  ? "Moderate payment consistency"
                                  : "Poor payment consistency"}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Outstanding Analysis */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Outstanding Payment Analysis</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <div className="flex justify-between">
                              <span>Days Past Due:</span>
                              <span className="font-medium text-red-600">
                                {selectedStudentAnalytics.outstandingAnalysis.daysPastDue}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Oldest Unpaid Period:</span>
                              <span className="font-medium">
                                {selectedStudentAnalytics.outstandingAnalysis.oldestUnpaidPeriod || "None"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Criticality Score:</span>
                              <span
                                className={`font-medium ${getCriticalityColor(selectedStudentAnalytics.outstandingAnalysis.criticalityScore)}`}
                              >
                                {selectedStudentAnalytics.outstandingAnalysis.criticalityScore.toFixed(1)}/100
                              </span>
                            </div>
                            <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                              <p className="text-sm font-medium text-yellow-800">Recommended Action:</p>
                              <p className="text-sm text-yellow-700">
                                {selectedStudentAnalytics.outstandingAnalysis.recommendedAction}
                              </p>
                            </div>
                          </div>
                          <div>
                            <h4 className="font-medium mb-3">Suggested Payment Plan</h4>
                            <div className="space-y-2 text-sm">
                              <div className="flex justify-between">
                                <span>Monthly Amount:</span>
                                <span className="font-medium">
                                  ${selectedStudentAnalytics.outstandingAnalysis.paymentPlan.suggestedMonthlyAmount}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Number of Months:</span>
                                <span className="font-medium">
                                  {selectedStudentAnalytics.outstandingAnalysis.paymentPlan.numberOfMonths}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span>Total Amount:</span>
                                <span className="font-medium">
                                  $
                                  {selectedStudentAnalytics.outstandingAnalysis.paymentPlan.totalAmount.toLocaleString()}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Projections */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Payment Projections</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="text-center p-4 bg-blue-50 rounded-lg">
                            <DollarSign className="w-6 h-6 text-blue-600 mx-auto mb-2" />
                            <p className="text-lg font-bold text-blue-800">
                              ${selectedStudentAnalytics.projections.expectedAnnualTotal.toLocaleString()}
                            </p>
                            <p className="text-sm text-gray-600">Expected Annual Total</p>
                          </div>
                          <div className="text-center p-4 bg-green-50 rounded-lg">
                            <Calendar className="w-6 h-6 text-green-600 mx-auto mb-2" />
                            <p className="text-lg font-bold text-green-800">
                              {selectedStudentAnalytics.projections.projectedCompletionDate
                                ? new Date(
                                    selectedStudentAnalytics.projections.projectedCompletionDate,
                                  ).toLocaleDateString()
                                : "N/A"}
                            </p>
                            <p className="text-sm text-gray-600">Projected Completion</p>
                          </div>
                          <div className="text-center p-4 bg-purple-50 rounded-lg">
                            <Target className="w-6 h-6 text-purple-600 mx-auto mb-2" />
                            <p className="text-lg font-bold text-purple-800">
                              {selectedStudentAnalytics.projections.collectionProbability}%
                            </p>
                            <p className="text-sm text-gray-600">Collection Probability</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "payment-plans" && (
                  <div className="space-y-6">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Payment Plans</h3>
                      <Button
                        onClick={() => setShowCreatePaymentPlan(true)}
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={selectedStudentAnalytics.totalOwed <= 0}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Payment Plan
                      </Button>
                    </div>

                    {showCreatePaymentPlan && (
                      <Card>
                        <CardHeader>
                          <CardTitle>Create Payment Plan</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="monthlyAmount">Monthly Payment Amount</Label>
                              <Input
                                id="monthlyAmount"
                                type="number"
                                value={paymentPlanData.monthlyAmount}
                                onChange={(e) =>
                                  setPaymentPlanData((prev) => ({
                                    ...prev,
                                    monthlyAmount: Number(e.target.value),
                                  }))
                                }
                                placeholder="Enter monthly amount"
                              />
                              <p className="text-xs text-gray-600 mt-1">
                                Suggested: $
                                {selectedStudentAnalytics.outstandingAnalysis.paymentPlan.suggestedMonthlyAmount}
                              </p>
                            </div>
                            <div>
                              <Label htmlFor="startDate">Start Date</Label>
                              <Input
                                id="startDate"
                                type="date"
                                value={paymentPlanData.startDate}
                                onChange={(e) =>
                                  setPaymentPlanData((prev) => ({
                                    ...prev,
                                    startDate: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              value={paymentPlanData.notes}
                              onChange={(e) =>
                                setPaymentPlanData((prev) => ({
                                  ...prev,
                                  notes: e.target.value,
                                }))
                              }
                              placeholder="Add any notes about the payment plan..."
                              rows={3}
                            />
                          </div>

                          {paymentPlanData.monthlyAmount > 0 && (
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <h4 className="font-medium mb-2">Payment Plan Summary</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-600">Total Outstanding:</span>
                                  <span className="font-medium ml-2">
                                    ${selectedStudentAnalytics.totalOwed.toLocaleString()}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Monthly Payment:</span>
                                  <span className="font-medium ml-2">${paymentPlanData.monthlyAmount}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Number of Payments:</span>
                                  <span className="font-medium ml-2">
                                    {Math.ceil(selectedStudentAnalytics.totalOwed / paymentPlanData.monthlyAmount)}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600">Completion Date:</span>
                                  <span className="font-medium ml-2">
                                    {(() => {
                                      const months = Math.ceil(
                                        selectedStudentAnalytics.totalOwed / paymentPlanData.monthlyAmount,
                                      )
                                      const completionDate = new Date(paymentPlanData.startDate)
                                      completionDate.setMonth(completionDate.getMonth() + months)
                                      return completionDate.toLocaleDateString()
                                    })()}
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button
                              onClick={handleCreatePaymentPlan}
                              className="bg-green-600 hover:bg-green-700"
                              disabled={paymentPlanData.monthlyAmount <= 0}
                            >
                              Create Plan
                            </Button>
                            <Button onClick={() => setShowCreatePaymentPlan(false)} variant="outline">
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Existing payment plans would be displayed here */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Existing Payment Plans</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-500 text-center py-4">No payment plans created yet</p>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {activeTab === "adjustments" && (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Fee Adjustments</CardTitle>
                        <p className="text-sm text-gray-600">
                          Apply discounts, penalties, or other adjustments to student fees
                        </p>
                      </CardHeader>
                      <CardContent>
                        <p className="text-gray-500 text-center py-8">
                          Fee adjustment functionality will be implemented in the next update. This will include
                          discounts, penalties, late fees, and custom adjustments.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <Calculator className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-600 mb-2">Select a Student</h3>
                  <p className="text-gray-500">
                    Choose a student from the list to view advanced fee management options
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
