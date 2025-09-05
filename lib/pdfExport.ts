/**
 * PDF export utilities for student details and reports
 */

import type { Student, AppSettings } from "../types/index"
import { calculateStudentTotals, calculateOutstandingFromEnrollment } from "./calculations"
import { getCurrentDate, getMonthName, formatCurrency } from "./dateUtils"

// Type definitions for autoTable data
interface AutoTableData {
  cell: {
    text: string[]
    styles: {
      fillColor?: number[]
      textColor?: number[]
      halign?: string
      fontStyle?: string
      cellWidth?: number | string
      lineWidth?: number
      lineColor?: number[]
    }
  }
  column: {
    index: number
  }
  row: {
    index: number
  }
}

// Helper function to get transport payment display
const getTransportPaymentDisplay = (student: Student) => {
  if (!student.hasTransport) return ""
  const transportPayments = student.transportPayments || []
  const skippedMonths = transportPayments.filter(p => p.isSkipped).length
  const totalPaid = transportPayments.reduce((sum, p) => sum + p.amountPaid, 0)
  
  let display = formatCurrency(totalPaid)
  if (skippedMonths > 0) {
    display += ` (${skippedMonths} Skipped)`
  }
  return display
}

// Helper function to get payment status
const getPaymentStatus = (student: Student, settings: AppSettings) => {
  const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
  const totals = calculateStudentTotals(student, settings.billingCycle)
  
  if (outstanding <= 0.01) return { status: "Fully Paid", color: [220, 252, 231] }
  if (outstanding / totals.annualFeeCalculated < 0.1) return { status: "Nearly Complete", color: [219, 234, 254] }
  if (outstanding / totals.annualFeeCalculated < 0.3) return { status: "Good Standing", color: [238, 242, 255] }
  if (totals.totalPaid > 0) return { status: "Partial Payment", color: [254, 249, 195] }
  if (outstanding / totals.annualFeeCalculated > 0.7) return { status: "Critical", color: [254, 226, 226] }
  return { status: "Behind Schedule", color: [254, 226, 226] }
}

// Helper function to get student payment status with detailed analysis
const getStudentPaymentStatus = (student: Student, settings: AppSettings): string => {
  const { totalPaid, annualFeeCalculated } = calculateStudentTotals(student, settings.billingCycle)
  const percentage = annualFeeCalculated > 0 ? (totalPaid / annualFeeCalculated) * 100 : 0

  if (percentage >= 100) return "Fully Paid"
  if (percentage >= 90) return "Nearly Complete"
  if (percentage >= 75) return "Good Standing"
  if (percentage >= 50) return "Partial Payment"
  if (percentage >= 25) return "Behind Schedule"
  return "Overdue"
}

// Improved jsPDF loader with better error handling
const loadJsPDF = async () => {
  if (typeof window === "undefined") {
    throw new Error("PDF generation is only available in browser environment")
  }

  try {
    // Try multiple import strategies
    let jsPDF: any = null
    let autoTable: any = null

    // Strategy 1: Direct import
    try {
      const jsPDFModule = await import("jspdf")
      jsPDF = jsPDFModule.jsPDF || jsPDFModule.default

      const autoTableModule = await import("jspdf-autotable")
      autoTable = autoTableModule.default || autoTableModule

      console.log("Strategy 1 - Direct import successful", { jsPDF: !!jsPDF, autoTable: !!autoTable })
    } catch (error) {
      console.log("Strategy 1 failed:", error)
    }

    // Strategy 2: Window global fallback
    if (!jsPDF && typeof window !== "undefined") {
      try {
        jsPDF = (window as any).jspdf?.jsPDF || (window as any).jsPDF
        console.log("Strategy 2 - Window global:", { jsPDF: !!jsPDF })
      } catch (error) {
        console.log("Strategy 2 failed:", error)
      }
    }

    // Strategy 3: CDN fallback
    if (!jsPDF) {
      try {
        // Load jsPDF from CDN as fallback
        await loadScriptFromCDN("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js")
        await loadScriptFromCDN(
          "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js",
        )

        jsPDF = (window as any).jspdf?.jsPDF || (window as any).jsPDF
        console.log("Strategy 3 - CDN fallback:", { jsPDF: !!jsPDF })
      } catch (error) {
        console.log("Strategy 3 failed:", error)
      }
    }

    if (!jsPDF) {
      throw new Error("Could not load jsPDF library")
    }

    // Test jsPDF constructor
    try {
      const testDoc = new jsPDF()
      if (typeof testDoc.text !== "function") {
        throw new Error("jsPDF constructor test failed - missing text method")
      }
      console.log("jsPDF constructor test passed")
    } catch (error) {
      console.error("jsPDF constructor test failed:", error)
      throw new Error("jsPDF library is not working correctly")
    }

    return jsPDF
  } catch (error) {
    console.error("Failed to load jsPDF:", error)
    throw new Error("PDF library failed to load. Please refresh the page and try again.")
  }
}

// Helper function to load scripts from CDN
const loadScriptFromCDN = (src: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    // Check if script is already loaded
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }

    const script = document.createElement("script")
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
}

// Enhanced Electron detection and PDF saving
const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI && window.electronAPI.isElectron
}

