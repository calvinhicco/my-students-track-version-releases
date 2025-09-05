import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import type { Student, ClassGroup } from "../types/index"

/**
 * Enhanced utility functions for My School Track
 */

// Tailwind CSS class merging utility
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * String utilities
 */
export const StringUtils = {
  /**
   * Capitalize first letter of each word
   */
  titleCase: (str: string): string => {
    return str.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase())
  },

  /**
   * Generate initials from full name
   */
  getInitials: (fullName: string): string => {
    return fullName
      .split(" ")
      .map((name) => name.charAt(0).toUpperCase())
      .join("")
      .substring(0, 3)
  },

  /**
   * Clean and format phone number
   */
  formatPhoneNumber: (phone: string): string => {
    const cleaned = phone.replace(/\D/g, "")
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  },

  /**
   * Generate slug from string
   */
  slugify: (str: string): string => {
    return str
      .toLowerCase()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "")
  },

  /**
   * Truncate string with ellipsis
   */
  truncate: (str: string, length: number): string => {
    if (str.length <= length) return str
    return str.substring(0, length) + "..."
  },

  /**
   * Generate random ID
   */
  generateId: (prefix = "", length = 8): string => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    let result = prefix
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  },
}

/**
 * Number and currency utilities
 */
export const NumberUtils = {
  /**
   * Format currency with proper locale
   */
  formatCurrency: (amount: number, currency = "USD"): string => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  },

  /**
   * Format number with thousands separator
   */
  formatNumber: (num: number): string => {
    return new Intl.NumberFormat("en-US").format(num)
  },

  /**
   * Calculate percentage
   */
  calculatePercentage: (value: number, total: number): number => {
    if (total === 0) return 0
    return Math.round((value / total) * 100 * 100) / 100 // Round to 2 decimal places
  },

  /**
   * Round to specified decimal places
   */
  roundTo: (num: number, decimals = 2): number => {
    return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals)
  },

  /**
   * Check if number is within range
   */
  isInRange: (num: number, min: number, max: number): boolean => {
    return num >= min && num <= max
  },

  /**
   * Generate random number in range
   */
  randomInRange: (min: number, max: number): number => {
    return Math.floor(Math.random() * (max - min + 1)) + min
  },
}

/**
 * Date utilities
 */
export const DateUtils = {
  /**
   * Format date for display
   */
  formatDate: (date: Date | string, format = "short"): string => {
    const d = typeof date === "string" ? new Date(date) : date

    switch (format) {
      case "short":
        return d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      case "long":
        return d.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      case "iso":
        return d.toISOString().split("T")[0]
      default:
        return d.toLocaleDateString()
    }
  },

  /**
   * Get relative time (e.g., "2 days ago")
   */
  getRelativeTime: (date: Date | string): string => {
    const d = typeof date === "string" ? new Date(date) : date
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000)

    if (diffInSeconds < 60) return "just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)} days ago`
    if (diffInSeconds < 31536000) return `${Math.floor(diffInSeconds / 2592000)} months ago`
    return `${Math.floor(diffInSeconds / 31536000)} years ago`
  },

  /**
   * Check if date is in current academic year
   */
  isInCurrentAcademicYear: (date: Date | string): boolean => {
    const d = typeof date === "string" ? new Date(date) : date
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()

    // Academic year typically starts in August/September
    const academicYearStart = currentMonth >= 7 ? currentYear : currentYear - 1
    const academicYearEnd = academicYearStart + 1

    return d.getFullYear() >= academicYearStart && d.getFullYear() <= academicYearEnd
  },

  /**
   * Get age from date of birth
   */
  calculateAge: (dateOfBirth: Date | string): number => {
    const dob = typeof dateOfBirth === "string" ? new Date(dateOfBirth) : dateOfBirth
    const today = new Date()
    let age = today.getFullYear() - dob.getFullYear()
    const monthDiff = today.getMonth() - dob.getMonth()

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--
    }

    return age
  },
}

