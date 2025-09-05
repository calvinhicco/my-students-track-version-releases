"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

import type { Student, AppSettings, FeePayment, TransportPayment } from "../types/index"
import { BillingCycle, TERMS, type BillingCycleType } from "../types/index"
import {
  calculateStudentTotals,
  calculateSchoolFeesOutstanding,
  calculateOutstandingFromEnrollment,
  getOutstandingBreakdown, // Ensure this is imported if used
} from "../lib/calculations"
import { getMonthName, getCurrentMonth, getCurrentYear } from "../lib/dateUtils"
import { exportStudentDetailsPDF } from "../lib/pdfExport"
import { activateTransportForStudent, deactivateTransportForStudent, calculateTransportOutstanding } from "../lib/transportUtils"
// import { logger, measurePerformance } from "../lib/errorLogger" // Removed
import { PromotionManager } from "../lib/promotionUtils"

import { User, Phone, MapPin, Calendar, DollarSign, CheckCircle, XCircle, Edit, Save, X, FileText, Download, AlertCircle, Clock, Truck, FlagOffIcon as TruckOff, Bug } from 'lucide-react'

import TransportPaymentPanel from "./TransportPaymentPanel"

interface StudentDetailsProps {
  student: Student
  onUpdate: (student: Student) => void
  settings: AppSettings
}

