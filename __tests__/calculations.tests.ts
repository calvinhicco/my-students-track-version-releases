import { calculateOutstandingAmount, calculateTotalFees, calculateMonthlyFee } from "@/lib/calculations"

describe("Calculations", () => {
  describe("calculateOutstandingAmount", () => {
    it("should calculate outstanding amount correctly", () => {
      const student = {
        id: "1",
        name: "Test Student",
        feeAmount: 1000,
        transportFee: 200,
        payments: [
          { amount: 500, date: "2024-01-01" },
          { amount: 300, date: "2024-02-01" },
        ],
      }

      const outstanding = calculateOutstandingAmount(student)
      expect(outstanding).toBe(400) // 1200 - 800 = 400
    })

    it("should handle students with no payments", () => {
      const student = {
        id: "1",
        name: "Test Student",
        feeAmount: 1000,
        transportFee: 200,
        payments: [],
      }

      const outstanding = calculateOutstandingAmount(student)
      expect(outstanding).toBe(1200)
    })

    it("should handle students with no transport fee", () => {
      const student = {
        id: "1",
        name: "Test Student",
        feeAmount: 1000,
        payments: [{ amount: 500, date: "2024-01-01" }],
      }

      const outstanding = calculateOutstandingAmount(student)
      expect(outstanding).toBe(500)
    })
  })

  describe("calculateTotalFees", () => {
    it("should calculate total fees correctly", () => {
      const students = [
        { feeAmount: 1000, transportFee: 200 },
        { feeAmount: 1500, transportFee: 300 },
        { feeAmount: 800 },
      ]

      const total = calculateTotalFees(students)
      expect(total).toBe(3800) // 1200 + 1800 + 800
    })

    it("should handle empty array", () => {
      const total = calculateTotalFees([])
      expect(total).toBe(0)
    })
  })

  describe("calculateMonthlyFee", () => {
    it("should calculate monthly fee correctly", () => {
      const annualFee = 12000
      const monthly = calculateMonthlyFee(annualFee)
      expect(monthly).toBe(1000)
    })

    it("should handle zero fee", () => {
      const monthly = calculateMonthlyFee(0)
      expect(monthly).toBe(0)
    })
  })
})