/**
 * Array utilities
 */
export const ArrayUtils = {
/**
 * Group array by key
 */ 
  groupBy: <T>(array: T[], key: keyof T): Record<string, T[]> =>
{
  return array.reduce((groups, item) => {
      const groupKey = String(item[key])
      if (!groups[groupKey]) {
        groups[groupKey] = []
      }
      groups[groupKey].push(item)
      return groups
    }, {} as Record<string, T[]>)
}
,

  /**
   * Sort array by multiple keys
   */
  sortBy: <T>(array: T[], ...keys: (keyof T)[]): T[] =>
{
  return [...array].sort((a, b) => {
      for (const key of keys) {
        const aVal = a[key]
        const bVal = b[key]
        if (aVal < bVal) return -1
        if (aVal > bVal) return 1
      }
      return 0
    })
}
,

  /**
   * Remove duplicates from array
   */
  unique: <T>(array: T[], key?: keyof T): T[] =>
{
  if (!key) {
    return [...new Set(array)]
  }

  const seen = new Set()
  return array.filter(item => {
      const value = item[key]
      if (seen.has(value)) {
        return false
      }
      seen.add(value)
      return true
    })
}
,

  /**
   * Chunk array into smaller arrays
   */
  chunk: <T>(array: T[], size: number): T[][] =>
{
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
,

  /**
   * Get random item from array
   */
  randomItem: <T>(array: T[]): T | undefined =>
{
  if (array.length === 0) return undefined
  return array[Math.floor(Math.random() * array.length)]
}
,

  /**
   * Flatten nested arrays
   */
  flatten: <T>(array: (T | T[])[]): T[] =>
{
  return array.reduce((flat, item) => {
      return flat.concat(Array.isArray(item) ? ArrayUtils.flatten(item) : item)
    }, [] as T[])
}
,

  /**
   * Find differences between two arrays
   */
  difference: <T>(array1: T[], array2: T[]): T[] =>
{
  return array1.filter(item => !array2.includes(item));
}
,

  /**
   * Find intersection of two arrays
   */
  intersection: <T>(array1: T[], array2: T[]): T[] =>
{
  return array1.filter(item => array2.includes(item));
}
,
}

/**
 * School-specific utilities
 */
export const SchoolUtils = {
  /**
   * Generate student ID
   */
  generateStudentId: (year?: number): string => {
    const currentYear = year || new Date().getFullYear()
    const yearSuffix = currentYear.toString().slice(-2)
    const randomNum = Math.floor(Math.random() * 9000) + 1000
    return `STU${yearSuffix}${randomNum}`
  },

  /**
   * Validate student data
   */
  validateStudent: (student: Partial<Student>): { valid: boolean; errors: string[] } => {
    const errors: string[] = []

    if (!student.fullName?.trim()) {
      errors.push("Full name is required")
    }

    if (!student.dateOfBirth) {
      errors.push("Date of birth is required")
    } else {
      const age = DateUtils.calculateAge(student.dateOfBirth)
      if (age < 2 || age > 25) {
        errors.push("Age must be between 2 and 25 years")
      }
    }

    if (!student.parentContact?.trim()) {
      errors.push("Parent contact is required")
    }

    if (!student.address?.trim()) {
      errors.push("Address is required")
    }

    if (!student.admissionDate) {
      errors.push("Admission date is required")
    } else if (new Date(student.admissionDate) > new Date()) {
      errors.push("Admission date cannot be in the future")
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  },

  /**
   * Calculate class statistics
   */
  getClassStats: (
    students: Student[],
    className: string,
  ): {
    totalStudents: number
    totalPaid: number
    totalOwed: number
    averagePayment: number
    paymentCompletion: number
  } => {
    const classStudents = students.filter((s) => s.className === className && !s.isTransferred)

    if (classStudents.length === 0) {
      return {
        totalStudents: 0,
        totalPaid: 0,
        totalOwed: 0,
        averagePayment: 0,
        paymentCompletion: 0,
      }
    }

    const totalPaid = classStudents.reduce((sum, s) => sum + (s.totalPaid || 0), 0)
    const totalOwed = classStudents.reduce((sum, s) => sum + (s.totalOwed || 0), 0)
    const totalExpected = classStudents.reduce((sum, s) => sum + (s.annualFee || 0), 0)

    return {
      totalStudents: classStudents.length,
      totalPaid,
      totalOwed,
      averagePayment: totalPaid / classStudents.length,
      paymentCompletion: totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0,
    }
  },

  /**
   * Get payment status color
   */
  getPaymentStatusColor: (student: Student): string => {
    const paymentPercentage = student.annualFee > 0 ? ((student.totalPaid || 0) / student.annualFee) * 100 : 0

    if (paymentPercentage >= 100) return "text-green-600"
    if (paymentPercentage >= 75) return "text-blue-600"
    if (paymentPercentage >= 50) return "text-yellow-600"
    if (paymentPercentage >= 25) return "text-orange-600"
    return "text-red-600"
  },

  /**
   * Format class name consistently
   */
  formatClassName: (className: string): string => {
    return StringUtils.titleCase(className.trim())
  },

  /**
   * Get next class for promotion
   */
  getNextClass: (currentClass: string, classGroups: ClassGroup[]): string | null => {
    // Simple promotion logic - can be enhanced
    const gradeMatch = currentClass.match(/Grade (\d+)/)
    if (gradeMatch) {
      const currentGrade = Number.parseInt(gradeMatch[1])
      if (currentGrade < 7) {
        return `Grade ${currentGrade + 1}`
      }
    }

    const formMatch = currentClass.match(/Form (\d+)/)
    if (formMatch) {
      const currentForm = Number.parseInt(formMatch[1])
      if (currentForm < 6) {
        return `Form ${currentForm + 1}`
      }
    }

    return null
  },

  /**
   * Calculate academic progress
   */
  calculateAcademicProgress: (
    student: Student,
  ): {
    yearsInSchool: number
    expectedGraduationYear: number
    progressPercentage: number
  } => {
    const admissionYear = new Date(student.admissionDate).getFullYear()
    const currentYear = new Date().getFullYear()
    const yearsInSchool = currentYear - admissionYear

    // Estimate graduation based on class level
    let expectedDuration = 12 // Default 12 years
    if (student.className.includes("ECD")) expectedDuration = 2
    else if (student.className.includes("Grade")) expectedDuration = 7
    else if (student.className.includes("Form")) expectedDuration = 6
    else if (student.className.includes("College")) expectedDuration = 3

    const expectedGraduationYear = admissionYear + expectedDuration
    const progressPercentage = Math.min((yearsInSchool / expectedDuration) * 100, 100)

    return {
      yearsInSchool,
      expectedGraduationYear,
      progressPercentage: Math.round(progressPercentage),
    }
  },
}

/**
 * Validation utilities
 */
export const ValidationUtils = {
  /**
   * Validate email format
   */
  isValidEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  },

  /**
   * Validate phone number
   */
  isValidPhone: (phone: string): boolean => {
    const phoneRegex = /^[+]?[1-9][\d]{0,15}$/
    return phoneRegex.test(phone.replace(/\D/g, ""))
  },

  /**
   * Validate required fields
   */
  validateRequired: (value: any, fieldName: string): string | null => {
    if (value === null || value === undefined || value === "") {
      return `${fieldName} is required`
    }
    return null
  },

  /**
   * Validate number range
   */
  validateRange: (value: number, min: number, max: number, fieldName: string): string | null => {
    if (value < min || value > max) {
      return `${fieldName} must be between ${min} and ${max}`
    }
    return null
  },

  /**
   * Validate date
   */
  validateDate: (date: string | Date, fieldName: string): string | null => {
    const d = typeof date === "string" ? new Date(date) : date
    if (isNaN(d.getTime())) {
      return `${fieldName} must be a valid date`
    }
    return null
  },

  /**
   * Validate student ID format
   */
  validateStudentId: (studentId: string): boolean => {
    const studentIdRegex = /^STU\d{6}$/
    return studentIdRegex.test(studentId)
  },

  /**
   * Validate currency amount
   */
  validateCurrency: (amount: number): boolean => {
    return !isNaN(amount) && amount >= 0 && Number.isFinite(amount)
  },
}

/**
 * Local storage utilities with error handling
 */
export const StorageUtils = {
  /**
   * Safe JSON parse
   */
  safeJsonParse: <T>(json: string, defaultValue: T): T => {
    try {
      return JSON.parse(json)
    } catch {
      return defaultValue
    }
  },

  /**
   * Safe JSON stringify
   */
  safeJsonStringify: (obj: any): string => {
    try {
      return JSON.stringify(obj)
    } catch {
      return '{}'
    }
  },

  /**
   * Get storage size
   */
  getStorageSize: (): number => {
    let total = 0
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += (localStorage[key]?.length || 0) + key.length
      }
    }
    return total
  },

  /**
   * Clear storage with confirmation
   */
  clearStorage: (keys?: string[]): boolean => {
    try {
      if (keys) {
        keys.forEach(key => localStorage.removeItem(key))
      } else {
        localStorage.clear()
      }
      return true
    } catch {
      return false
    }
  },

  /**
   * Get storage usage percentage
   */
  getStorageUsage: (): number => {
    try {
      const used = new Blob(Object.values(localStorage)).size
      const quota = 5 * 1024 * 1024 // 5MB typical limit
      return (used / quota) * 100
    } catch {
      return 0
    }
  },
}

