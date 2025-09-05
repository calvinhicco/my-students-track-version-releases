"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

import type { Student, AppSettings } from "../types/index"
import { BillingCycle, TERMS } from "../types/index"
import { calculateStudentTotals } from "../lib/calculations"
import { calculateTransportOutstanding } from "../lib/transportUtils"

import {
  User,
  Phone,
  Calendar,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Clock,
  Car,
  UserX,
  Eye,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

interface EnhancedStudentCardProps {
  student: Student
  settings: AppSettings
  onSelect: (student: Student) => void
  onTransfer: (student: Student) => void
  viewMode: "cards" | "table" | "compact"
  showQuickActions?: boolean
}

export default function EnhancedStudentCard({
  student,
  settings,
  onSelect,
  onTransfer,
  viewMode,
  showQuickActions = true,
}: EnhancedStudentCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const studentWithGuardedFeePayments = {
    ...student,
    feePayments: Array.isArray(student.feePayments) ? student.feePayments : [],
  }

  const { totalPaid, annualFeeCalculated, schoolFeesTotal, schoolFeesOutstanding } = calculateStudentTotals(
    studentWithGuardedFeePayments,
    settings.billingCycle,
  )

  const schoolFeesPaid = Math.max(0, schoolFeesTotal - schoolFeesOutstanding)

  // Tuition expected up to today (exclude transport & future)
  const currentDate = new Date()
  let tuitionDueToDate = 0
  if (Array.isArray(student.feePayments)) {
    const currentYear = currentDate.getFullYear()
    student.feePayments.forEach((payment) => {
      // period start
      let periodStart: Date | null = null
      if (settings.billingCycle === BillingCycle.MONTHLY) {
        periodStart = new Date(currentYear, payment.period - 1, 1)
      } else {
        const term = TERMS.find((t) => t.period === payment.period)
        if (term) periodStart = new Date(currentYear, term.months[0] - 1, 1)
      }
      if (!periodStart || periodStart > currentDate) return
      const transportPart = student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0
      const tuitionComponent = Math.max(0, payment.amountDue - transportPart)
      tuitionDueToDate += tuitionComponent
    })
  }

  // Transport due up to today
  const transportDueToDate = student.hasTransport
    ? calculateTransportOutstanding({
        ...student,
        transportPayments:
          student.transportPayments?.map((p) => ({ ...p, outstandingAmount: p.amountDue })) || [],
      })
    : 0

  const expectedToDate = tuitionDueToDate + transportDueToDate
  const outstandingBalance = Math.max(0, expectedToDate - totalPaid)

  

  
  const classGroup = (Array.isArray(settings.classGroups) ? settings.classGroups : []).find(
    (g) => g.id === student.classGroup,
  )

  const getPaymentStatus = () => {
    if (outstandingBalance <= 0.01) {
      return { status: "Paid in Full", color: "bg-green-500", textColor: "text-green-700", icon: CheckCircle }
    } else if (totalPaid > 0 && outstandingBalance > 0.01) {
      return { status: "Partial Payment", color: "bg-orange-500", textColor: "text-orange-700", icon: AlertCircle }
    } else {
      return { status: "Outstanding", color: "bg-red-500", textColor: "text-red-700", icon: AlertCircle }
    }
    return { status: "Pending", color: "bg-gray-500", textColor: "text-gray-600", icon: Clock }
  }

  const paymentStatus = getPaymentStatus()
  const StatusIcon = paymentStatus.icon

  const getPaymentTrend = () => {
    // Simple trend calculation based on recent payments
    const recentPayments = student.feePayments?.slice(-3) || []
    const totalRecentPaid = recentPayments.reduce((sum, p) => sum + p.amountPaid, 0)
    const totalRecentDue = recentPayments.reduce((sum, p) => sum + p.amountDue, 0)

    if (totalRecentDue === 0) return null
    const recentRate = (totalRecentPaid / totalRecentDue) * 100

    return recentRate >= 80 ? "up" : recentRate <= 30 ? "down" : "stable"
  }

  const paymentTrend = getPaymentTrend()

  if (viewMode === "compact") {
    return (
      <div
        className="flex items-center justify-between p-3 border-b hover:bg-purple-50 cursor-pointer transition-colors"
        onClick={() => onSelect(student)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="flex items-center gap-3 flex-1">
          <div className={`w-3 h-3 rounded-full ${paymentStatus.color}`}></div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-900">{student.fullName}</span>
              {student.hasTransport && <Car className="w-3 h-3 text-orange-500" />}
              {paymentTrend === "up" && <TrendingUp className="w-3 h-3 text-green-500" />}
              {paymentTrend === "down" && <TrendingDown className="w-3 h-3 text-red-500" />}
            </div>
            <div className="text-xs text-gray-500">
              {student.className} • {student.parentContact}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm font-medium">
              ${totalPaid.toLocaleString()} / ${annualFeeCalculated.toLocaleString()}
            </div>
          </div>

          {outstandingBalance > 0.01 && (
            <div className="text-right">
              <div className="text-sm font-medium text-red-600">-${outstandingBalance.toLocaleString()}</div>
              <div className="text-xs text-gray-500">outstanding</div>
            </div>
          )}

          <Badge variant={paymentStatus.status === "Paid in Full" ? "default" : "destructive"} className="text-xs">
            <StatusIcon className="w-3 h-3 mr-1" />
            {paymentStatus.status}
          </Badge>
        </div>
      </div>
    )
  }

  if (viewMode === "table") {
    return (
      <tr
        className="hover:bg-purple-50 cursor-pointer transition-colors"
        onClick={() => onSelect(student)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${paymentStatus.color}`}></div>
            <div>
              <div className="font-medium text-gray-900">{student.fullName}</div>
              <div className="text-xs text-gray-500">ID: {student.id}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-gray-600">{student.className}</td>
        <td className="px-4 py-3 text-sm text-gray-600">{student.parentContact}</td>
        <td className="px-4 py-3">
          <div className="text-sm font-medium">
            ${totalPaid.toLocaleString()} / ${annualFeeCalculated.toLocaleString()}
          </div>
        </td>
        <td className="px-4 py-3">
          {outstandingBalance > 0.01 ? (
            <span className="text-sm font-medium text-red-600">-${outstandingBalance.toLocaleString()}</span>
          ) : (
            <span className="text-sm text-green-600">$0</span>
          )}
        </td>
        <td className="px-4 py-3">
          <Badge variant={paymentStatus.status === "Paid in Full" ? "default" : "destructive"} className="text-xs">
            <StatusIcon className="w-3 h-3 mr-1" />
            {paymentStatus.status}
          </Badge>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            {student.hasTransport && <Car className="w-4 h-4 text-orange-500" />}
            {paymentTrend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
            {paymentTrend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
          </div>
        </td>
        <td className="px-4 py-3">
          {isHovered && showQuickActions && (
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onSelect(student)
                }}
              >
                <Eye className="w-3 h-3" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation()
                  onTransfer(student)
                }}
              >
                <UserX className="w-3 h-3" />
              </Button>
            </div>
          )}
        </td>
      </tr>
    )
  }

  // Default card view
  return (
    <Card
      className={`transition-all duration-200 cursor-pointer ${
        isHovered ? "shadow-lg scale-105 border-purple-300" : "hover:shadow-md"
      }`}
      onClick={() => onSelect(student)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${paymentStatus.color}`}></div>
            <h3 className="font-semibold text-gray-900">{student.fullName}</h3>
            {student.hasTransport && <Car className="w-4 h-4 text-orange-500" />}
            {paymentTrend === "up" && <TrendingUp className="w-4 h-4 text-green-500" />}
            {paymentTrend === "down" && <TrendingDown className="w-4 h-4 text-red-500" />}
          </div>

          <Badge variant={paymentStatus.status === "Paid in Full" ? "default" : "destructive"} className="text-xs">
            <StatusIcon className="w-3 h-3 mr-1" />
            {paymentStatus.status}
          </Badge>
        </div>

        <div className="space-y-2 mb-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User className="w-3 h-3" />
            <span>{student.className || "No class assigned"}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Phone className="w-3 h-3" />
            <span>{student.parentContact}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="w-3 h-3" />
            <span>Admitted: {new Date(student.admissionDate).toLocaleDateString()}</span>
          </div>
          {classGroup && (
            <div className="flex items-center gap-2 text-sm text-blue-600">
              <DollarSign className="w-3 h-3" />
              <span>
                Fee: ${classGroup.standardFee}/{settings.billingCycle === "monthly" ? "month" : "term"}
              </span>
            </div>
          )}
          {student.hasTransport && (
            <div className="flex items-center gap-2 text-sm text-orange-600">
              <Car className="w-3 h-3" />
              <span>Transport: ${student.transportFee}/month</span>
            </div>
          )}
        </div>



        {outstandingBalance > 0.01 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-800">
                Outstanding: ${outstandingBalance.toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-red-600 mt-1">Since enrollment date</p>
          </div>
        )}

        {isHovered && showQuickActions && (
          <div className="flex gap-2 mt-4">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-purple-600 border-purple-600 hover:bg-purple-50"
              onClick={(e) => {
                e.stopPropagation()
                onSelect(student)
              }}
            >
              <Eye className="w-3 h-3 mr-1" />
              View Details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
              onClick={(e) => {
                e.stopPropagation()
                onTransfer(student)
              }}
            >
              <UserX className="w-3 h-3 mr-1" />
              Transfer
            </Button>
          </div>
        )}

        {student.notes && (
          <div className="mt-3 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-500 italic">
              Note: {student.notes.length > 60 ? student.notes.substring(0, 60) + "..." : student.notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
