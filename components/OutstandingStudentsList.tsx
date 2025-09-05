"use client"

import type React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import type { Student, AppSettings } from "../types"
import { BillingCycle } from "../types"
import { AlertCircle, DollarSign, User, Phone, FileText } from "lucide-react"
import { useState } from "react"
import { exportOutstandingStudentsToPDF } from "@/lib/pdfUtils"

interface OutstandingStudentsListProps {
  students: Student[]
  onSelectStudent: (student: Student) => void
  calculateOutstanding: (student: Student) => number
  getPaymentStatus: (student: Student) => {
    status: string
    color: string
    icon: React.ElementType
  }
  settings: AppSettings
}

export default function OutstandingStudentsList({
  students,
  onSelectStudent,
  calculateOutstanding,
  getPaymentStatus,
  settings,
}: OutstandingStudentsListProps) {
  const totalOutstanding = Array.isArray(students)
    ? students.reduce((sum, student) => sum + calculateOutstanding(student), 0)
    : 0
  const [isExporting, setIsExporting] = useState(false)

  const handleExportPDF = async () => {
    if (!Array.isArray(students) || students.length === 0) {
      console.warn("No student data to export for outstanding PDF.")
      return
    }
    
    setIsExporting(true)
    try {
      // Get the last payment date for each student
      const studentsWithPayments = students.map(student => {
        const lastPayment = student.feePayments
          ?.filter(p => p.paid && p.paidDate)
          .sort((a, b) => new Date(b.paidDate || 0).getTime() - new Date(a.paidDate || 0).getTime())[0];
          
        return {
          id: student.id,
          fullName: student.fullName,
          className: student.className,
          parentContact: student.parentContact,
          outstandingAmount: calculateOutstanding(student),
          lastPaymentDate: lastPayment?.paidDate,
          paymentStatus: getPaymentStatus(student).status
        };
      });

      await exportOutstandingStudentsToPDF(
        studentsWithPayments,
        totalOutstanding,
        {
          schoolName: settings.schoolName,
          currency: 'USD' // Set currency to US Dollar
        }
      );
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-2xl font-bold text-purple-800 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Students with Outstanding Payments
          </CardTitle>
          <Button
            onClick={handleExportPDF}
            disabled={isExporting || !Array.isArray(students) || students.length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isExporting ? (
              <span className="flex items-center">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                Exporting...
              </span>
            ) : (
              "Export Outstanding Report (PDF)"
            )}
          </Button>
        </CardHeader>

        <CardContent>
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="text-center">
              <h3 className="text-lg font-semibold text-red-800 mb-2">Total Outstanding Summary</h3>
              <div className="text-3xl font-bold text-red-600 mb-2">${totalOutstanding.toLocaleString()}</div>
              <p className="text-sm text-red-700">
                Across {Array.isArray(students) ? students.length : 0} students with outstanding payments
              </p>
              <p className="text-xs text-red-600 mt-1">
                Outstanding amounts calculated from enrollment date to current date
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {!Array.isArray(students) || students.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 text-lg">No students with outstanding payments found.</p>
                <p className="text-sm text-gray-400 mt-2">All students are up to date with their payments!</p>
              </div>
            ) : (
              students
                .sort((a, b) => calculateOutstanding(b) - calculateOutstanding(a))
                .map((student) => {
                  const { status, icon: StatusIcon } = getPaymentStatus(student)
                  const outstandingAmount = calculateOutstanding(student)

                  // Find class group for display
                  const classGroup = Array.isArray(settings.classGroups)
                    ? settings.classGroups.find((g) => g.id === student.classGroup)
                    : null

                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                      onClick={() => onSelectStudent(student)}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0">
                          <User className="w-8 h-8 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-lg text-gray-900 truncate">{student.fullName}</h3>
                          <div className="flex items-center gap-4 text-sm text-gray-600 mt-1">
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {student.parentContact}
                            </span>
                            <span className="flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              {student.className || "No class assigned"}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                            <span>Class Group: {classGroup?.name || "Unassigned"}</span>
                            <span>Student ID: {student.id}</span>
                            <span>Admitted: {new Date(student.admissionDate).toLocaleDateString()}</span>
                          </div>
                          {student.hasTransport && (
                            <div className="text-xs text-orange-600 mt-1">
                              Transport Service Active (${student.transportFee}/
                              {settings.billingCycle === BillingCycle.MONTHLY ? "month" : "term"})
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="flex items-center gap-1 text-lg font-bold text-red-600">
                            <DollarSign className="w-4 h-4" />
                            {outstandingAmount.toLocaleString()}
                          </div>
                          <p className="text-xs text-gray-600">outstanding since enrollment</p>
                          <p className="text-xs text-red-500 font-medium">
                            {settings.billingCycle === BillingCycle.MONTHLY ? "Monthly" : "Termly"} billing
                          </p>
                        </div>

                        <Badge
                          variant={
                            status === "Paid in Full"
                              ? "default"
                              : status === "Partial Payment"
                                ? "outline"
                                : "destructive"
                          }
                          className="flex items-center gap-1"
                        >
                          <StatusIcon className="w-3 h-3" />
                          {status}
                        </Badge>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            onSelectStudent(student)
                          }}
                          className="text-purple-600 border-purple-600 hover:bg-purple-50"
                        >
                          View Details
                        </Button>
                      </div>
                    </div>
                  )
                })
            )}
          </div>

          {Array.isArray(students) && students.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">Outstanding Payment Notes:</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Outstanding amounts are calculated from each student's enrollment date</li>
                <li>• Only past due payments are included (not future months/terms)</li>
                <li>• Transport fees are billed separately on the 7th of each month</li>
                <li>• Click "View Details" to make payments or manage transport waivers</li>
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