/**
 * Performance utilities
 */
export const PerformanceUtils = {
  /**
   * Debounce function
   */
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void => {
    let timeout: NodeJS.Timeout | undefined;
    return (...args: Parameters<T>) => {
      clearTimeout(timeout)
      timeout = setTimeout(() => func(...args), wait)
    }
  },

  /**
   * Throttle function
   */
  throttle: <T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void => {
    let inThrottle: boolean
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args)
        inThrottle = true
        setTimeout(() => inThrottle = false, limit)
      }
    }
  },

  /**
   * Measure execution time
   */
  measureTime: async <T>(
    func: () => Promise<T> | T,
    label?: string
  ): Promise<{ result: T; time: number }> => {
    const start = performance.now()
    const result = await func()
    const time = performance.now() - start
    
    if (label) {
      console.log(`${label}: ${time.toFixed(2)}ms`)
    }
    
    return { result, time }
  },

  /**
   * Create memoized function
   */
  memoize: <T extends (...args: any[]) => any>(func: T): T => {
    const cache = new Map()
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args)
      if (cache.has(key)) {
        return cache.get(key)
      }
      const result = func(...args)
      cache.set(key, result)
      return result
    }) as T
  },

  /**
   * Batch process array
   */
  batchProcess: async <T, R>(
    items: T[],
    processor: (item: T) => Promise<R> | R,
    batchSize = 10,
    delay = 0
  ): Promise<R[]> => {
    const results: R[] = []
    const batches = ArrayUtils.chunk(items, batchSize)

    for (const batch of batches) {
      const batchResults = await Promise.all(batch.map(processor))
      results.push(...batchResults)
      
      if (delay > 0 && batch !== batches[batches.length - 1]) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }

    return results
  },
}

// Export all utilities as a single object for convenience
export const Utils = {
  String: StringUtils,
  Number: NumberUtils,
  Date: DateUtils,
  Array: ArrayUtils,
  School: SchoolUtils,
  Validation: ValidationUtils,
  Storage: StorageUtils,
  Performance: PerformanceUtils,
}

export default Utils