const savePDF = async (doc: any, fileName: string, reportType = "Student Report") => {
  try {
    if (isElectron() && window.electronAPI) {
      const pdfBuffer = doc.output("arraybuffer")
      const result = await window.electronAPI.savePDF(fileName, pdfBuffer)

      if (result.success) {
        await window.electronAPI.showMessage({
          type: "info",
          title: "PDF Export Successful",
          message: `${reportType} exported successfully!`,
          detail: `PDF saved to: ${result.filePath}`,
        })
      } else {
        await window.electronAPI.showMessage({
          type: "error",
          title: "PDF Export Failed",
          message: `Failed to save ${reportType}`,
          detail: result.error || "Unknown error occurred",
        })
      }
    } else {
      doc.save(fileName)
    }
  } catch (error) {
    console.error("Error saving PDF:", error)
    const errorMessage = error instanceof Error ? error.message : "Unknown error"

    if (isElectron() && window.electronAPI) {
      await window.electronAPI.showMessage({
        type: "error",
        title: "PDF Export Error",
        message: `An error occurred while exporting ${reportType}`,
        detail: errorMessage,
      })
    } else {
      alert(`${reportType} export failed: ${errorMessage}`)
    }
  }
}

/**
 * Exports content to a PDF document.
 * @param {string} content The HTML content to be exported.
 * @param {string} filename The name of the PDF file to be generated.
 */
export const exportToPDF = async (content: string, filename: string) => {
  try {
    const jsPDF = await loadJsPDF()
    // Initialize jsPDF
    const pdf = new jsPDF()

    // Add content to the PDF
    pdf.html(content, {
      callback: (doc: any) => {
        // Save the PDF
        doc.save(`${filename}.pdf`)
      },
      margin: [10, 10, 10, 10],
      autoPaging: "text",
      x: 0,
      y: 0,
      width: 190, //target width in the PDF document
      windowWidth: 675, //window width in CSS pixels
    })
  } catch (error) {
    console.error("Error generating PDF:", error)
    // Fallback option: Display error message to the user
    alert("Failed to generate PDF. Please try again later.")
  }
}

// Manual table drawing function with proper headers and improved spacing
const drawManualTable = (
  doc: any, // jsPDF instance type
  startY: number,
  headers: string[],
  data: string[][],
  title?: string,
): number => {
  let yPos = startY
  const cellHeight = 12 // Increased from 10 for better readability
  const startX = 20
  const pageWidth = doc.internal.pageSize.width - 40 // Leave margins
  const columnWidth = pageWidth / headers.length

  // Add table title if provided
  if (title) {
    doc.setFontSize(12)
    doc.setTextColor(107, 70, 193)
    doc.text(title, startX, yPos)
    yPos += 15
  }

  // Draw header row with background
  doc.setFontSize(9) // Slightly smaller for better fit
  doc.setFont(undefined, "bold")
  doc.setFillColor(107, 70, 193) // Purple background
  doc.setTextColor(255, 255, 255) // White text

  // Draw header background
  doc.rect(startX, yPos, pageWidth, cellHeight, "F")

  // Draw header text with better wrapping
  let xPos = startX
  headers.forEach((header, index) => {
    // Split long headers into multiple lines if needed
    const maxWidth = columnWidth - 4
    const lines = doc.splitTextToSize(header, maxWidth)

    // Center text in cell
    const startYText = yPos + (cellHeight - lines.length * 3) / 2 + 3

    lines.forEach((line: string, lineIndex: number) => {
      const textWidth = doc.getTextWidth(line)
      const textX = xPos + (columnWidth - textWidth) / 2
      doc.text(line, textX, startYText + lineIndex * 3)
    })

    // Draw vertical lines between columns
    if (index < headers.length - 1) {
      doc.setDrawColor(255, 255, 255)
      doc.line(xPos + columnWidth, yPos, xPos + columnWidth, yPos + cellHeight)
    }

    xPos += columnWidth
  })

  yPos += cellHeight

  // Draw data rows
  doc.setFont(undefined, "normal")
  doc.setTextColor(0, 0, 0)
  doc.setDrawColor(200, 200, 200) // Light gray for borders

  data.forEach((row, rowIndex) => {
    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(248, 248, 248) // Light gray
      doc.rect(startX, yPos, pageWidth, cellHeight, "F")
    }

    // Draw row border
    doc.rect(startX, yPos, pageWidth, cellHeight, "S")

    xPos = startX
    row.forEach((cell, cellIndex) => {
      // Handle text wrapping for long content
      const text = cell || ""
      const maxWidth = columnWidth - 6 // Leave more padding

      // Split text if it's too long
      const lines = doc.splitTextToSize(text, maxWidth)
      let displayText = lines.length > 1 ? lines[0] : text

      // Truncate if still too long
      if (doc.getTextWidth(displayText) > maxWidth) {
        while (doc.getTextWidth(displayText + "...") > maxWidth && displayText.length > 0) {
          displayText = displayText.substring(0, displayText.length - 1)
        }
        if (displayText.length > 0) {
          displayText += "..."
        }
      }

      // Center or align text based on content
      let textX = xPos + 3 // Default left align with padding
      if (cellIndex > 1 && (displayText.includes("$") || displayText.match(/^\d/))) {
        // Right align numbers and currency
        const textWidth = doc.getTextWidth(displayText)
        textX = xPos + columnWidth - textWidth - 3
      } else if (cellIndex === 1) {
        // Center align class names
        const textWidth = doc.getTextWidth(displayText)
        textX = xPos + (columnWidth - textWidth) / 2
      }

      doc.text(displayText, textX, yPos + 8)

      // Draw vertical lines between columns
      if (cellIndex < row.length - 1) {
        doc.line(xPos + columnWidth, yPos, xPos + columnWidth, yPos + cellHeight)
      }

      xPos += columnWidth
    })

    yPos += cellHeight

    // Add new page if needed
    if (yPos > 260) {
      // Adjusted for better page breaks
      doc.addPage()
      yPos = 20
    }
  })

  return yPos + 15
}