export default function StudentDetails({ student, onUpdate, settings }: StudentDetailsProps) {
  // logger.info("COMPONENT", "StudentDetails rendering", {
  //   studentId: student.id,
  //   studentName: student.fullName,
  //   hasTransport: student.hasTransport,
  //   transportPaymentsCount: student.transportPayments?.length || 0,
  // }) // Removed logger call

  const [isEditing, setIsEditing] = useState(false)
  const [editData, setEditData] = useState({
    fullName: student.fullName,
    dateOfBirth: student.dateOfBirth,
    parentContact: student.parentContact,
    address: student.address,
    admissionDate: student.admissionDate,
    notes: student.notes || "",
    transportFee: student.transportFee || 0,
    hasTransport: student.hasTransport || false,
    hasCustomFees: student.hasCustomFees || false,
    customSchoolFee: student.customSchoolFee || 0,
  })

  const [partialPaymentAmounts, setPartialPaymentAmounts] = useState<Record<number, string>>(
    Array.isArray(student.feePayments)
    ? student.feePayments.reduce(
        (acc, payment) => {
          acc[payment.period] = payment.amountPaid.toFixed(2)
          return acc
        },
        {} as Record<number, string>,
      )
    : {},
  )

  // Transport payment amounts state
  const [transportPaymentAmounts, setTransportPaymentAmounts] = useState<Record<number, string>>(
    Array.isArray(student.transportPayments)
    ? student.transportPayments.reduce(
        (acc, payment) => {
          acc[payment.month] = payment.amountPaid.toFixed(2)
          return acc
        },
        {} as Record<number, string>,
      )
    : {},
  )

  const [showTransportDialog, setShowTransportDialog] = useState(false)
  const [newTransportFee, setNewTransportFee] = useState<number>(student.transportFee || 0)

  // State for student transfer functionality
  const [showTransferDialog, setShowTransferDialog] = useState(false)
  const [transferData, setTransferData] = useState({
    transferDate: new Date().toISOString().split("T")[0],
    newSchool: "",
    reason: "",
    retainPaymentHistory: false,
  })

  // 🚀 SUPER FIX: Add transport panel key for forcing remounts
  const [transportPanelKey, setTransportPanelKey] = useState(0)

  const studentWithGuardedFeePayments = {
    ...student,
    feePayments: Array.isArray(student.feePayments) ? student.feePayments : [],
  }

  const {
    totalPaid,
    annualFeeCalculated,
    schoolFeesTotal,
    schoolFeesOutstanding,
  } = calculateStudentTotals(
    studentWithGuardedFeePayments,
    settings.billingCycle,
  )
  const schoolFeesPaid = Math.max(0, schoolFeesTotal - schoolFeesOutstanding)
  const paymentPercentage = schoolFeesTotal > 0 ? (schoolFeesPaid / schoolFeesTotal) * 100 : 0

  // ---------- NEW DUE-TO-DATE CALCULATION ----------
  const currentDate = new Date()

  // Tuition expected up to today (exclude transport part, future periods, and pre-admission periods)
  let tuitionDueToDate = 0
  if (Array.isArray(student.feePayments)) {
    const currentYear = currentDate.getFullYear()
    const admissionDate = new Date(student.admissionDate)
    const admissionPeriodStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)

    student.feePayments.forEach((payment) => {
      // Determine period start date
      let periodStart: Date | null = null
      if (settings.billingCycle === BillingCycle.MONTHLY) {
        periodStart = new Date(currentYear, payment.period - 1, 1)
      } else {
        const term = TERMS.find((t) => t.period === payment.period)
        if (term) periodStart = new Date(currentYear, term.months[0] - 1, 1)
      }
      if (!periodStart || periodStart > currentDate || periodStart < admissionPeriodStart) return // future or pre-admission

      const transportPart = student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0
      const tuitionComponent = Math.max(0, payment.amountDue - transportPart)
      tuitionDueToDate += tuitionComponent
    })
  }

  // Transport expected up to today (exclude skipped/future months)
  const transportDueToDate = student.hasTransport
    ? calculateTransportOutstanding({
        ...student,
        transportPayments:
          student.transportPayments?.map((p) => ({ ...p, outstandingAmount: p.amountDue })) || [],
      })
    : 0

  const expectedToDate = tuitionDueToDate + transportDueToDate
  const outstandingBalance = Math.max(0, expectedToDate - totalPaid)

  const currentMonth = getCurrentMonth()
  const currentYear = getCurrentYear()

  const handleEditChange = (field: string, value: string | boolean | number) => {
    setEditData((prev) => ({ ...prev, [field]: value }))
  }

  const handleSaveEdit = () => {
    const admissionDate = new Date(editData.admissionDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999)

    if (admissionDate > today) {
      // logger.error("VALIDATION", "Admission date cannot be in the future", { // Removed logger call
      //   studentId: student.id,
      //   admissionDate: editData.admissionDate,
      // }) // Removed logger call
      // Using alert as per original code's pattern, consider a custom modal for better UX
      alert("Admission date cannot be in the future")
      return
    }

    let updatedStudent: Student = {
      ...student,
      ...editData,
      hasTransport: editData.hasTransport,
      transportFee: editData.transportFee,
      hasCustomFees: editData.hasCustomFees,
      customSchoolFee: editData.customSchoolFee,
    }

    if (
      student.admissionDate !== editData.admissionDate ||
      student.hasTransport !== editData.hasTransport ||
      student.transportFee !== editData.transportFee ||
      student.hasCustomFees !== editData.hasCustomFees ||
      student.customSchoolFee !== editData.customSchoolFee
    ) {
      updatedStudent = reinitializeFeePayments(updatedStudent, settings)
    }

    onUpdate(updatedStudent)
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setEditData({
      fullName: student.fullName,
      dateOfBirth: student.dateOfBirth,
      parentContact: student.parentContact,
      address: student.address,
      admissionDate: student.admissionDate,
      notes: student.notes || "",
      transportFee: student.transportFee || 0,
      hasTransport: editData.hasTransport || false,
      hasCustomFees: student.hasCustomFees || false,
      customSchoolFee: student.customSchoolFee || 0,
    })
    setIsEditing(false)
  }

  const reinitializeFeePayments = (studentToUpdate: Student, currentSettings: AppSettings): Student => {
    return (() => {
      // Use custom fee if enabled, otherwise use standard class fee
      const standardClassFee =
        (Array.isArray(currentSettings.classGroups) ? currentSettings.classGroups : []).find(
          (g) => g.id === studentToUpdate.classGroup,
        )?.standardFee || 0
      
      const classFee = studentToUpdate.hasCustomFees && studentToUpdate.customSchoolFee 
        ? studentToUpdate.customSchoolFee 
        : standardClassFee
      const admissionDateObj = new Date(studentToUpdate.admissionDate)
      const currentYear = new Date().getFullYear()

      const newFeePayments: FeePayment[] = []
      let newTotalOwed = 0

      if (currentSettings.billingCycle === BillingCycle.MONTHLY) {
        for (let i = 0; i < 12; i++) {
          const month = i + 1
          const dueDate = new Date(currentYear, i, currentSettings.paymentDueDate || 1).toISOString().split("T")[0]

          let amountDue = classFee
          const isPeriodAfterAdmission =
            new Date(currentYear, i, 1).getTime() >=
            new Date(admissionDateObj.getFullYear(), admissionDateObj.getMonth(), 1).getTime()

          if (studentToUpdate.hasTransport && isPeriodAfterAdmission) {
            amountDue += studentToUpdate.transportFee
          }

          const existingPayment = Array.isArray(studentToUpdate.feePayments)
            ? studentToUpdate.feePayments.find((p) => p.period === month)
            : undefined

          const newPayment: FeePayment = {
            period: month,
            amountDue: amountDue,
            amountPaid: existingPayment?.amountPaid || 0,
            paid: existingPayment?.paid || false,
            dueDate: existingPayment?.dueDate || dueDate,
            isTransportWaived: existingPayment?.isTransportWaived || false,
            isSkipped: existingPayment?.isSkipped || false,
            outstandingAmount: amountDue - (existingPayment?.amountPaid || 0),
          }
          newFeePayments.push(newPayment)

          if (isPeriodAfterAdmission && newPayment.outstandingAmount > 0.01) {
            newTotalOwed += newPayment.outstandingAmount
          }
        }
      } else {
        // Termly billing
        TERMS.forEach((term) => {
          const firstMonthOfTerm = term.months[0] - 1
          const dueDate = new Date(currentYear, firstMonthOfTerm, currentSettings.paymentDueDate || 1)
            .toISOString()
            .split("T")[0]

          let amountDue = classFee
          const isPeriodAfterAdmission =
            new Date(currentYear, firstMonthOfTerm, 1).getTime() >=
            new Date(admissionDateObj.getFullYear(), admissionDateObj.getMonth(), 1).getTime()

          if (studentToUpdate.hasTransport && isPeriodAfterAdmission) {
            amountDue += studentToUpdate.transportFee
          }

          const existingPayment = Array.isArray(studentToUpdate.feePayments)
            ? studentToUpdate.feePayments.find((p) => p.period === term.period)
            : undefined

          const newPayment: FeePayment = {
            period: term.period,
            amountDue: amountDue,
            amountPaid: existingPayment?.amountPaid || 0,
            paid: existingPayment?.paid || false,
            dueDate: existingPayment?.dueDate || dueDate,
            isTransportWaived: existingPayment?.isTransportWaived || false,
            isSkipped: existingPayment?.isSkipped || false,
            outstandingAmount: amountDue - (existingPayment?.amountPaid || 0),
          }
          newFeePayments.push(newPayment)

          if (isPeriodAfterAdmission && newPayment.outstandingAmount > 0.01) {
            newTotalOwed += newPayment.outstandingAmount
          }
        })
      }

      return {
        ...studentToUpdate,
        feePayments: newFeePayments,
        totalOwed: newTotalOwed,
        totalPaid: newFeePayments.reduce((acc, p) => acc + p.amountPaid, 0),
      }
    })()
  } // Removed measurePerformance

  const handlePaymentAmountChange = (period: number, value: string) => {
    // Allow empty string and valid numbers
    if (value === "" || (!isNaN(Number(value)) && Number(value) >= 0)) {
      setPartialPaymentAmounts((prev) => ({ ...prev, [period]: value }))
    }
  }

  const handleUpdatePayment = (periodIndex: number) => {
    const updatedPayments = Array.isArray(student.feePayments) ? [...student.feePayments] : []
    if (updatedPayments.length <= periodIndex) {
      // logger.error("PAYMENT", "Invalid period index for payment update", { // Removed logger call
      //   studentId: student.id,
      //   periodIndex,
      //   paymentsLength: updatedPayments.length,
      // }) // Removed logger call
      return
    }
    const payment = updatedPayments[periodIndex]
    const inputValue = partialPaymentAmounts[payment.period] || "0"
    const amountPaidInput = inputValue === "" ? 0 : Number.parseFloat(inputValue)

    if (isNaN(amountPaidInput) || amountPaidInput < 0) {
      // logger.error("PAYMENT", "Invalid amount for payment update", { // Removed logger call
      //   studentId: student.id,
      //   period: payment.period,
      //   inputValue,
      //   amountPaidInput,
      // }) // Removed logger call
      alert("Please enter a valid amount.") // Using alert as per original code's pattern
      return
    }

    let actualAmountDue = payment.amountDue
    if (payment.isTransportWaived && student.hasTransport) {
      const transportFeePerPeriod = student.transportFee
      actualAmountDue = Math.max(0, payment.amountDue - transportFeePerPeriod)
    }

    const previousAmountPaid = payment.amountPaid || 0
    payment.amountPaid = amountPaidInput
    payment.outstandingAmount = actualAmountDue - amountPaidInput
    payment.paid = payment.outstandingAmount <= 0.01
    
    // Update paidDate for any payment change - mirrors tuition logic
    if (amountPaidInput > 0) {
      payment.paidDate = new Date().toISOString().split("T")[0]
    } else {
      payment.paidDate = undefined
    }

    const updatedStudent = {
      ...student,
      feePayments: updatedPayments,
    }

    const { totalPaid: newTotalPaid, totalOwed: newTotalOwed } = calculateStudentTotals(
      { ...updatedStudent, feePayments: Array.isArray(updatedStudent.feePayments) ? updatedStudent.feePayments : [] },
      settings.billingCycle,
    )
    updatedStudent.totalPaid = newTotalPaid
    updatedStudent.totalOwed = newTotalOwed

    onUpdate(updatedStudent)
    setPartialPaymentAmounts((prev) => ({
      ...prev,
      [payment.period]: amountPaidInput.toFixed(2),
    }))
  }

  const handleTransportPaymentAmountChange = (month: number, value: string) => {
    // Allow empty string and valid numbers
    if (value === "" || (!isNaN(Number(value)) && Number(value) >= 0)) {
      setTransportPaymentAmounts((prev) => ({ ...prev, [month]: value }))
    }
  }

  const handleUpdateTransportPayment = (monthIndex: number) => {
    const updatedTransportPayments = Array.isArray(student.transportPayments) ? [...student.transportPayments] : []
    if (updatedTransportPayments.length <= monthIndex) {
      // logger.error("TRANSPORT", "Invalid month index for transport payment update", { // Removed logger call
      //   studentId: student.id,
      //   monthIndex,
      //   paymentsLength: updatedTransportPayments.length,
      // }) // Removed logger call
      return
    }

    const payment = updatedTransportPayments[monthIndex]
    const inputValue = transportPaymentAmounts[payment.month] || "0"
    const amountPaidInput = inputValue === "" ? 0 : Number.parseFloat(inputValue)

    if (isNaN(amountPaidInput) || amountPaidInput < 0) {
      // logger.error("TRANSPORT", "Invalid amount for transport payment update", { // Removed logger call
      //   studentId: student.id,
      //   month: payment.month,
      //   inputValue,
      //   amountPaidInput,
      // }) // Removed logger call
      alert("Please enter a valid amount.") // Using alert as per original code's pattern
      return
    }

    const previousAmountPaid = payment.amountPaid || 0
    payment.amountPaid = amountPaidInput
    payment.outstandingAmount = payment.amountDue - amountPaidInput
    payment.paid = payment.outstandingAmount <= 0.01
    
    // Update paidDate for any payment change - mirrors tuition logic
    if (amountPaidInput > 0) {
      payment.paidDate = new Date().toISOString().split("T")[0]
    } else {
      payment.paidDate = undefined
    }

    const updatedStudent = {
      ...student,
      transportPayments: updatedTransportPayments,
    }

    onUpdate(updatedStudent)
    setTransportPaymentAmounts((prev) => ({
      ...prev,
      [payment.month]: amountPaidInput.toFixed(2),
    }))
  }

  const handleToggleTransportForPeriod = (periodIndex: number, waive: boolean) => {
    const updatedPayments = Array.isArray(student.feePayments) ? [...student.feePayments] : []
    if (updatedPayments.length <= periodIndex) {
      // logger.error("TRANSPORT", "Invalid period index for transport toggle", { // Removed logger call
      //   studentId: student.id,
      //   periodIndex,
      //   paymentsLength: updatedPayments.length,
      // }) // Removed logger call
      return
    }
    const payment = updatedPayments[periodIndex]

    payment.isTransportWaived = waive

    const classFee =
      (Array.isArray(settings.classGroups) ? settings.classGroups : []).find((g) => g.id === student.classGroup)
        ?.standardFee || 0
    const baseAmount = classFee

    let transportAmount = 0
    if (student.hasTransport && !waive) {
      transportAmount = student.transportFee
    }
    payment.amountDue = baseAmount + transportAmount
    payment.outstandingAmount = payment.amountDue - payment.amountPaid
    payment.paid = payment.outstandingAmount <= 0.01

    const updatedStudent = {
      ...student,
      feePayments: updatedPayments,
    }

    const { totalPaid: newTotalPaid, totalOwed: newTotalOwed } = calculateStudentTotals(
      { ...updatedStudent, feePayments: Array.isArray(updatedStudent.feePayments) ? updatedStudent.feePayments : [] },
      settings.billingCycle,
    )
    updatedStudent.totalPaid = newTotalPaid
    updatedStudent.totalOwed = newTotalOwed

    onUpdate(updatedStudent)
    setPartialPaymentAmounts((prev) => ({
      ...prev,
      [payment.period]: updatedStudent.feePayments[periodIndex]?.amountPaid.toFixed(2) || "0.00",
    }))
  }

  const handleToggleTransportSkip = (monthIndex: number, skip: boolean) => {
    const updatedTransportPayments = Array.isArray(student.transportPayments) ? [...student.transportPayments] : []
    if (updatedTransportPayments.length <= monthIndex) {
      // logger.error("TRANSPORT", "Invalid month index for transport skip toggle", { // Removed logger call
      //   studentId: student.id,
      //   monthIndex,
      //   paymentsLength: updatedTransportPayments.length,
      // }) // Removed logger call
      return
    }

    const payment = updatedTransportPayments[monthIndex]
    payment.isSkipped = skip

    if (skip) {
      payment.amountDue = 0
      payment.amountPaid = 0
      payment.outstandingAmount = 0
      payment.paid = true
    } else {
      payment.amountDue = student.transportFee
      payment.outstandingAmount = payment.amountDue - payment.amountPaid
      payment.paid = payment.outstandingAmount <= 0.01
    }

    const updatedStudent = {
      ...student,
      transportPayments: updatedTransportPayments,
    }

    onUpdate(updatedStudent)
    setTransportPaymentAmounts((prev) => ({
      ...prev,
      [payment.month]: payment.amountPaid.toFixed(2),
    }))
  }

  const handleToggleFeeSkip = (periodIndex: number, skip: boolean) => {
    const updatedPayments = Array.isArray(student.feePayments) ? [...student.feePayments] : []
    if (updatedPayments.length <= periodIndex) {
      return
    }

    const payment = updatedPayments[periodIndex]
    payment.isSkipped = skip

    if (skip) {
      // When skipping, set amounts to 0 and mark as paid
      payment.amountDue = 0
      payment.amountPaid = 0
      payment.outstandingAmount = 0
      payment.paid = true
    } else {
      // When unskipping, recalculate the amounts
      const classFee = student.hasCustomFees && student.customSchoolFee 
        ? student.customSchoolFee 
        : (Array.isArray(settings.classGroups) ? settings.classGroups : []).find((g) => g.id === student.classGroup)?.standardFee || 0
      
      let baseAmount = classFee
      let transportAmount = 0
      
      if (student.hasTransport && !payment.isTransportWaived) {
        transportAmount = student.transportFee
      }
      
      payment.amountDue = baseAmount + transportAmount
      payment.outstandingAmount = payment.amountDue - payment.amountPaid
      payment.paid = payment.outstandingAmount <= 0.01
    }

    const updatedStudent = {
      ...student,
      feePayments: updatedPayments,
    }

    const { totalPaid: newTotalPaid, totalOwed: newTotalOwed } = calculateStudentTotals(
      { ...updatedStudent, feePayments: Array.isArray(updatedStudent.feePayments) ? updatedStudent.feePayments : [] },
      settings.billingCycle,
    )
    updatedStudent.totalPaid = newTotalPaid
    updatedStudent.totalOwed = newTotalOwed

    onUpdate(updatedStudent)
    setPartialPaymentAmounts((prev) => ({
      ...prev,
      [payment.period]: payment.amountPaid.toFixed(2),
    }))
  }

  const handleTransportToggle = async () => {
    if (student.hasTransport) {
      // Deactivate transport
      // Using alert for confirmation, consider a custom modal for better UX
      const confirmDeactivate = window.confirm(
        "Are you sure you want to deactivate transport? This will remove all transport payment records.",
      )
      if (!confirmDeactivate) return

      // logger.transportInfo("Deactivating transport", { // Removed logger call
      //   studentId: student.id,
      //   studentName: student.fullName,
      // }) // Removed logger call

      const updatedStudent = deactivateTransportForStudent(student)
      onUpdate(updatedStudent)
      // 🚀 SUPER FIX: Force transport panel to remount
      setTransportPanelKey((prev) => prev + 1)
      alert("Transport deactivated successfully!") // Using alert as per original code's pattern
    } else {
      // Show activation dialog
      // logger.transportInfo("Showing transport activation dialog", { // Removed logger call
      //   studentId: student.id,
      //   studentName: student.fullName,
      // }) // Removed logger call
      setNewTransportFee(student.transportFee || 0)
      setShowTransportDialog(true)
    }
  }

  const handleActivateTransport = async () => {
    // logger.transportInfo("Starting transport activation", { // Removed logger call
    //   studentId: student.id,
    //   studentName: student.fullName,
    //   transportFee: newTransportFee,
    //   currentHasTransport: student.hasTransport,
    //   currentTransportPayments: student.transportPayments?.length || 0,
    // }) // Removed logger call

    if (newTransportFee <= 0) {
      // logger.transportError("Invalid transport fee for activation", { // Removed logger call
      //   studentId: student.id,
      //   transportFee: newTransportFee,
      // }) // Removed logger call
      alert("Please enter a valid transport fee") // Using alert as per original code's pattern
      return
    }

    try {
      const activationDate = new Date().toISOString().split("T")[0]

      // logger.transportInfo("Calling activateTransportForStudent", { // Removed logger call
      //   studentId: student.id,
      //   activationDate,
      //   transportFee: newTransportFee,
      // }) // Removed logger call

      // Use your existing transport activation function
      const updatedStudent = activateTransportForStudent(student, newTransportFee, activationDate, settings)

      // logger.transportInfo("Transport activation completed", { // Removed logger call
      //   studentId: student.id,
      //   hasTransport: updatedStudent.hasTransport,
      //   transportFee: updatedStudent.transportFee,
      //   transportPaymentsCount: updatedStudent.transportPayments?.length || 0,
      //   transportActivationDate: updatedStudent.transportActivationDate,
      // }) // Removed logger call

      // 🚀 SUPER FIX: Initialize transport payment amounts state
      const initialTransportAmounts = Array.isArray(updatedStudent.transportPayments)
        ? updatedStudent.transportPayments.reduce(
            (acc, payment) => {
              acc[payment.month] = payment.amountPaid.toFixed(2)
              return acc
            },
            {} as Record<number, string>,
          )
        : {}

      // logger.transportDebug("Setting initial transport amounts", { // Removed logger call
      //   studentId: student.id,
      //   initialTransportAmounts,
      // }) // Removed logger call
      setTransportPaymentAmounts(initialTransportAmounts)

      // 🚀 SUPER FIX: Force transport panel to completely remount with new key
      const newKey = transportPanelKey + 1
      setTransportPanelKey(newKey)

      // logger.transportInfo("Transport panel key updated", { // Removed logger call
      //   studentId: student.id,
      //   oldKey: transportPanelKey,
      //   newKey,
      // }) // Removed logger call

      // 🚀 SUPER FIX: Call onUpdate with a slight delay to ensure state is processed
      setTimeout(() => {
        // logger.transportInfo("Calling onUpdate with delay", { // Removed logger call
        //   studentId: student.id,
        //   hasTransport: updatedStudent.hasTransport,
        //   transportPaymentsCount: updatedStudent.transportPayments?.length || 0,
        // }) // Removed logger call
        onUpdate(updatedStudent)
      }, 100)

      // Close dialog
      setShowTransportDialog(false)
      setNewTransportFee(0)

      // Show success message
      const paymentCount = Array.isArray(updatedStudent.transportPayments) ? updatedStudent.transportPayments.length : 0
      alert(`Transport activated successfully! ${paymentCount} payment periods created.`) // Using alert as per original code's pattern

      // logger.transportInfo("Transport activation process completed successfully", { // Removed logger call
      //   studentId: student.id,
      //   paymentCount,
      // }) // Removed logger call
    } catch (error) {
      // logger.transportError( // Removed logger call
      //   "Transport activation failed", // Removed logger call
      //   { // Removed logger call
      //     studentId: student.id, // Removed logger call
      //     transportFee: newTransportFee, // Removed logger call
      //     error: error instanceof Error ? error.message : "Unknown error", // Removed logger call
      //   }, // Removed logger call
      //   error as Error, // Removed logger call
      // ) // Removed logger call
      alert("Failed to activate transport. Please try again.") // Using alert as per original code's pattern
    }
  }

