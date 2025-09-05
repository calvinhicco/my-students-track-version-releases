/**
 * Outstanding payments PDF export utilities
 */

import type { Student, AppSettings, FeePayment } from "../types/index"
import { getMonthName, getCurrentYear, formatCurrency } from "./dateUtils"
import { calculateStudentTotals, calculateOutstandingFromEnrollment } from "./calculations"
import { TERMS, BillingCycle } from "../types/index"
import "jspdf-autotable"

interface StudentData {
  id: string
  name: string
  email: string
  course: string
  outstandingBalance: number
}

declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

// Update the loadJsPDF function at the top
const loadJsPDF = async () => {
  if (typeof window === "undefined") {
    throw new Error("PDF generation is only available in browser environment")
  }

  try {
    const jsPDFModule = await import("jspdf")
    await import("jspdf-autotable")

    const jsPDF = jsPDFModule.default || jsPDFModule
    return jsPDF
  } catch (error) {
    console.error("Failed to load jsPDF:", error)

    // Fallback for global jsPDF
    if (typeof window !== "undefined" && (window as any).jspdf) {
      return (window as any).jspdf.jsPDF
    }

    throw new Error("PDF library failed to load. Please refresh the page and try again.")
  }
}

// Enhanced Electron detection and PDF saving
const isElectron = () => {
  return typeof window !== "undefined" && window.electronAPI && window.electronAPI.isElectron
}

const savePDF = async (doc: any, fileName: string, reportType = "Outstanding Students Report") => {
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
      console.error(`${reportType} export failed: ${errorMessage}`)
    }
  }
}

// Enhanced table drawing with better formatting and styling
const drawTable = (
  doc: any,
  startY: number,
  headers: string[],
  data: string[][],
  columnWidths: number[],
  options: {
    headerColor?: [number, number, number]
    alternateRowColor?: [number, number, number]
    fontSize?: number
    cellPadding?: number
    maxRowsPerPage?: number
  } = {},
) => {
  let yPos = startY
  const cellHeight = 8
  const startX = 20
  const {
    headerColor = [107, 70, 193],
    alternateRowColor = [248, 248, 248],
    fontSize = 9,
    cellPadding = 2,
    maxRowsPerPage = 30,
  } = options

  // Draw headers
  doc.setFontSize(fontSize)
  doc.setFont(undefined, "bold")
  doc.setFillColor(...headerColor)
  doc.setTextColor(255, 255, 255)

  let xPos = startX
  headers.forEach((header: string, index: number) => {
    doc.rect(xPos, yPos, columnWidths[index], cellHeight, "F")
    doc.text(header, xPos + cellPadding, yPos + 5)
    xPos += columnWidths[index]
  })

  yPos += cellHeight

  // Draw data rows
  doc.setFont(undefined, "normal")
  doc.setTextColor(0, 0, 0)

  data.forEach((row, rowIndex) => {
    // Add new page if needed
    if (rowIndex > 0 && rowIndex % maxRowsPerPage === 0) {
      doc.addPage()
      yPos = 20

      // Redraw headers on new page
      doc.setFont(undefined, "bold")
      doc.setFillColor(...headerColor)
      doc.setTextColor(255, 255, 255)

      xPos = startX
      headers.forEach((header: string, index: number) => {
        doc.rect(xPos, yPos, columnWidths[index], cellHeight, "F")
        doc.text(header, xPos + cellPadding, yPos + 5)
        xPos += columnWidths[index]
      })

      yPos += cellHeight
      doc.setFont(undefined, "normal")
      doc.setTextColor(0, 0, 0)
    }

    // Alternate row colors
    if (rowIndex % 2 === 0) {
      doc.setFillColor(...alternateRowColor)
      doc.rect(
        startX,
        yPos,
        columnWidths.reduce((a, b) => a + b, 0),
        cellHeight,
        "F",
      )
    }

    xPos = startX
    row.forEach((cell, cellIndex) => {
      // Truncate long text based on column width
      let text = cell
      const maxLength = Math.floor(columnWidths[cellIndex] / 3)
      if (text.length > maxLength) {
        text = text.substring(0, maxLength - 3) + "..."
      }

      // Color code specific columns
      if (headers[cellIndex]?.toLowerCase().includes("status")) {
        if (text.includes("Overdue") || text.includes("Critical")) {
          doc.setTextColor(220, 20, 60) // Crimson
        } else if (text.includes("Behind")) {
          doc.setTextColor(255, 140, 0) // Orange
        } else if (text.includes("Partial")) {
          doc.setTextColor(255, 165, 0) // Orange
        } else {
          doc.setTextColor(0, 0, 0) // Black
        }
      } else if (headers[cellIndex]?.toLowerCase().includes("outstanding")) {
        const amount = Number.parseFloat(text.replace(/[^0-9.-]+/g, ""))
        if (amount > 1000) {
          doc.setTextColor(220, 20, 60) // Crimson for high amounts
        } else if (amount > 500) {
          doc.setTextColor(255, 140, 0) // Orange for medium amounts
        } else {
          doc.setTextColor(0, 0, 0) // Black for low amounts
        }
      } else {
        doc.setTextColor(0, 0, 0) // Black for other columns
      }

      doc.text(text, xPos + cellPadding, yPos + 5)
      xPos += columnWidths[cellIndex]
    })
    yPos += cellHeight
  })

  return yPos
}