// Fresh PDF export function for Student Details with clean structure - FIXED CALCULATION
export async function exportStudentDetailsPDF(student: Student, settings: AppSettings): Promise<void> {
  try {
    console.log("Starting PDF export for student:", student.fullName)

    const jsPDF = await loadJsPDF()
    console.log("jsPDF loaded successfully")

    const doc = new jsPDF()
    console.log("jsPDF document created")

    // Calculate student totals
    const totals = calculateStudentTotals(student, settings.billingCycle)

    // Header Section - matching the sample
    doc.setFontSize(18)
    doc.setTextColor(107, 70, 193)
    doc.text(settings.schoolName || "Royal Junior School", 20, 25)

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text("Student Details Report", 20, 40)

    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 50)
    doc.text(`Academic Year: ${student.academicYear || new Date().getFullYear()}`, 120, 50)

    let yPos = 70

    // STUDENT INFORMATION Section
    doc.setFontSize(12)
    doc.setTextColor(107, 70, 193)
    doc.text("STUDENT INFORMATION", 20, yPos)
    yPos += 15

    // Student info in two columns like the sample
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)

    // Left column
    doc.text(`Student Name: ${student.fullName}`, 25, yPos)
    doc.text(`Student ID: ${student.id}`, 25, yPos + 10)
    doc.text(`Date of Birth: ${new Date(student.dateOfBirth).toLocaleDateString()}`, 25, yPos + 20)
    doc.text(`Parent Contact: ${student.parentContact}`, 25, yPos + 30)
    doc.text(`Address: ${student.address}`, 25, yPos + 40)

    // Right column
    doc.text(`Class: ${student.className || "Not assigned"}`, 110, yPos)
    doc.text(`Admission Date: ${new Date(student.admissionDate).toLocaleDateString()}`, 110, yPos + 10)
    doc.text(`Academic Year: ${student.academicYear || new Date().getFullYear()}`, 110, yPos + 20)
    doc.text(`Transport: ${student.hasTransport ? "Yes" : "No"}`, 110, yPos + 30)

    yPos += 60

    // PAYMENT HISTORY - Main Heading
    doc.setFontSize(14)
    doc.setTextColor(107, 70, 193)
    doc.text("PAYMENT HISTORY", 20, yPos)
    yPos += 15

    // TUITION FEES SUMMARY
    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    
    doc.text('Tuition Fees:', 25, yPos)
    yPos += 8

    // Get all past due payments (due date <= today)
    const todayZero = new Date()
    todayZero.setHours(0, 0, 0, 0)
    
    const pastDuePayments = Array.isArray(student.feePayments)
      ? student.feePayments.filter((p) => {
          const d = new Date(p.dueDate)
          d.setHours(0, 0, 0, 0)
          return d <= todayZero
        })
      : []

    // Calculate totals for past due payments
    let totalTuitionDue = 0
    let totalTuitionPaid = 0

    pastDuePayments.forEach(payment => {
      // Amount Due (tuition only - exclude transport)
      const transportPart = student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0
      totalTuitionDue += Math.max(0, payment.amountDue - transportPart)
      
      // Amount Paid (raw tuition paid - no transport subtraction)
      totalTuitionPaid += payment.amountPaid
    })

    // Calculate outstanding (Expected - Paid)
    const totalTuitionOutstanding = Math.max(0, totalTuitionDue - totalTuitionPaid)

    doc.text(`Expected (Past Due): ${formatCurrency(totalTuitionDue)}`, 25, yPos)
    yPos += 8
    doc.text(`Paid (Past Due): ${formatCurrency(totalTuitionPaid)}`, 25, yPos)
    yPos += 8
    doc.text(`Outstanding (Past Due): ${formatCurrency(totalTuitionOutstanding)}`, 25, yPos)
    yPos += 20

    // TUITION PAYMENT HISTORY TABLE
    doc.setFontSize(12)
    doc.setTextColor(107, 70, 193)
    doc.text("Tuition Payment History", 20, yPos)
    yPos += 10

    if (Array.isArray(student.feePayments) && student.feePayments.length > 0) {
      // Filter current and past periods only
      const currentDate = new Date()
      currentDate.setHours(0, 0, 0, 0) // For consistent comparison

      const tuitionTableData = student.feePayments
        .filter((payment) => {
          const paymentDueDate = new Date(payment.dueDate)
          paymentDueDate.setHours(0, 0, 0, 0)
          return paymentDueDate <= currentDate
        })
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
        .map((payment) => {
          // Tuition figures: use raw tuition amounts (payment.amountDue and payment.amountPaid already represent tuition only)
          // Amount Due should reflect tuition only (exclude transport component)
          const transportPart =
            student.hasTransport && !payment.isTransportWaived ? student.transportFee : 0
          const tuitionDue = Math.max(0, payment.amountDue - transportPart)
          const tuitionPaidForPeriod = payment.amountPaid
          const tuitionOutstandingForPeriod = Math.max(0, tuitionDue - tuitionPaidForPeriod)

          return [
            settings.billingCycle === "monthly" ? getMonthName(payment.period) : `Term ${payment.period}`,
            formatCurrency(tuitionDue),
            formatCurrency(tuitionPaidForPeriod),
            formatCurrency(tuitionOutstandingForPeriod),
            tuitionOutstandingForPeriod <= 0.01 ? "Paid" : tuitionPaidForPeriod > 0 ? "Partial" : "Outstanding",
          ]
        })

      // Create tuition table
      if (typeof doc.autoTable === "function") {
        try {
          doc.autoTable({
            startY: yPos,
            head: [["Period", "Amount Due", "Amount Paid", "Outstanding", "Status"]],
            body: tuitionTableData,
            theme: "grid",
            headStyles: {
              fillColor: [107, 70, 193],
              textColor: [255, 255, 255],
              fontSize: 10,
              fontStyle: "bold",
              halign: "center",
              valign: "middle",
            },
            bodyStyles: {
              fontSize: 9,
              textColor: [0, 0, 0],
              halign: "center",
            },
            columnStyles: {
              0: { cellWidth: 30, halign: "left" },
              1: { cellWidth: 30, halign: "right" },
              2: { cellWidth: 30, halign: "right" },
              3: { cellWidth: 30, halign: "right" },
              4: { cellWidth: 30, halign: "center" },
            },
            margin: { left: 20, right: 20 },
            tableWidth: "auto",
            showHead: "everyPage",
          })

          yPos = (doc as any).lastAutoTable.finalY + 20
        } catch (error) {
          console.log("autoTable failed, using manual table:", error)
          yPos =
            drawManualTable(
              doc,
              yPos,
              ["Period", "Amount Due", "Amount Paid", "Outstanding", "Status"],
              tuitionTableData,
            ) + 10
        }
      } else {
        yPos =
          drawManualTable(
            doc,
            yPos,
            ["Period", "Amount Due", "Amount Paid", "Outstanding", "Status"],
            tuitionTableData,
          ) + 10
      }
    } else {
      doc.setFontSize(10)
      doc.setTextColor(128, 128, 128)
      doc.text("No tuition payment records found for past due periods.", 25, yPos + 10)
      yPos += 30
    }

    // TRANSPORT PAYMENT HISTORY TABLE (only if transport is activated)
    if (student.hasTransport) {
      // Check if we need a new page
      if (yPos > 200) {
        doc.addPage()
        yPos = 20
      }
      
      // TRANSPORT FEES SUMMARY - Placed before Transport Payment History table
      doc.setFontSize(12)
      doc.setTextColor(107, 70, 193)
      doc.text("TRANSPORT FEES SUMMARY", 20, yPos)
      yPos += 10
      
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      
      const todayZero = new Date()
      todayZero.setHours(0, 0, 0, 0)
      
      const pastDueTransport = Array.isArray(student.transportPayments)
        ? student.transportPayments.filter((p) => {
            const d = new Date(p.dueDate)
            d.setHours(0, 0, 0, 0)
            return d <= todayZero && !p.isSkipped
          })
        : []

      let transportDue = 0
      let transportPaid = 0

      pastDueTransport.forEach(payment => {
        transportDue += payment.amountDue
        transportPaid += payment.amountPaid
      })

      const transportOutstanding = Math.max(0, transportDue - transportPaid)

      doc.text(`Expected (Past Due): ${formatCurrency(transportDue)}`, 25, yPos)
      yPos += 8
      doc.text(`Paid (Past Due): ${formatCurrency(transportPaid)}`, 25, yPos)
      yPos += 8
      doc.text(`Outstanding (Past Due): ${formatCurrency(transportOutstanding)}`, 25, yPos)
      yPos += 15

      doc.setFontSize(12)
      doc.setTextColor(107, 70, 193)
      doc.text("Transport Payment History", 20, yPos)
      yPos += 10

      if (Array.isArray(student.transportPayments) && student.transportPayments.length > 0) {
        const currentDate = new Date()
        currentDate.setHours(0, 0, 0, 0) // For consistent comparison

        const transportTableData = student.transportPayments
          .filter((payment) => {
            const paymentDueDate = new Date(payment.dueDate)
            paymentDueDate.setHours(0, 0, 0, 0)
            return paymentDueDate <= currentDate
          })
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .map((payment) => {
            let status = "Outstanding"
            if (payment.isSkipped) status = "Skipped"
            else if (payment.outstandingAmount <= 0.01) status = "Paid"
            else if (payment.amountPaid > 0) status = "Partial"

            return [
              getMonthName(payment.month),
              formatCurrency(payment.amountDue),
              formatCurrency(payment.amountPaid),
              formatCurrency(payment.outstandingAmount),
              status,
              payment.paidDate ? new Date(payment.paidDate).toLocaleDateString() : "-",
            ]
          })

        // Create transport table
        if (typeof doc.autoTable === "function") {
          try {
            doc.autoTable({
              startY: yPos,
              head: [["Month", "Amount Due", "Amount Paid", "Outstanding", "Status", "Paid Date"]],
              body: transportTableData,
              theme: "grid",
              headStyles: {
                fillColor: [107, 70, 193],
                textColor: [255, 255, 255],
                fontSize: 10,
                fontStyle: "bold",
                halign: "center",
                valign: "middle",
              },
              bodyStyles: {
                fontSize: 9,
                textColor: [0, 0, 0],
                halign: "center",
              },
              columnStyles: {
                0: { cellWidth: 25, halign: "left" },
                1: { cellWidth: 25, halign: "right" },
                2: { cellWidth: 25, halign: "right" },
                3: { cellWidth: 25, halign: "right" },
                4: { cellWidth: 25, halign: "center" },
                5: { cellWidth: 25, halign: "center" },
              },
              margin: { left: 20, right: 20 },
              tableWidth: "auto",
              showHead: "everyPage",
            })

            yPos = (doc as any).lastAutoTable.finalY + 15
          } catch (error) {
            console.log("autoTable failed for transport, using manual table:", error)
            yPos = drawManualTable(
              doc,
              yPos,
              ["Month", "Amount Due", "Amount Paid", "Outstanding", "Status", "Paid Date"],
              transportTableData,
            )
          }
        } else {
          yPos = drawManualTable(
            doc,
            yPos,
            ["Month", "Amount Due", "Amount Paid", "Outstanding", "Status", "Paid Date"],
            transportTableData,
          )
        }
      } else {
        doc.setFontSize(10)
        doc.setTextColor(128, 128, 128)
        doc.text("No transport payment records found for past due periods.", 25, yPos + 10)
        yPos += 30
      }
    }

    // ADDITIONAL INFORMATION Section (if notes exist)
    if (student.notes && student.notes.trim()) {
      // Check if we need a new page
      if (yPos > 250) {
        doc.addPage()
        yPos = 20
      }

      doc.setFontSize(12)
      doc.setTextColor(107, 70, 193)
      doc.text("ADDITIONAL INFORMATION", 20, yPos)
      yPos += 15

      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      const noteLines = doc.splitTextToSize(student.notes, 170)
      doc.text(noteLines, 25, yPos)
      yPos += noteLines.length * 5 + 10
    }

    // Removed duplicate payment summary section

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10)
      doc.text("Powered by My Students Track", 20, doc.internal.pageSize.height - 10)
    }

    console.log("PDF generation completed, saving...")

    const fileName = `${student.fullName.replace(/\s+/g, "_")}_Details_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "Student Details Report")

    console.log("PDF saved successfully")
  } catch (error) {
    console.error("Error exporting student details:", error)

    if (isElectron() && window.electronAPI) {
      await window.electronAPI.showMessage({
        type: "error",
        title: "PDF Export Failed",
        message: "Failed to export student details",
        detail: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } else {
      alert(`Failed to export student details: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    throw error
  }
}