const generatePDF = async () => {
  try {
    await exportStudentDetailsPDF(studentWithGuardedFeePayments, settings)
  } catch (error) {
    console.error("PDF generation error:", error)
    // Using alert as per original code's pattern
    alert("PDF generation failed. Please try again.")
  }
 }
  
const getPeriodName = (period: number, billingCycleType: BillingCycleType) => {
    if (billingCycleType === BillingCycle.MONTHLY) {
      return getMonthName(period)
    } else {
      const term = TERMS.find((t) => t.period === period)
      return term ? term.name : `Term ${period}`
    }
  }

  const getPeriodStatus = (payment: FeePayment) => {
    const today = new Date()
    const admissionDate = new Date(student.admissionDate)
    const admissionPeriodStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)
    
    const currentPeriodStartDate =
      settings.billingCycle === BillingCycle.MONTHLY
        ? new Date(today.getFullYear(), today.getMonth(), 1)
        : (() => {
            const currentMonth = today.getMonth() + 1
            const currentTerm = TERMS.find((term) => term.months.includes(currentMonth))
            return currentTerm ? new Date(today.getFullYear(), currentTerm.months[0] - 1, 1) : new Date()
          })()

    const paymentTermMonths = TERMS.find((t) => t.period === payment.period)?.months || [1]
    const paymentPeriodStartDate =
      settings.billingCycle === BillingCycle.MONTHLY
        ? new Date(today.getFullYear(), payment.period - 1, 1)
        : new Date(today.getFullYear(), paymentTermMonths[0] - 1 || 0, 1)

    const isFuturePeriod = paymentPeriodStartDate > currentPeriodStartDate
    const isPreAdmission = paymentPeriodStartDate < admissionPeriodStart

    if (payment.isSkipped) {
      return { status: "Skipped", color: "bg-gray-100 border-gray-200", textColor: "text-gray-600" }
    }

    if (isPreAdmission) {
      return { status: "Pre-Admission", color: "bg-gray-100 border-gray-300", textColor: "text-gray-500" }
    }

    if (isFuturePeriod) {
      return { status: "Upcoming", color: "bg-gray-100 border-gray-200", textColor: "text-gray-600" }
    }

    // Adjust outstanding to properly handle transport deactivated students
    let tuitionOutstanding: number
    if (!student.hasTransport || payment.isTransportWaived) {
      // For students with deactivated transport or waived transport, use full outstanding amount
      tuitionOutstanding = payment.outstandingAmount
    } else {
      // For students with active transport, subtract transport component
      const transportPart = student.transportFee || 0
      tuitionOutstanding = Math.max(0, payment.outstandingAmount - transportPart)
    }

    if (tuitionOutstanding <= 0.01) {
      return { status: "Paid in Full", color: "bg-green-50 border-green-200", textColor: "text-green-700" }
    }

    if (payment.amountPaid > 0 && tuitionOutstanding > 0) {
      return { status: "Partial Payment", color: "bg-orange-50 border-orange-200", textColor: "text-orange-700" }
    }

    return { status: "Unpaid", color: "bg-red-50 border-red-200", textColor: "text-red-700" }
  }

  const getTransportPaymentStatus = (payment: TransportPayment) => {
    const admissionDate = new Date(student.admissionDate)
    const admissionPeriodStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)
    const paymentPeriodStart = new Date(admissionDate.getFullYear(), payment.month - 1, 1)
    
    // Check if payment period is before admission
    if (paymentPeriodStart < admissionPeriodStart) {
      return { status: "Pre-Admission", color: "bg-gray-100 border-gray-300", textColor: "text-gray-500" }
    }

    if (!payment.isActive) {
      return { status: "Inactive", color: "bg-gray-100 border-gray-200", textColor: "text-gray-600" }
    }

    if (payment.isSkipped) {
      return { status: "Skipped", color: "bg-gray-100 border-gray-200", textColor: "text-gray-600" }
    }

    if (payment.isWaived) {
      return { status: "Waived", color: "bg-blue-100 border-blue-200", textColor: "text-blue-600" }
    }

    if (payment.outstandingAmount <= 0.01) {
      return { status: "Paid in Full", color: "bg-green-50 border-green-200", textColor: "text-green-700" }
    } else if (payment.amountPaid > 0 && payment.outstandingAmount > 0) {
      return { status: "Partial Payment", color: "bg-orange-50 border-orange-200", textColor: "text-orange-700" }
    } else {
      return { status: "Unpaid", color: "bg-red-50 border-red-200", textColor: "text-red-700" }
    }
  }

  // Manual transfer handler - adapted from the provided snippet
  const handleManualTransfer = async () => {
    if (!transferData.newSchool.trim() || !transferData.reason.trim()) {
      alert("Please fill in all required fields") // Using alert as per original code's pattern
      return
    }

    const promotionManager = new PromotionManager(settings)
    // Assuming student.id is available and correct
    const result = await promotionManager.transferStudent(student.id, transferData)

    if (result.success) {
      alert(result.message) // Using alert as per original code's pattern
      // Navigate back or refresh to reflect changes on dashboard
      window.location.reload()
    } else {
      alert(`Transfer failed: ${result.message}`) // Using alert as per original code's pattern
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Student Information Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl text-purple-800 flex items-center gap-2">
              <User className="w-6 h-6" />
              Student Information
            </CardTitle>
            <div className="flex gap-2">
              <Button onClick={generatePDF} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export PDF
              </Button>
              {/* Transfer Student Button - opens the transfer dialog */}
              <Button
                onClick={() => setShowTransferDialog(true)}
                variant="outline"
                size="sm"
                className="text-blue-600 border-blue-600 hover:bg-blue-50"
              >
                Transfer Student
              </Button>
              {/* Transport Toggle Button */}
              <Button
                onClick={handleTransportToggle}
                variant="outline"
                size="sm"
                className={
                  student.hasTransport
                    ? "text-red-600 border-red-600 hover:bg-red-50"
                    : "text-green-600 border-green-600 hover:bg-green-50"
                }
              >
                {student.hasTransport ? (
                  <>
                    <TruckOff className="w-4 h-4 mr-2" />
                    Deactivate Transport
                  </>
                ) : (
                  <>
                    <Truck className="w-4 h-4 mr-2" />
                    Activate Transport
                  </>
                )}
              </Button>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button onClick={handleSaveEdit} size="sm" className="bg-green-600 hover:bg-green-700">
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                  <Button onClick={handleCancelEdit} variant="outline" size="sm">
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Full Name
                </Label>
                {isEditing ? (
                  <Input
                    value={editData.fullName}
                    onChange={(e) => handleEditChange("fullName", e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p className="text-lg font-semibold">{student.fullName}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Date of Birth
                </Label>
                {isEditing ? (
                  <Input
                    type="date"
                    value={editData.dateOfBirth}
                    onChange={(e) => handleEditChange("dateOfBirth", e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p>{new Date(student.dateOfBirth).toLocaleDateString()}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Parent Contact
                </Label>
                {isEditing ? (
                  <Input
                    value={editData.parentContact}
                    onChange={(e) => handleEditChange("parentContact", e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p>{student.parentContact}</p>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </Label>
                {isEditing ? (
                  <Input
                    value={editData.address}
                    onChange={(e) => handleEditChange("address", e.target.value)}
                    className="mt-1"
                  />
                ) : (
                  <p>{student.address}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Student ID</Label>
                <p className="font-mono text-lg">{student.id}</p>
              </div>

              <div>
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Admission Date
                </Label>
                {isEditing ? (
                  <div>
                    <Input
                      type="date"
                      value={editData.admissionDate}
                      onChange={(e) => handleEditChange("admissionDate", e.target.value)}
                      max={new Date().toISOString().split("T")[0]}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-600 mt-1">
                      📅 Changing admission date will recalculate outstanding fees
                    </p>
                  </div>
                ) : (
                  <p>{new Date(student.admissionDate).toLocaleDateString()}</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">Academic Year</Label>
                <p>{student.academicYear}</p>
              </div>

              <div>
                <Label className="text-sm font-medium">Class Information</Label>
                <div className="space-y-1">
                  <p className="font-medium">{student.className || "No class assigned"}</p>
                  <p className="text-sm text-gray-600">
                    Group:{" "}
                    {(Array.isArray(settings.classGroups) ? settings.classGroups : []).find(
                      (g) => g.id === student.classGroup,
                    )?.name || "Unassigned"}
                  </p>
                </div>
              </div>
            </div>

            {/* Custom School Fees Section */}
            {isEditing && (
              <div className="md:col-span-2">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-4">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Custom School Fees
                  </Label>
                  
                  <div className="flex items-center space-x-3">
                    <div
                      className="w-5 h-5 border rounded flex items-center justify-center cursor-pointer"
                      onClick={() => handleEditChange("hasCustomFees", !editData.hasCustomFees)}
                    >
                      {editData.hasCustomFees && <div className="w-3 h-3 bg-purple-600 rounded-sm"></div>}
                    </div>
                    <Label className="font-medium cursor-pointer" onClick={() => handleEditChange("hasCustomFees", !editData.hasCustomFees)}>
                      Enable Custom School Fees
                    </Label>
                  </div>

                  {editData.hasCustomFees && (
                    <div className="ml-6 space-y-3">
                      <div className="flex items-center gap-4">
                        <Label className="text-sm">
                          Custom {settings.billingCycle === BillingCycle.MONTHLY ? "Monthly" : "Per Term"} Fee ($)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={editData.customSchoolFee || 0}
                          onChange={(e) => handleEditChange("customSchoolFee", Number(e.target.value))}
                          className="w-32"
                          placeholder="0.00"
                        />
                        <span className="text-sm text-gray-600">
                          Annual: $
                          {settings.billingCycle === BillingCycle.MONTHLY
                            ? ((editData.customSchoolFee || 0) * 12).toFixed(2)
                            : ((editData.customSchoolFee || 0) * 3).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-700">
                        ⚠️ This will override the standard class group fee and recalculate all payment periods.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Display current fee information when not editing */}
            {!isEditing && (student.hasCustomFees || student.customSchoolFee) && (
              <div className="md:col-span-2">
                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Custom School Fees
                  </Label>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm">
                      <span className="font-medium">Status:</span> {student.hasCustomFees ? "Enabled" : "Disabled"}
                    </p>
                    {student.hasCustomFees && student.customSchoolFee && (
                      <>
                        <p className="text-sm">
                          <span className="font-medium">Custom Fee:</span> $
                          {student.customSchoolFee.toFixed(2)} per {settings.billingCycle === BillingCycle.MONTHLY ? "month" : "term"}
                        </p>
                        <p className="text-sm">
                          <span className="font-medium">Annual Total:</span> $
                          {settings.billingCycle === BillingCycle.MONTHLY
                            ? (student.customSchoolFee * 12).toFixed(2)
                            : (student.customSchoolFee * 3).toFixed(2)}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Notes Section */}
            <div className="md:col-span-2">
              <Label className="text-sm font-medium flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Notes
              </Label>
              {isEditing ? (
                <Textarea
                  value={editData.notes}
                  onChange={(e) => handleEditChange("notes", e.target.value)}
                  placeholder="Add any notes about the student..."
                  className="mt-1"
                  rows={3}
                />
              ) : (
                <p className="mt-1 text-gray-700">{student.notes || "No notes added"}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Outstanding Balance Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-purple-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Outstanding Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-center text-red-600 mb-4">
            ${outstandingBalance.toLocaleString()}
          </p>
        </CardContent>
      </Card>

      {/* Tuition Fee Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-purple-800 flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Tuition Fee Summary (to date)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {(() => {
            // Calculate tuition due & paid up to current date
            let tuitionDueToDate = 0
            let tuitionPaidToDate = 0

            if (Array.isArray(studentWithGuardedFeePayments.feePayments)) {
              const currentDate = new Date()
              const currentYear = currentDate.getFullYear()
              const admissionDate = new Date(student.admissionDate)
              const admissionPeriodStart = new Date(admissionDate.getFullYear(), admissionDate.getMonth(), 1)

              studentWithGuardedFeePayments.feePayments.forEach((payment) => {
                // Skip if this payment period is marked as skipped
                if (payment.isSkipped) return

                // Determine the start date for the payment period
                let periodStart: Date | null = null
                if (settings.billingCycle === BillingCycle.MONTHLY) {
                  periodStart = new Date(currentYear, payment.period - 1, 1)
                } else {
                  const term = TERMS.find((t) => t.period === payment.period)
                  if (term) {
                    periodStart = new Date(currentYear, term.months[0] - 1, 1)
                  }
                }

                // Skip future periods and pre-admission periods
                if (!periodStart || periodStart > currentDate || periodStart < admissionPeriodStart) return

                const transportPart = student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0
                const tuitionDue = Math.max(0, payment.amountDue - transportPart)
                const tuitionOutstanding = Math.max(0, payment.outstandingAmount - transportPart)

                tuitionDueToDate += tuitionDue
                tuitionPaidToDate += tuitionDue - tuitionOutstanding
              })
            }

            const tuitionProgress = tuitionDueToDate > 0 ? (tuitionPaidToDate / tuitionDueToDate) * 100 : 0
            return (
              <div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Tuition Due To-Date</p>
                    <p className="text-2xl font-bold text-purple-800">${tuitionDueToDate.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Tuition Paid</p>
                    <p className="text-2xl font-bold text-green-600">${tuitionPaidToDate.toLocaleString()}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-gray-600">Tuition Outstanding</p>
                    <p className="text-2xl font-bold text-red-600">${(tuitionDueToDate - tuitionPaidToDate).toLocaleString()}</p>
                  </div>
                </div>
                <div className="mb-6">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Tuition Payment Progress</span>
                    <span>{tuitionProgress.toFixed(1)}% Complete</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-3 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(tuitionProgress, 100)}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            )
          })()}
        </CardContent>
      </Card>

      {/* Monthly/Termly Payments Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl text-purple-800">
            {settings.billingCycle === BillingCycle.MONTHLY ? "Monthly Payments" : "Termly Payments"}
          </CardTitle>
          <p className="text-sm text-gray-600">
            Status colors: Green (paid), Orange (partial), Red (unpaid), Gray (future).
            Payment actions are available in Desktop (Electron) only.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.isArray(studentWithGuardedFeePayments.feePayments) &&
              studentWithGuardedFeePayments.feePayments
                .sort((a, b) => a.period - b.period)
                .map((payment, index) => {
                  const { status, color, textColor } = getPeriodStatus(payment)

                  return (
                    <div
                      key={payment.period}
                      className={`p-4 border rounded-lg transition-all hover:shadow-md ${color}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={`font-semibold ${textColor}`}>
                          {getPeriodName(payment.period, settings.billingCycle)}
                        </h3>
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
                      <div className="space-y-1 text-sm">
                        {!payment.isSkipped ? (
                          <>
                            {(() => {
                              const transportPart = student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0;
                              const tuitionDue = Math.max(0, payment.amountDue - transportPart);
                              return (
                                <p className="font-medium text-gray-700">Due: ${tuitionDue.toFixed(2)}</p>
                              );
                            })()}
                            <div className="flex items-center gap-2">
                              <Label htmlFor={`amountPaid-${payment.period}`} className="text-gray-600">
                                Paid:
                              </Label>
                              <Input
                                id={`amountPaid-${payment.period}`}
                                type="number"
                                min="0"
                                step="0.01"
                                value={partialPaymentAmounts[payment.period]}
                                onChange={(e) => handlePaymentAmountChange(payment.period, e.target.value)}
                                onBlur={() => handleUpdatePayment(index)}
                                className="w-32 py-1 h-8 text-sm"
                              />
                            </div>
                            {(() => {
                              let tuitionOutstanding: number
                              if (!student.hasTransport || payment.isTransportWaived) {
                                // For students with deactivated transport or waived transport, use full outstanding amount
                                tuitionOutstanding = payment.outstandingAmount
                              } else {
                                // For students with active transport, subtract transport component
                                const transportPart = student.transportFee || 0
                                tuitionOutstanding = Math.max(0, payment.outstandingAmount - transportPart)
                              }
                              return (
                                <p className="text-gray-600">Outstanding: ${tuitionOutstanding.toFixed(2)}</p>
                              );
                            })()}
                          </>
                        ) : (
                          <p className="text-gray-600 italic">Tuition/fees waived for this period</p>
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
                            onClick={() => handleToggleFeeSkip(index, !payment.isSkipped)}
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
            {(!Array.isArray(studentWithGuardedFeePayments.feePayments) || studentWithGuardedFeePayments.feePayments.length === 0) && (
              <div className="col-span-full text-center py-4 text-gray-500">
                No fee payments recorded for this student.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
      {/* Add TransportPaymentPanel after the main payment details */}
      {student.hasTransport && (
        <TransportPaymentPanel
          key={transportPanelKey} // Use key to force remount
          student={student}
          onUpdate={onUpdate}
          settings={settings}
        />
      )}
      {/* Transport Activation/Deactivation Dialog */}
      {showTransportDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Activate Transport Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transportFee">Monthly Transport Fee ($)</Label>
                <Input
                  id="transportFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={newTransportFee}
                  onChange={(e) => setNewTransportFee(Number(e.target.value))}
                  placeholder="Enter monthly transport fee"
                />
              </div>
              <p className="text-sm text-gray-600">
                Transport will be activated from the current month onwards for the 9-month billing cycle.
              </p>
              <div className="flex gap-2">
                <Button onClick={handleActivateTransport} className="flex-1">
                  Activate Transport
                </Button>
                <Button onClick={() => setShowTransportDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      {/* Transfer Dialog */}
      {showTransferDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Transfer Student</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="transferDate">Transfer Date</Label>
                <Input
                  id="transferDate"
                  type="date"
                  value={transferData.transferDate}
                  onChange={(e) => setTransferData((prev) => ({ ...prev, transferDate: e.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="newSchool">New School</Label>
                <Input
                  id="newSchool"
                  value={transferData.newSchool}
                  onChange={(e) => setTransferData((prev) => ({ ...prev, newSchool: e.target.value }))}
                  placeholder="Enter new school name"
                />
              </div>
              <div>
                <Label htmlFor="reason">Transfer Reason</Label>
                <Textarea
                  id="reason"
                  value={transferData.reason}
                  onChange={(e) => setTransferData((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Enter reason for transfer"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="retainHistory"
                  checked={transferData.retainPaymentHistory}
                  onChange={(e) => setTransferData((prev) => ({ ...prev, retainPaymentHistory: e.target.checked }))}
                />
                <Label htmlFor="retainHistory">Retain payment history</Label>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleManualTransfer} className="flex-1">
                  Transfer Student
                </Button>
                <Button onClick={() => setShowTransferDialog(false)} variant="outline" className="flex-1">
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}