// Get outstanding payment details for a student
const getOutstandingDetails = (student: Student, settings: AppSettings) => {
  if (!Array.isArray(student.feePayments)) {
    return {
      outstandingPeriods: [],
      totalOutstanding: 0,
      oldestOutstanding: null,
      outstandingCount: 0,
    }
  }

  const outstandingPayments = student.feePayments.filter((payment) => payment.outstandingAmount > 0.01)

  const outstandingPeriods = outstandingPayments.map((payment) => {
    if (settings.billingCycle === BillingCycle.MONTHLY) {
      return getMonthName(payment.period)
    } else {
      const term = TERMS.find((t) => t.period === payment.period)
      return term
        ? `Term ${payment.period} (${term.months.map((m) => getMonthName(m)).join(", ")})`
        : `Term ${payment.period}`
    }
  })

  const totalOutstanding = outstandingPayments.reduce((sum, payment) => sum + payment.outstandingAmount, 0)

  // Find oldest outstanding payment
  const oldestOutstanding = outstandingPayments.reduce(
    (oldest, current) => {
      const currentDate = new Date(current.dueDate)
      const oldestDate = oldest ? new Date(oldest.dueDate) : new Date()
      return currentDate < oldestDate ? current : oldest
    },
    null as FeePayment | null,
  )

  return {
    outstandingPeriods,
    totalOutstanding,
    oldestOutstanding,
    outstandingCount: outstandingPayments.length,
  }
}

// Get payment status category for sorting and analysis
const getPaymentStatusCategory = (
  student: Student,
  settings: AppSettings,
): {
  category: string
  priority: number
  description: string
} => {
  const { totalPaid, annualFeeCalculated } = calculateStudentTotals(student, settings.billingCycle)
  const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
  const paymentRate = annualFeeCalculated > 0 ? (totalPaid / annualFeeCalculated) * 100 : 0

  if (outstanding <= 0.01) {
    return { category: "Fully Paid", priority: 5, description: "No outstanding balance" }
  } else if (paymentRate >= 90) {
    return { category: "Nearly Complete", priority: 4, description: "Minor outstanding balance" }
  } else if (paymentRate >= 75) {
    return { category: "Good Standing", priority: 3, description: "Manageable outstanding balance" }
  } else if (paymentRate >= 50) {
    return { category: "Partial Payment", priority: 2, description: "Significant outstanding balance" }
  } else if (paymentRate >= 25) {
    return { category: "Behind Schedule", priority: 1, description: "Major outstanding balance" }
  } else {
    return { category: "Critical", priority: 0, description: "Severe outstanding balance" }
  }
}

// Update the main export function to handle errors better:

export async function exportOutstandingStudentsPDF(
  students: Student[],
  settings: AppSettings,
  calculateOutstanding: (student: Student) => number,
) {
  try {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF()
    const currentYear = getCurrentYear()

    // Filter students with outstanding balances
    const outstandingStudents = students.filter((student) => calculateOutstanding(student) > 0.01)

    if (outstandingStudents.length === 0) {
      if (isElectron() && window.electronAPI) {
        await window.electronAPI.showMessage({
          type: "info",
          title: "No Outstanding Payments",
          message: "No students with outstanding payments found.",
          detail: "All students are up to date with their payments!",
        })
      } else {
        alert("No students with outstanding payments found.")
      }
      return false
    }

    // Enhanced header with school branding
    doc.setFontSize(20)
    doc.setTextColor(107, 70, 193)
    doc.text(settings.schoolName || "My Students Track", 20, 25)

    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.text("Outstanding Payments Analysis Report", 20, 40)

    // Enhanced date and summary information
    doc.setFontSize(10)
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 20, 50)
    doc.text(`Academic Year: ${currentYear}`, 120, 50)
    doc.text(`Billing Cycle: ${settings.billingCycle}`, 20, 57)

    const totalOutstanding = outstandingStudents.reduce((total, student) => total + calculateOutstanding(student), 0)

    doc.text(`Total Students: ${students.length} | Outstanding: ${outstandingStudents.length}`, 20, 64)
    doc.text(`Total Outstanding Amount: ${formatCurrency(totalOutstanding)}`, 20, 71)

    let yPosition = 85

    // Summary section
    doc.setFontSize(14)
    doc.setTextColor(107, 70, 193)
    doc.text("OUTSTANDING PAYMENTS SUMMARY", 20, yPosition)
    yPosition += 15

    // Group by class and create table data matching new format
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

    const classGroups = new Map<string, Student[]>()
    outstandingStudents.forEach((student) => {
      // Use the actual class name from student.className instead of class group
      const className = student.className || "Unknown"
      
      if (!classGroups.has(className)) {
        classGroups.set(className, [])
      }
      classGroups.get(className)!.push(student)
    })

    // Sort classes by order
    const sortedClasses = Array.from(classGroups.keys()).sort((a, b) => {
      // First try to match the full class name (e.g., "Grade 1A")
      const baseA = a.split(' ')[0] + ' ' + a.split(' ')[1] || a
      const baseB = b.split(' ')[0] + ' ' + b.split(' ')[1] || b
      
      const indexA = classOrder.findIndex(cls => baseA.startsWith(cls))
      const indexB = classOrder.findIndex(cls => baseB.startsWith(cls))
      
      if (indexA === -1 && indexB === -1) return a.localeCompare(b)
      if (indexA === -1) return 1
      if (indexB === -1) return -1
      if (indexA !== indexB) return indexA - indexB
      
      // If same base class (e.g., both Grade 1), sort by the full class name
      return a.localeCompare(b)
    })

    // Use autoTable for better formatting with new headers
    const tableData: any[] = []

    sortedClasses.forEach((className) => {
      const classStudents = classGroups.get(className)!

      classStudents
        .sort((a, b) => calculateOutstanding(b) - calculateOutstanding(a))
        .forEach((student) => {
          const outstanding = calculateOutstanding(student)
          const totals = calculateStudentTotals(student, settings.billingCycle)

          // Get transport payment display
          const getTransportPaymentDisplay = () => {
            if (!student.hasTransport) return "" // Blank if transport not applicable
            // Use the actual class name from student.className for transport display

            const transportPayments = student.transportPayments || []
            const skippedMonths = transportPayments.filter((p) => p.isSkipped).length
            const totalPaid = transportPayments.reduce((sum, p) => sum + p.amountPaid, 0)

            let display = formatCurrency(totalPaid)
            if (skippedMonths > 0) {
              display += ` (${skippedMonths} Skipped)` // Skipped months indicated as "Skipped"
            }
            return display
          }

          tableData.push([
            student.fullName,
            className,
            formatCurrency(totals.totalPaid),
            getTransportPaymentDisplay(),
            formatCurrency(totals.annualFeeCalculated),
            formatCurrency(outstanding),
          ])
        })
    })

    // Use autoTable for better formatting
    doc.autoTable({
      startY: yPosition,
      head: [
        [
          "Student Name",
          "Class Name",
          `Fees Paid (${settings.billingCycle === BillingCycle.MONTHLY ? "Monthly" : "Termly"})`,
          "Transport Paid",
          "Total Expected (Per Student)",
          "Outstanding (Per Student)",
        ],
      ],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [107, 70, 193],
        textColor: [255, 255, 255],
        fontSize: 9,
      },
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      columnStyles: {
        2: { halign: "right" }, // Fees Paid
        3: { halign: "right" }, // Transport Paid
        4: { halign: "right" }, // Total Expected
        5: { halign: "right" }, // Outstanding
      },
    })

    // Add summary at the bottom
    const finalY = (doc as any).lastAutoTable?.finalY || yPosition + 100

    doc.setFontSize(12)
    doc.setTextColor(107, 70, 193)
    doc.text("SUMMARY", 20, finalY + 20)

    doc.setFontSize(10)
    doc.setTextColor(0, 0, 0)
    doc.text(`Total Outstanding: ${formatCurrency(totalOutstanding)}`, 25, finalY + 35)
    doc.text(`Average per Student: ${formatCurrency(totalOutstanding / outstandingStudents.length)}`, 25, finalY + 45)

    // Enhanced footer
    const pageCount = doc.getNumberOfPages()
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i)
      doc.setFontSize(8)
      doc.setTextColor(128, 128, 128)
      doc.text("Powered by My Students Track", 20, doc.internal.pageSize.height - 10)
      doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 40, doc.internal.pageSize.height - 10)
    }

    const fileName = `Outstanding_Students_Analysis_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "Outstanding Students Analysis Report")

    return true
  } catch (error) {
    console.error("Error generating outstanding students PDF:", error)

    if (isElectron() && window.electronAPI) {
      await window.electronAPI.showMessage({
        type: "error",
        title: "PDF Export Failed",
        message: "Failed to export outstanding students report",
        detail: error instanceof Error ? error.message : "Unknown error occurred",
      })
    } else {
      alert(`Failed to export outstanding students report: ${error instanceof Error ? error.message : "Unknown error"}`)
    }

    return false
  }
}

// Simplified version for basic outstanding reports
export async function exportOutstandingStudentsPDFSimple(
  students: Student[],
  settings: AppSettings,
  calculateOutstanding: (student: Student) => number,
) {
  try {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF()
    const currentYear = getCurrentYear()

    const outstandingStudents = students.filter((student) => calculateOutstanding(student) > 0.01)

    // Simple header
    doc.setFontSize(16)
    doc.text(settings.schoolName || "My School", 20, 20)
    doc.setFontSize(14)
    doc.text("Outstanding Payments Report", 20, 35)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 45)

    let yPosition = 60
    const totalOutstanding = outstandingStudents.reduce((total, student) => total + calculateOutstanding(student), 0)

    doc.text(`Total Students with Outstanding: ${outstandingStudents.length}`, 20, yPosition)
    yPosition += 10
    doc.text(`Total Outstanding Amount: ${formatCurrency(totalOutstanding)}`, 20, yPosition)
    yPosition += 20

    // Simple list
    outstandingStudents
      .sort((a, b) => calculateOutstanding(b) - calculateOutstanding(a))
      .forEach((student, index) => {
        const outstanding = calculateOutstanding(student)
        const { outstandingPeriods } = getOutstandingDetails(student, settings)

        doc.text(`${index + 1}. ${student.fullName} - ${formatCurrency(outstanding)}`, 20, yPosition)
        yPosition += 8

        if (outstandingPeriods.length > 0) {
          const periodsText = outstandingPeriods.slice(0, 3).join(", ")
          doc.text(`   Unpaid: ${periodsText}${outstandingPeriods.length > 3 ? "..." : ""}`, 25, yPosition)
          yPosition += 8
        }

        if (yPosition > 270) {
          doc.addPage()
          yPosition = 20
        }
      })

    const fileName = `Outstanding_Students_Simple_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "Simple Outstanding Students Report")

    return true
  } catch (error) {
    console.error("Error generating simple outstanding students PDF:", error)
    return false
  }
}