// Class report export function - FIXED CALCULATION
export async function exportClassReportPDF(students: Student[], classGroupId: string, settings: AppSettings) {
  try {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF()

    const classGroup = settings.classGroups.find((g) => g.id === classGroupId)
    const className = classGroup?.name || "Unknown Class"
    const classStudents = students.filter((s) => s.classGroup === classGroupId)

    // Header
    doc.setFontSize(20)
    doc.setTextColor(128, 0, 128)
    doc.text(settings.schoolName || "My Students Track", 20, 25)

    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.text(`Class Report: ${className}`, 20, 40)

    doc.setFontSize(10)
    doc.text(`Generated: ${getCurrentDate()}`, 20, 50)
    doc.text(`Total Students: ${classStudents.length}`, 120, 50)

    let yPosition = 70

    // Summary statistics - FIXED CALCULATION
    const totalExpected = classStudents.reduce((sum, student) => {
      const { expectedToDate } = calculateStudentTotals(student, settings.billingCycle)
      return sum + expectedToDate
    }, 0)

    const totalPaid = classStudents.reduce((sum, student) => {
      const { totalPaid } = calculateStudentTotals(student, settings.billingCycle)
      return sum + totalPaid
    }, 0)

    // FIXED: Calculate outstanding as Expected - Paid
    const totalOutstandingPastDue = Math.max(0, totalExpected - totalPaid)

    doc.setFontSize(12)
    doc.setTextColor(128, 0, 128)
    doc.text("CLASS SUMMARY", 20, yPosition)
    yPosition += 15

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(`Total Expected: ${formatCurrency(totalExpected)}`, 20, yPosition)
    yPosition += 8
    doc.text(`Total Collected: ${formatCurrency(totalPaid)}`, 20, yPosition)
    yPosition += 8
    // FIXED: Display corrected outstanding calculation
    doc.text(`Total Outstanding (Past Due): ${formatCurrency(totalOutstandingPastDue)}`, 20, yPosition)
    yPosition += 8
    doc.text(
      `Collection Rate: ${totalExpected > 0 ? ((totalPaid / totalExpected) * 100).toFixed(1) : 0}%`,
      20,
      yPosition,
    )
    yPosition += 20

    // Student details table - FIXED CALCULATION
    const headers = ["Student Name", "Expected", "Paid", "Outstanding", "Status"]
    const data = classStudents.map((student) => {
      const { totalPaid, expectedToDate } = calculateStudentTotals(student, settings.billingCycle)
      // FIXED: Calculate outstanding as Expected - Paid
      const outstanding = Math.max(0, expectedToDate - totalPaid)
      const status = getStudentPaymentStatus(student, settings)

      return [
        student.fullName,
        formatCurrency(expectedToDate),
        formatCurrency(totalPaid),
        formatCurrency(outstanding), // This will now be correctly calculated
        status,
      ]
    })

    yPosition = drawManualTable(doc, yPosition, headers, data)

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text("Powered by My Students Track", 20, doc.internal.pageSize.height - 10)

    const fileName = `${className.replace(/\s+/g, "_")}_Class_Report_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "Class Report")
  } catch (error) {
    console.error("Error generating class report PDF:", error)
  }
}

// UPDATED: Enhanced comprehensive report export to match the sample format - FIXED CALCULATION
export async function exportComprehensiveReportPDF(students: Student[], settings: AppSettings) {
  try {
    console.log("Starting comprehensive report generation")
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF()
    const currentYear = new Date().getFullYear()
    const currentDate = new Date()

    // Calculate school-wide and class-wise summaries
    const totalStudents = students.length
    let totalExpected = 0
    let totalPaid = 0
    let totalOutstanding = 0
    
    // Group students by class for summary
    const classBreakdowns: Record<string, {
      studentCount: number
      expected: number
      paid: number
      outstanding: number
      transportExpected: number
      transportPaid: number
      transportOutstanding: number
    }> = {}

    // Calculate total tuition and transport paid
    let totalTuitionPaid = 0
    let totalTransportPaid = 0
    
    // Process all students to get accurate totals
    students.forEach((student) => {
      const totals = calculateStudentTotals(student, settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
      const transportOutstanding = student.hasTransport ? (totals.transportOutstanding || 0) : 0
      const tuitionOutstanding = outstanding - transportOutstanding
      
      // Update class breakdown
      const className = student.className || "Not assigned"
      if (!classBreakdowns[className]) {
        classBreakdowns[className] = {
          studentCount: 0,
          expected: 0,
          paid: 0,
          outstanding: 0,
          transportExpected: 0,
          transportPaid: 0,
          transportOutstanding: 0
        }
      }
      
      const classData = classBreakdowns[className]
      classData.studentCount++
      classData.expected += totals.expectedToDate
      classData.paid += totals.totalPaid
      classData.outstanding += outstanding
      
      if (student.hasTransport) {
        classData.transportExpected += totals.transportFeesTotal || 0
        classData.transportPaid += totals.transportPaid || 0
        classData.transportOutstanding += transportOutstanding
        totalTransportPaid += totals.transportPaid || 0
      }
      
      // Update school-wide totals
      totalExpected += totals.expectedToDate
      totalPaid += totals.totalPaid
      totalOutstanding += outstanding
      totalTuitionPaid += (totals.totalPaid - (totals.transportPaid || 0))
    })

    // Header Section
    doc.setFontSize(18)
    doc.setTextColor(107, 70, 193)
    doc.text(settings.schoolName || "My Students Track", 20, 25)

    doc.setFontSize(14)
    doc.setTextColor(0, 0, 0)
    doc.text("Comprehensive Financial Report", 20, 40)

    doc.setFontSize(10)
    doc.text(`Generated: ${currentDate.toLocaleDateString()}`, 20, 50)
    doc.text(`Academic Year: ${currentYear}`, 120, 50)
    doc.text(`Total Students: ${totalStudents}`, 20, 60)

    let yPos = 80

    // SCHOOL-WIDE SUMMARY Section
    doc.setFontSize(12)
    doc.setTextColor(107, 70, 193)
    doc.text("SCHOOL-WIDE SUMMARY", 20, yPos)
    yPos += 15

    // Summary table data - Match UI exactly
    const summaryData = [
      ["Total Students", totalStudents.toString()],
      ["Total Expected (School-wide)", formatCurrency(totalExpected)],
      ["Total Paid (School-wide)", formatCurrency(totalPaid)],
      ["  - Tuition Fees", formatCurrency(totalTuitionPaid)],
      ["  - Transport Fees", formatCurrency(totalTransportPaid)],
      ["Total Outstanding (School-wide)", formatCurrency(totalOutstanding)],
    ]

    // Create summary table
    if (typeof doc.autoTable === "function") {
      try {
        doc.autoTable({
          startY: yPos,
          head: [["Metric", "Amount"]],
          body: summaryData,
          theme: "grid",
          headStyles: {
            fillColor: [107, 70, 193],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            halign: "center",
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [0, 0, 0],
          },
          columnStyles: {
            0: { cellWidth: 100, halign: "left" },
            1: { cellWidth: 60, halign: "right" },
          },
          margin: { left: 20, right: 20 },
          tableWidth: "auto",
          didParseCell: (data: AutoTableData) => {
            // Indent sub-items
            if (data.cell.text && data.cell.text[0] === '  - ') {
              data.cell.styles.fontStyle = 'normal'
              data.cell.styles.textColor = [100, 100, 100]
            }
          }
        })

        yPos = (doc as any).lastAutoTable.finalY + 20
      } catch (error) {
        console.log("autoTable failed for summary, using manual table:", error)
        yPos = drawManualTable(doc, yPos, ["Metric", "Amount"], summaryData) + 10
      }
    } else {
      yPos = drawManualTable(doc, yPos, ["Metric", "Amount"], summaryData) + 10
    }

    // Prepare student data for the table
    const studentTableData = students.map((student) => {
      const totals = calculateStudentTotals(student, settings.billingCycle)
      const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
      const transportDisplay = getTransportPaymentDisplay(student)
      const status = getPaymentStatus(student, settings)

      return [
        student.fullName,
        student.className || "Not assigned",
        formatCurrency(totals.totalPaid),
        transportDisplay,
        formatCurrency(totals.expectedToDate), // Use expectedToDate instead of annualFeeCalculated
        formatCurrency(outstanding)
      ]
    })

    // Create student details table with exact UI matching
    if (typeof doc.autoTable === "function") {
      try {
        // Add school-wide summary
        doc.setFontSize(12)
        doc.setTextColor(107, 70, 193)
        doc.text("School-wide Summary", 15, yPos + 10)
        
        // School summary table
        doc.autoTable({
          startY: yPos + 15,
          head: [["Metric", "Amount"]],
          body: [
            ["Total Students", totalStudents.toString()],
            ["Total Expected (School-wide)", formatCurrency(totalExpected)],
            ["Total Paid (School-wide)", formatCurrency(totalPaid)],
            ["Total Outstanding (School-wide)", formatCurrency(totalOutstanding)]
          ],
          theme: "grid",
          headStyles: {
            fillColor: [107, 70, 193],
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            halign: "center"
          },
          bodyStyles: {
            fontSize: 9,
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: 100, halign: "left" },
            1: { cellWidth: 60, halign: "right" }
          },
          margin: { left: 15, right: 15 }
        })

        // Add class breakdowns
        yPos = (doc as any).lastAutoTable.finalY + 15
        doc.setFontSize(12)
        doc.text("Class-wise Breakdown", 15, yPos)
        
        // Class breakdown table
        const classBreakdownData = Object.entries(classBreakdowns).map(([className, data]) => [
          className,
          data.studentCount.toString(),
          formatCurrency(data.expected),
          formatCurrency(data.paid),
          formatCurrency(data.outstanding),
          `${data.expected > 0 ? ((data.paid / data.expected) * 100).toFixed(1) : '0.0'}%`
        ])
        
        doc.autoTable({
          startY: yPos + 5,
          head: [["Class", "Students", "Expected", "Paid", "Outstanding", "Collection Rate"]],
          body: classBreakdownData,
          theme: "grid",
          headStyles: {
            fillColor: [107, 70, 193],
            textColor: [255, 255, 255],
            fontSize: 9,
            fontStyle: "bold",
            halign: "center"
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [0, 0, 0]
          },
          columnStyles: {
            0: { cellWidth: 40, halign: "left" },
            1: { cellWidth: 20, halign: "center" },
            2: { cellWidth: 30, halign: "right" },
            3: { cellWidth: 30, halign: "right" },
            4: { cellWidth: 30, halign: "right" },
            5: { cellWidth: 30, halign: "right" }
          },
          margin: { left: 15, right: 15 },
          didParseCell: (data: AutoTableData) => {
            if (data.column.index >= 2 && data.column.index <= 4) {
              data.cell.styles.halign = 'right';
            }
          }
        })

        // Add student details
        yPos = (doc as any).lastAutoTable.finalY + 15
        doc.setFontSize(12)
        doc.text("Student Details", 15, yPos)
        
        // Student details table
        doc.autoTable({
          startY: yPos + 5,
          head: [
            [
              { 
                content: "Student Name", 
                styles: { 
                  halign: 'left', 
                  fillColor: [107, 70, 193], 
                  textColor: [255, 255, 255],
                  cellWidth: 40,
                  lineWidth: 0.5,
                  lineColor: [255, 255, 255]
                } 
              },
              { 
                content: "Class Name", 
                styles: { 
                  halign: 'left', 
                  fillColor: [107, 70, 193], 
                  textColor: [255, 255, 255],
                  cellWidth: 30,
                  lineWidth: 0.5,
                  lineColor: [255, 255, 255]
                } 
              },
              { 
                content: `${settings.billingCycle === "monthly" ? "Monthly" : "Termly"} Fees Paid`,
                styles: { 
                  halign: 'center', 
                  fillColor: [107, 70, 193], 
                  textColor: [255, 255, 255],
                  cellWidth: 30,
                  lineWidth: 0.5,
                  lineColor: [255, 255, 255]
                } 
              },
              { 
                content: "Transport Paid", 
                styles: { 
                  halign: 'center', 
                  fillColor: [107, 70, 193], 
                  textColor: [255, 255, 255],
                  cellWidth: 30,
                  lineWidth: 0.5,
                  lineColor: [255, 255, 255]
                } 
              },
              { 
                content: "Total Expected (Per Student)", 
                styles: { 
                  halign: 'center', 
                  fillColor: [107, 70, 193], 
                  textColor: [255, 255, 255],
                  cellWidth: 35,
                  lineWidth: 0.5,
                  lineColor: [255, 255, 255]
                } 
              },
              { 
                content: "Outstanding (Per Student)", 
                styles: { 
                  halign: 'center', 
                  fillColor: [107, 70, 193], 
                  textColor: [255, 255, 255],
                  cellWidth: 35,
                  lineWidth: 0.5,
                  lineColor: [255, 255, 255]
                } 
              }
            ]
          ],
          body: studentTableData,
          theme: "grid",
          headStyles: {
            fillColor: [107, 70, 193],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: "bold",
            halign: "center",
            valign: "middle",
            cellPadding: 3,
            lineWidth: 0.5,
            lineColor: [255, 255, 255]
          },
          bodyStyles: {
            fontSize: 8,
            textColor: [0, 0, 0],
            cellPadding: 2,
            valign: "middle",
            lineWidth: 0.1,
            lineColor: [200, 200, 200]
          },
          columnStyles: {
            0: { cellWidth: 40, halign: "left" },  // Student Name
            1: { cellWidth: 30, halign: "left" },  // Class Name
            2: { cellWidth: 30, halign: "right" }, // Fees Paid
            3: { cellWidth: 30, halign: "right" }, // Transport Paid
            4: { cellWidth: 35, halign: "right" }, // Total Expected
            5: { cellWidth: 35, halign: "right" }  // Outstanding
          },
          margin: { left: 15, right: 15 },
          tableWidth: "auto",
          showHead: "everyPage",
          styles: {
            overflow: "linebreak",
            cellWidth: "wrap",
            lineColor: [200, 200, 200],
            lineWidth: 0.1
          },
          didParseCell: (data: AutoTableData) => {
            // Right align numeric columns
            if (data.column.index >= 2) {
              data.cell.styles.halign = 'right';
            }
            
            // Highlight negative outstanding in red
            if (data.column.index === 5) {
              const value = data.cell.text[0]
              if (value.startsWith('(') || parseFloat(value.replace(/[^0-9.-]+/g, '')) > 0) {
                data.cell.styles.textColor = [220, 38, 38]
              }
            }
          }
        })

        yPos = (doc as any).lastAutoTable.finalY + 15
      } catch (error) {
        console.log("autoTable failed for student details, using manual table:", error)
        yPos = drawManualTable(
          doc,
          yPos,
          [
            "Student Name",
            "Class",
            settings.billingCycle === "monthly" ? "Monthly Fees Total Paid" : "Termly Fees Total Paid",
            "Transport Total Paid",
            "Total Expected",
            "Outstanding",
          ],
          studentTableData,
        )
      }
    } else {
      yPos = drawManualTable(
        doc,
        yPos,
        [
          "Student Name",
          "Class",
          settings.billingCycle === "monthly" ? "Monthly Fees" : "Term Fees",
          "Transport",
          "Total Expected",
          "Outstanding",
        ],
        studentTableData,
      )
    }

    // Footer
    const pageCount = doc.internal.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 30, doc.internal.pageSize.height - 10)
      doc.text("Powered by My Students Track", 20, doc.internal.pageSize.height - 10)
    }

    const fileName = `Comprehensive_Report_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "Comprehensive Report")

    console.log("Comprehensive report generated successfully")
  } catch (error) {
    console.error("Error generating comprehensive report PDF:", error)
    throw error
  }
}

