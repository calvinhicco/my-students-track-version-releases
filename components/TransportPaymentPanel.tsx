"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Student, AppSettings, TransportPayment } from "../types/index"
import { CheckCircle, XCircle, AlertCircle, Clock, DollarSign } from "lucide-react"
import { logger } from "../lib/errorLogger"

interface TransportPaymentPanelProps {
  student: Student
  onUpdate: (student: Student) => void
  settings: AppSettings
}

export default function TransportPaymentPanel({ student, onUpdate, settings }: TransportPaymentPanelProps) {
  logger.transportDebug("TransportPaymentPanel rendering", {
    studentId: student.id,
    studentName: student.fullName,
    hasTransport: student.hasTransport,
    transportPaymentsCount: student.transportPayments?.length || 0,
    transportFee: student.transportFee,
  })

  const [partialPaymentAmounts, setPartialPaymentAmounts] = useState<Record<number, string>>({})
  const [isInitialized, setIsInitialized] = useState(false)
  const [initializationAttempts, setInitializationAttempts] = useState(0)

  // Enhanced initialization with detailed logging
  useEffect(() => {
    const attemptNumber = initializationAttempts + 1
    setInitializationAttempts(attemptNumber)

    logger.transportDebug("TransportPaymentPanel useEffect triggered", {
      attemptNumber,
      studentId: student.id,
      hasTransport: student.hasTransport,
      transportPaymentsExists: !!student.transportPayments,
      transportPaymentsLength: student.transportPayments?.length || 0,
      transportPaymentsData: student.transportPayments,
      isInitialized,
      currentPartialPaymentAmounts: partialPaymentAmounts,
    })

    if (!student.hasTransport) {
      logger.transportInfo("Student doesn't have transport, clearing state", {
        studentId: student.id,
        studentName: student.fullName,
      })
      setPartialPaymentAmounts({})
      setIsInitialized(false)
      return
    }

    if (!Array.isArray(student.transportPayments)) {
      logger.transportError("Transport payments is not an array", {
        studentId: student.id,
        studentName: student.fullName,
        hasTransport: student.hasTransport,
        transportPaymentsType: typeof student.transportPayments,
        transportPaymentsValue: student.transportPayments,
      })
      setPartialPaymentAmounts({})
      setIsInitialized(false)
      return
    }

    if (student.transportPayments.length === 0) {
      logger.warn("Transport payments array is empty", {
        category: "transport",
        studentId: student.id,
        studentName: student.fullName,
        hasTransport: student.hasTransport,
        transportFee: student.transportFee,
      })
      setPartialPaymentAmounts({})
      setIsInitialized(false)
      return
    }

    try {
      const initialAmounts = student.transportPayments.reduce(
        (acc, payment) => {
          if (!payment || typeof payment.month !== "number" || typeof payment.amountPaid !== "number") {
            logger.transportError("Invalid payment object found", {
              studentId: student.id,
              payment,
              paymentType: typeof payment,
              monthType: typeof payment?.month,
              amountPaidType: typeof payment?.amountPaid,
            })
            return acc
          }

          acc[payment.month] = payment.amountPaid.toFixed(2)
          return acc
        },
        {} as Record<number, string>,
      )

      logger.transportInfo("Successfully initialized payment amounts", {
        studentId: student.id,
        studentName: student.fullName,
        initialAmounts,
        paymentsCount: student.transportPayments.length,
        attemptNumber,
      })

      setPartialPaymentAmounts(initialAmounts)
      setIsInitialized(true)
    } catch (error) {
      logger.transportError(
        "Error during payment amounts initialization",
        {
          studentId: student.id,
          studentName: student.fullName,
          transportPayments: student.transportPayments,
          attemptNumber,
        },
        error as Error,
      )

      setPartialPaymentAmounts({})
      setIsInitialized(false)
    }
  }, [
    student.hasTransport,
    student.transportPayments,
    student.id,
    student.transportFee,
    student.transportActivationDate, // Add this dependency
  ])

  // Additional effect to force re-initialization when transport is newly activated
  useEffect(() => {
    if (
      student.hasTransport &&
      Array.isArray(student.transportPayments) &&
      student.transportPayments.length > 0 &&
      !isInitialized
    ) {
      logger.transportInfo("Force re-initialization for newly activated transport", {
        studentId: student.id,
        studentName: student.fullName,
        transportPaymentsLength: student.transportPayments.length,
        isInitialized,
        currentAmounts: partialPaymentAmounts,
      })

      try {
        const initialAmounts = student.transportPayments.reduce(
          (acc, payment) => {
            acc[payment.month] = payment.amountPaid.toFixed(2)
            return acc
          },
          {} as Record<number, string>,
        )

        setPartialPaymentAmounts(initialAmounts)
        setIsInitialized(true)

        logger.transportInfo("Force re-initialization successful", {
          studentId: student.id,
          initialAmounts,
        })
      } catch (error) {
        logger.transportError(
          "Force re-initialization failed",
          {
            studentId: student.id,
            transportPayments: student.transportPayments,
          },
          error as Error,
        )
      }
    }
  }, [student.transportPayments, student.hasTransport, isInitialized])

  if (!student.hasTransport) {
    logger.transportDebug("TransportPaymentPanel: Student doesn't have transport, not rendering")
    return null
  }

  const transportPayments = Array.isArray(student.transportPayments) ? student.transportPayments : []

  if (transportPayments.length === 0) {
    logger.warn("No transport payments found, showing error message", {
      category: "transport",
      studentId: student.id,
      hasTransport: student.hasTransport,
      transportPaymentsType: typeof student.transportPayments,
    })

    return (
      <Card className="border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="text-xl text-orange-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Transport Payment Progress
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <p className="text-orange-600 font-medium">⚠️ Transport is enabled but no payment records found</p>
            <p className="text-sm text-gray-600 mt-2">This might indicate a data initialization issue.</p>
            <Button onClick={() => logger.exportTransportLogs()} variant="outline" size="sm" className="mt-4">
              Export Transport Logs
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const handlePaymentAmountChange = (month: number, value: string) => {
    logger.transportDebug("Payment amount changing", {
      studentId: student.id,
      month,
      newValue: value,
      oldValue: partialPaymentAmounts[month],
      isInitialized,
      allCurrentAmounts: partialPaymentAmounts,
    })

    // Allow empty string and valid numbers
    if (value === "" || (!isNaN(Number(value)) && Number(value) >= 0)) {
      setPartialPaymentAmounts((prev) => {
        const updated = { ...prev, [month]: value }

        logger.transportDebug("Payment amount updated in state", {
          studentId: student.id,
          month,
          value,
          updatedAmounts: updated,
          previousAmounts: prev,
        })

        return updated
      })
    } else {
      logger.transportWarn("Invalid payment value rejected", {
        studentId: student.id,
        month,
        rejectedValue: value,
        valueType: typeof value,
      })
    }
  }

  const handleUpdatePayment = (monthIndex: number) => {
    logger.transportInfo("Updating payment", {
      studentId: student.id,
      monthIndex,
      transportPaymentsLength: transportPayments.length,
    })

    const updatedPayments = [...transportPayments]
    if (updatedPayments.length <= monthIndex) {
      logger.transportError("Invalid month index for transport payment update", {
        studentId: student.id,
        monthIndex,
        paymentsLength: updatedPayments.length,
      })
      return
    }

    const payment = updatedPayments[monthIndex]
    const inputValue = partialPaymentAmounts[payment.month] || "0"
    const amountPaidInput = inputValue === "" ? 0 : Number.parseFloat(inputValue)

    logger.transportDebug("Processing payment update", {
      studentId: student.id,
      monthName: payment.monthName,
      month: payment.month,
      inputValue,
      amountPaidInput,
      currentAmountPaid: payment.amountPaid,
      amountDue: payment.amountDue,
    })

    if (isNaN(amountPaidInput) || amountPaidInput < 0) {
      logger.transportError("Invalid amount for payment update", {
        studentId: student.id,
        month: payment.month,
        inputValue,
        amountPaidInput,
      })
      alert("Please enter a valid amount.")
      return
    }

    // Only update if the value actually changed
    if (Math.abs(payment.amountPaid - amountPaidInput) < 0.01) {
      logger.transportDebug("No change in payment amount, skipping update", {
        studentId: student.id,
        month: payment.month,
        currentAmount: payment.amountPaid,
        newAmount: amountPaidInput,
      })
      return
    }

    payment.amountPaid = amountPaidInput
    payment.outstandingAmount = Math.max(0, payment.amountDue - amountPaidInput)
    payment.paid = payment.outstandingAmount <= 0.01
    payment.paidDate = payment.paid ? new Date().toISOString().split("T")[0] : undefined

    const updatedStudent = {
      ...student,
      transportPayments: updatedPayments,
    }

    logger.transportInfo("Payment updated successfully", {
      studentId: student.id,
      month: payment.month,
      monthName: payment.monthName,
      amountPaid: payment.amountPaid,
      outstandingAmount: payment.outstandingAmount,
      paid: payment.paid,
    })

    onUpdate(updatedStudent)

    // Update the local state to reflect the saved value
    setPartialPaymentAmounts((prev) => ({
      ...prev,
      [payment.month]: amountPaidInput.toFixed(2),
    }))
  }

  const handleSkipMonth = (monthIndex: number) => {
    logger.transportInfo("Toggling skip for month", {
      studentId: student.id,
      monthIndex,
    })

    const updatedPayments = [...transportPayments]
    if (updatedPayments.length <= monthIndex) {
      logger.transportError("Invalid month index for transport skip", {
        studentId: student.id,
        monthIndex,
        paymentsLength: updatedPayments.length,
      })
      return
    }

    const payment = updatedPayments[monthIndex]
    const newSkipStatus = !payment.isSkipped

    logger.transportInfo("Skip status changing", {
      studentId: student.id,
      month: payment.month,
      monthName: payment.monthName,
      oldSkipStatus: payment.isSkipped,
      newSkipStatus,
    })

    payment.isSkipped = newSkipStatus

    if (payment.isSkipped) {
      payment.amountDue = 0
      payment.amountPaid = 0
      payment.outstandingAmount = 0
      payment.paid = true
    } else {
      payment.amountDue = student.transportFee || 0
      payment.amountPaid = 0
      payment.outstandingAmount = payment.amountDue
      payment.paid = false
    }

    const updatedStudent = {
      ...student,
      transportPayments: updatedPayments,
    }

    onUpdate(updatedStudent)

    // Update local state
    setPartialPaymentAmounts((prev) => ({
      ...prev,
      [payment.month]: payment.amountPaid.toFixed(2),
    }))

    logger.transportInfo("Skip status updated successfully", {
      studentId: student.id,
      month: payment.month,
      isSkipped: payment.isSkipped,
      amountDue: payment.amountDue,
      amountPaid: payment.amountPaid,
    })
  }

  const getTransportPaymentStatus = (payment: TransportPayment) => {
    const today = new Date()
    const currentMonth = today.getMonth() + 1
    const paymentMonth = payment.month
    const isFutureMonth = paymentMonth > currentMonth

    if (payment.isSkipped) {
      return { status: "Skipped", color: "bg-gray-100 border-gray-200", textColor: "text-gray-600" }
    }

    if (isFutureMonth) {
      return { status: "Upcoming", color: "bg-blue-100 border-blue-200", textColor: "text-blue-600" }
    }

    if (payment.outstandingAmount <= 0.01) {
      return { status: "Paid in Full", color: "bg-green-50 border-green-200", textColor: "text-green-700" }
    } else if (payment.amountPaid > 0 && payment.outstandingAmount > 0) {
      return { status: "Partial Payment", color: "bg-orange-50 border-orange-200", textColor: "text-orange-700" }
    } else {
      return { status: "Unpaid", color: "bg-red-50 border-red-200", textColor: "text-red-700" }
    }
  }

  // 🚀 FIXED: Calculate totals with corrected date logic
  const today = new Date()
  const currentMonthNum = today.getMonth() + 1
  const currentYearNum = today.getFullYear()

  // Get activation date - default to start of current year if not set
  const activationDate = student.transportActivationDate
    ? new Date(student.transportActivationDate)
    : new Date(currentYearNum, 0, 1) // January 1st of current year

  logger.transportDebug("Date calculation details", {
    studentId: student.id,
    currentMonthNum,
    currentYearNum,
    activationDate: activationDate.toISOString(),
    transportActivationDate: student.transportActivationDate,
  })

  // 🚀 FIXED: Simplified and corrected filtering logic
  const pastTransportPayments = transportPayments.filter((payment) => {
    // Only include active payments
    if (!payment.isActive) {
      logger.transportDebug("Payment excluded - not active", {
        studentId: student.id,
        month: payment.month,
        monthName: payment.monthName,
        isActive: payment.isActive,
      })
      return false
    }

    // Check if payment month is current or past (not future)
    const isCurrentOrPast = payment.month <= currentMonthNum

    // 🚀 FIXED: More lenient activation check - include if activation date is in the same year
    const activationMonth = activationDate.getMonth() + 1
    const isAfterActivation = payment.month >= activationMonth

    const shouldInclude = isCurrentOrPast && isAfterActivation

    logger.transportDebug("Payment filtering decision", {
      studentId: student.id,
      month: payment.month,
      monthName: payment.monthName,
      isActive: payment.isActive,
      isCurrentOrPast,
      isAfterActivation,
      shouldInclude,
      activationMonth,
      currentMonthNum,
    })

    return shouldInclude
  })

  const totalTransportPaid = pastTransportPayments.reduce((sum, payment) => sum + payment.amountPaid, 0)
  const totalTransportDue = pastTransportPayments.reduce((sum, payment) => sum + payment.amountDue, 0)
  const totalTransportOutstanding = pastTransportPayments.reduce((sum, payment) => sum + payment.outstandingAmount, 0)
  const transportPaymentPercentage = totalTransportDue > 0 ? (totalTransportPaid / totalTransportDue) * 100 : 0

  logger.transportDebug("Transport totals calculated", {
    studentId: student.id,
    totalTransportPaid,
    totalTransportDue,
    totalTransportOutstanding,
    transportPaymentPercentage,
    pastPaymentsCount: pastTransportPayments.length,
    totalPaymentsCount: transportPayments.length,
    isInitialized,
    pastPaymentMonths: pastTransportPayments.map((p) => ({ month: p.month, name: p.monthName })),
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl text-purple-800 flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          Transport Payment Progress
        </CardTitle>
        <div className="text-sm text-gray-600 flex items-center justify-between">
          <span>
            Monthly transport fee: ${student.transportFee}/month • Status colors: Green (paid), Orange (partial), Red
            (unpaid), Gray (skipped), Blue (future)
          </span>
          <Button onClick={() => logger.exportTransportLogs()} variant="outline" size="sm" className="ml-4">
            Export Logs
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Transport Payment Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Transport Due</p>
            <p className="text-2xl font-bold text-purple-800">${totalTransportDue.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Total Paid</p>
            <p className="text-2xl font-bold text-green-600">${totalTransportPaid.toLocaleString()}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Outstanding</p>
            <p className="text-2xl font-bold text-red-600">${totalTransportOutstanding.toLocaleString()}</p>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>Transport Payment Progress</span>
            <span>{transportPaymentPercentage.toFixed(1)}% Complete</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-3 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(transportPaymentPercentage, 100)}%` }}
            ></div>
          </div>
        </div>

        {/* Debug Info (only in development) */}
        {process.env.NODE_ENV === "development" && (
          <div className="mb-4 p-3 bg-gray-100 rounded text-xs">
            <strong>Debug Info:</strong> Initialized: {isInitialized ? "Yes" : "No"} | Attempts:{" "}
            {initializationAttempts} | Payments: {transportPayments.length} | Past Payments:{" "}
            {pastTransportPayments.length} | Amounts: {Object.keys(partialPaymentAmounts).length}
          </div>
        )}

        {/* Monthly Transport Payments */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {transportPayments
            .sort((a, b) => a.month - b.month)
            .map((payment, index) => {
              const { status, color, textColor } = getTransportPaymentStatus(payment)

              return (
                <div key={payment.month} className={`p-4 border rounded-lg transition-all hover:shadow-md ${color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className={`font-semibold ${textColor}`}>{payment.monthName}</h3>
                    {status === "Paid in Full" ? (
                      <CheckCircle className={`w-5 h-5 ${textColor}`} />
                    ) : status === "Unpaid" ? (
                      <XCircle className={`w-5 h-5 ${textColor}`} />
                    ) : status === "Partial Payment" ? (
                      <AlertCircle className={`w-5 h-5 ${textColor}`} />
                    ) : status === "Skipped" ? (
                      <div className={`w-5 h-5 ${textColor} flex items-center justify-center text-xs font-bold`}>S</div>
                    ) : (
                      <Clock className={`w-5 h-5 ${textColor}`} />
                    )}
                  </div>

                  <div className="space-y-2 text-sm">
                    {!payment.isSkipped ? (
                      <>
                        <p className="font-medium text-gray-700">Due: ${payment.amountDue.toFixed(2)}</p>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`transportPaid-${payment.month}`} className="text-gray-600">
                            Paid:
                          </Label>
                          <Input
                            id={`transportPaid-${payment.month}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={partialPaymentAmounts[payment.month] || ""}
                            onChange={(e) => {
                              logger.transportDebug("Input onChange triggered", {
                                studentId: student.id,
                                month: payment.month,
                                value: e.target.value,
                                isInitialized,
                              })
                              handlePaymentAmountChange(payment.month, e.target.value)
                            }}
                            onBlur={() => {
                              logger.transportDebug("Input onBlur triggered", {
                                studentId: student.id,
                                month: payment.month,
                                index,
                              })
                              handleUpdatePayment(index)
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                logger.transportDebug("Input Enter key pressed", {
                                  studentId: student.id,
                                  month: payment.month,
                                  index,
                                })
                                handleUpdatePayment(index)
                              }
                            }}
                            className="w-24 py-1 h-8 text-sm"
                            placeholder="0.00"
                          />
                        </div>
                        <p className="text-gray-600">Outstanding: ${payment.outstandingAmount.toFixed(2)}</p>
                      </>
                    ) : (
                      <p className="text-gray-600 italic">Transport waived for this month</p>
                    )}

                    <p className="text-gray-600">Due Date: {new Date(payment.dueDate).toLocaleDateString()}</p>

                    {payment.paidDate && !payment.isSkipped && (
                      <p className={`text-xs ${textColor}`}>
                        Paid On: {new Date(payment.paidDate).toLocaleDateString()}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={`text-xs ${textColor}`}>
                        {status}
                      </Badge>

                      <Button
                        onClick={() => handleSkipMonth(index)}
                        variant="outline"
                        size="sm"
                        className={`text-xs ${
                          payment.isSkipped
                            ? "text-blue-600 border-blue-600 hover:bg-blue-50"
                            : "text-gray-600 border-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        {payment.isSkipped ? "Unskip" : "Skip"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>

        {transportPayments.length === 0 && (
          <div className="text-center py-4 text-gray-500">No transport payment records found for this student.</div>
        )}
      </CardContent>
    </Card>
  )
}
