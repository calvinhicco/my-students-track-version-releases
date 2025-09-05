import { z } from "zod"

// Student validation schema
export const studentSchema = z.object({
  id: z.string().min(1, "Student ID is required"),
  name: z.string().min(2, "Name must be at least 2 characters").max(100, "Name too long"),
  class: z.string().min(1, "Class is required"),
  section: z.string().optional(),
  rollNumber: z.string().min(1, "Roll number is required"),
  dateOfBirth: z.string().refine((date) => {
    const parsed = new Date(date)
    return !isNaN(parsed.getTime()) && parsed < new Date()
  }, "Invalid date of birth"),
  gender: z.enum(["Male", "Female", "Other"]),
  address: z.string().min(5, "Address must be at least 5 characters").max(500, "Address too long"),
  phoneNumber: z.string().regex(/^\+?[\d\s\-$$$$]{10,15}$/, "Invalid phone number"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  parentName: z.string().min(2, "Parent name must be at least 2 characters").max(100, "Parent name too long"),
  parentPhone: z.string().regex(/^\+?[\d\s\-$$$$]{10,15}$/, "Invalid parent phone number"),
  admissionDate: z.string().refine((date) => {
    const parsed = new Date(date)
    return !isNaN(parsed.getTime())
  }, "Invalid admission date"),
  feeAmount: z.number().min(0, "Fee amount cannot be negative").max(1000000, "Fee amount too high"),
  transportFee: z.number().min(0, "Transport fee cannot be negative").max(100000, "Transport fee too high").optional(),
  status: z.enum(["Active", "Inactive", "Transferred", "Graduated"]).default("Active"),
})

// Fee payment validation schema
export const feePaymentSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0").max(1000000, "Amount too high"),
  paymentDate: z.string().refine((date) => {
    const parsed = new Date(date)
    return !isNaN(parsed.getTime()) && parsed <= new Date()
  }, "Invalid payment date"),
  paymentMethod: z.enum(["Cash", "Bank Transfer", "Cheque", "Online", "Card"]),
  receiptNumber: z.string().min(1, "Receipt number is required").max(50, "Receipt number too long"),
  notes: z.string().max(500, "Notes too long").optional(),
})

// Settings validation schema
export const settingsSchema = z.object({
  schoolName: z.string().min(2, "School name must be at least 2 characters").max(200, "School name too long"),
  address: z.string().min(5, "Address must be at least 5 characters").max(500, "Address too long"),
  phone: z.string().regex(/^\+?[\d\s\-$$$$]{10,15}$/, "Invalid phone number"),
  email: z.string().email("Invalid email"),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  principalName: z.string().min(2, "Principal name must be at least 2 characters").max(100, "Principal name too long"),
  academicYear: z.string().regex(/^\d{4}-\d{4}$/, "Academic year must be in format YYYY-YYYY"),
  currency: z.string().min(1, "Currency is required").max(10, "Currency code too long"),
  timezone: z.string().min(1, "Timezone is required"),
})

// Data sanitization functions
export function sanitizeString(input: string): string {
  return input.trim().replace(/[<>]/g, "")
}

export function sanitizeNumber(input: any): number {
  const num = Number.parseFloat(input)
  return isNaN(num) ? 0 : num
}

export function sanitizeDate(input: string): string {
  const date = new Date(input)
  return isNaN(date.getTime()) ? new Date().toISOString().split("T")[0] : input
}

// Validation helper functions
export function validateStudent(data: any): { success: boolean; data?: any; errors?: string[] } {
  try {
    const validatedData = studentSchema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      }
    }
    return { success: false, errors: ["Validation failed"] }
  }
}

export function validateFeePayment(data: any): { success: boolean; data?: any; errors?: string[] } {
  try {
    const validatedData = feePaymentSchema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      }
    }
    return { success: false, errors: ["Validation failed"] }
  }
}

export function validateSettings(data: any): { success: boolean; data?: any; errors?: string[] } {
  try {
    const validatedData = settingsSchema.parse(data)
    return { success: true, data: validatedData }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map((e) => `${e.path.join(".")}: ${e.message}`),
      }
    }
    return { success: false, errors: ["Validation failed"] }
  }
}

// Bulk validation for multiple records
export function validateStudentsBulk(students: any[]): {
  valid: any[]
  invalid: { index: number; data: any; errors: string[] }[]
} {
  const valid: any[] = []
  const invalid: { index: number; data: any; errors: string[] }[] = []

  students.forEach((student, index) => {
    const result = validateStudent(student)
    if (result.success && result.data) {
      valid.push(result.data)
    } else {
      invalid.push({
        index,
        data: student,
        errors: result.errors || ["Unknown validation error"],
      })
    }
  })

  return { valid, invalid }
}