// Export all students summary - FIXED CALCULATION
export async function exportAllStudentsSummaryPDF(students: Student[], settings: AppSettings) {
  try {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF()

    // Header
    doc.setFontSize(20)
    doc.setTextColor(107, 70, 193)
    doc.text(settings.schoolName || "My Students Track", 20, 25)

    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.text("All Students Summary", 20, 40)

    doc.setFontSize(10)
    doc.text(`Generated: ${getCurrentDate()}`, 20, 50)
    doc.text(`Total Students: ${students.length}`, 120, 50)

    let yPosition = 70

    // Students table - FIXED CALCULATION
    const headers = ["Name", "ID", "Class", "Expected", "Paid", "Outstanding", "Status"]
    const data = students.map((student) => {
      const totals = calculateStudentTotals(student, settings.billingCycle)
      // FIXED: Calculate outstanding as Expected - Paid
      const outstanding = Math.max(0, totals.expectedToDate - totals.totalPaid)
      const status = getStudentPaymentStatus(student, settings)

      return [
        student.fullName,
        student.id,
        student.className || "N/A",
        formatCurrency(totals.expectedToDate),
        formatCurrency(totals.totalPaid),
        formatCurrency(outstanding), // This will now be correctly calculated
        status,
      ]
    })

    yPosition = drawManualTable(doc, yPosition, headers, data)

    // Footer
    doc.setFontSize(8)
    doc.setTextColor(128, 128, 128)
    doc.text("Powered by My Students Track", 20, doc.internal.pageSize.height - 10)

    const fileName = `All_Students_Summary_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "All Students Summary")
  } catch (error) {
    console.error("Error generating all students summary PDF:", error)
  }
}

export async function exportOutstandingPaymentsPDF(students: Student[], settings: AppSettings): Promise<void> {
  // Implementation for outstanding payments PDF export will be added in next batch
  console.log("Outstanding payments PDF export not yet implemented")
}
