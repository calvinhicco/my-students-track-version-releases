import { validateStudent, validateFeePayment, sanitizeString, sanitizeNumber } from "@/lib/dataValidation"

describe("Data Validation", () => {
  describe("validateStudent", () => {
    it("should validate correct student data", () => {
      const validStudent = {
        id: "STU001",
        name: "John Doe",
        class: "10th",
        rollNumber: "001",
        dateOfBirth: "2005-01-01",
        gender: "Male",
        address: "123 Main Street, City",
        phoneNumber: "+1234567890",
        email: "john@example.com",
        parentName: "Jane Doe",
        parentPhone: "+1234567891",
        admissionDate: "2020-04-01",
        feeAmount: 5000,
        transportFee: 1000,
        status: "Active",
      }

      const result = validateStudent(validStudent)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(validStudent)
    })

    it("should reject invalid student data", () => {
      const invalidStudent = {
        id: "",
        name: "A", // Too short
        class: "",
        rollNumber: "",
        dateOfBirth: "invalid-date",
        gender: "Invalid",
        address: "123", // Too short
        phoneNumber: "invalid",
        email: "invalid-email",
        parentName: "A", // Too short
        parentPhone: "invalid",
        admissionDate: "invalid-date",
        feeAmount: -100, // Negative
        transportFee: -50, // Negative
      }

      const result = validateStudent(invalidStudent)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    })
  })

  describe("validateFeePayment", () => {
    it("should validate correct payment data", () => {
      const validPayment = {
        studentId: "STU001",
        amount: 1000,
        paymentDate: "2024-01-01",
        paymentMethod: "Cash",
        receiptNumber: "RCP001",
        notes: "Monthly fee payment",
      }

      const result = validateFeePayment(validPayment)
      expect(result.success).toBe(true)
      expect(result.data).toEqual(validPayment)
    })

    it("should reject invalid payment data", () => {
      const invalidPayment = {
        studentId: "",
        amount: 0, // Must be greater than 0
        paymentDate: "invalid-date",
        paymentMethod: "Invalid",
        receiptNumber: "",
      }

      const result = validateFeePayment(invalidPayment)
      expect(result.success).toBe(false)
      expect(result.errors).toBeDefined()
    })
  })

  describe("sanitizeString", () => {
    it("should remove dangerous characters", () => {
      const input = '<script>alert("xss")</script>Hello World'
      const result = sanitizeString(input)
      expect(result).toBe('scriptalert("xss")/scriptHello World')
    })

    it("should trim whitespace", () => {
      const input = "  Hello World  "
      const result = sanitizeString(input)
      expect(result).toBe("Hello World")
    })
  })

  describe("sanitizeNumber", () => {
    it("should convert valid numbers", () => {
      expect(sanitizeNumber("123")).toBe(123)
      expect(sanitizeNumber("123.45")).toBe(123.45)
      expect(sanitizeNumber(456)).toBe(456)
    })

    it("should return 0 for invalid numbers", () => {
      expect(sanitizeNumber("invalid")).toBe(0)
      expect(sanitizeNumber("")).toBe(0)
      expect(sanitizeNumber(null)).toBe(0)
      expect(sanitizeNumber(undefined)).toBe(0)
    })
  })
})