// Export outstanding students by class
export async function exportOutstandingStudentsByClassPDF(
  students: Student[],
  settings: AppSettings,
  calculateOutstanding: (student: Student) => number,
) {
  try {
    const jsPDF = await loadJsPDF()
    const doc = new jsPDF()

    const outstandingStudents = students.filter((student) => calculateOutstanding(student) > 0.01)

    // Group by class group (e.g., ECD, Grade, Form, College)
    const classesByGroup = new Map<string, Student[]>()
    outstandingStudents.forEach((student) => {
      const group = settings.classGroups.find((g) => g.id === student.classGroup)
      const groupName = group?.name || "Unknown Group"

      if (!classesByGroup.has(groupName)) {
        classesByGroup.set(groupName, [])
      }
      classesByGroup.get(groupName)!.push(student)
    })

    // Header
    doc.setFontSize(20)
    doc.setTextColor(107, 70, 193)
    doc.text(settings.schoolName || "My Students Track", 20, 25)

    doc.setFontSize(16)
    doc.setTextColor(0, 0, 0)
    doc.text("Outstanding Payments by Class", 20, 40)

    let yPosition = 60

    // Process each class
    Array.from(classesByGroup.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([className, classStudents]) => {
        const classTotal = classStudents.reduce((sum, student) => sum + calculateOutstanding(student), 0)

        // Class header
        doc.setFontSize(14)
        doc.setTextColor(107, 70, 193)
        doc.text(`${className} (${classStudents.length} students - ${formatCurrency(classTotal)})`, 20, yPosition)
        yPosition += 15

        // Class students
        doc.setFontSize(10)
        doc.setTextColor(0, 0, 0)

        classStudents
          .sort((a, b) => {
            const classCompare = a.className.localeCompare(b.className)
            if (classCompare !== 0) return classCompare
            return a.fullName.localeCompare(b.fullName)
          })
          .forEach((student, index) => {
            const outstanding = calculateOutstanding(student)
            doc.text(`  ${index + 1}. ${student.fullName} - ${formatCurrency(outstanding)}`, 25, yPosition)
            yPosition += 8

            if (yPosition > 270) {
              doc.addPage()
              yPosition = 20
            }
          })

        yPosition += 10
      })

    const fileName = `Outstanding_Students_By_Class_${new Date().toISOString().split("T")[0]}.pdf`
    await savePDF(doc, fileName, "Outstanding Students by Class Report")

    return true
  } catch (error) {
    console.error("Error generating outstanding students by class PDF:", error)
    return false
  }
}

export async function exportOutstandingPaymentsPDF(students: Student[], settings: AppSettings): Promise<void> {
  try {
    const studentsWithOutstanding = students.filter((student) => {
      const outstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)
      return outstanding > 0
    })

    if (studentsWithOutstanding.length === 0) {
      alert("No students with outstanding payments found.")
      return
    }

    const pdfContent = generateOutstandingPaymentsPDFContent(studentsWithOutstanding, settings)

    // Create and download PDF
    const blob = new Blob([pdfContent], { type: "text/html" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = `outstanding_payments_${new Date().toISOString().split("T")[0]}.html`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    console.log("Outstanding payments report exported successfully")
  } catch (error) {
    console.error("Error exporting outstanding payments report:", error)
    throw new Error("Failed to export outstanding payments report")
  }
}

function generateOutstandingPaymentsPDFContent(students: Student[], settings: AppSettings): string {
  const totalOutstanding = students.reduce((sum, student) => {
    return sum + calculateOutstandingFromEnrollment(student, settings.billingCycle)
  }, 0)

  return `
   <!DOCTYPE html>
   <html>
   <head>
     <title>Outstanding Payments Report</title>
     <style>
       body { font-family: Arial, sans-serif; margin: 20px; }
       .header { text-align: center; margin-bottom: 30px; }
       .summary { background-color: #f8f9fa; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
       table { width: 100%; border-collapse: collapse; margin-top: 10px; }
       th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
       th { background-color: #f2f2f2; }
       .amount { text-align: right; }
       .total-row { font-weight: bold; background-color: #e9ecef; }
     </style>
   </head>
   <body>
     <div class="header">
       <h1>${settings.schoolName}</h1>
       <h2>Outstanding Payments Report</h2>
       <p>Generated on: ${new Date().toLocaleDateString()}</p>
     </div>
     
     <div class="summary">
       <h3>Summary</h3>
       <p><strong>Total Students with Outstanding:</strong> ${students.length}</p>
       <p><strong>Total Outstanding Amount:</strong> $${totalOutstanding.toLocaleString()}</p>
       <p><strong>Average Outstanding per Student:</strong> $${(totalOutstanding / students.length).toFixed(2)}</p>
     </div>

     <table>
       <thead>
         <tr>
           <th>Student Name</th>
           <th>Student ID</th>
           <th>Class</th>
           <th>Parent Contact</th>
           <th class="amount">School Fees Outstanding</th>
           <th class="amount">Transport Outstanding</th>
           <th class="amount">Total Outstanding</th>
         </tr>
       </thead>
       <tbody>
         ${students
           .map((student) => {
             const totals = calculateStudentTotals(student, settings.billingCycle)
             const totalOutstanding = calculateOutstandingFromEnrollment(student, settings.billingCycle)

             return `
             <tr>
               <td>${student.fullName}</td>
               <td>${student.id}</td>
               <td>${student.className}</td>
               <td>${student.parentContact}</td>
               <td class="amount">$${totals.schoolFeesOutstanding.toFixed(2)}</td>
               <td class="amount">$${totals.transportOutstanding.toFixed(2)}</td>
               <td class="amount">$${totalOutstanding.toFixed(2)}</td>
             </tr>
           `
           })
           .join("")}
         <tr class="total-row">
           <td colspan="6"><strong>TOTAL</strong></td>
           <td class="amount"><strong>$${totalOutstanding.toFixed(2)}</strong></td>
         </tr>
       </tbody>
     </table>

     <div style="margin-top: 30px; font-size: 12px; color: #666;">
       <p><em>This report shows all students with outstanding payments as of ${new Date().toLocaleDateString()}.</em></p>
       <p><em>Outstanding amounts are calculated from admission date to current date.</em></p>
     </div>
   </body>
   </html>
 `
}
