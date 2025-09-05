/**
 * Central date / money utilities for the School Management System
 *
 * 1. Core date helpers               – getCurrentYear(), getStartOfMonth() …
 * 2. Academic-year helpers           – getAcademicYear(), isInCurrentAcademicYear() …
 * 3. Billing-cycle helpers           – getCurrentBillingPeriod(), getBillingPeriodName() …
 * 4. Generic range / diff utilities  – getDaysBetween(), getMonthsBetweenDates() …
 * 5. Currency formatting             – formatCurrency()
 * 6. Transport-service helpers       – getTransportDueDate(), isTransportMonth() …
 *
 *  NOTE:  All functions are pure and **must stay tree-shakable**.
 */

import type { BillingCycleType } from "../types/index"
import { TERMS, BillingCycle } from "../types/index"

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

const SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

// Term boundaries (app specific: 4-, 8-, 12-month ends)
const TERM_END_MONTHS = [4, 8, 12] // April, August, December
const TERM_START_MONTHS = [0, 4, 8] // 0-indexed months

// Transport months (school buses run Jan-Mar, May-Jul, Sep-Nov)
const TRANSPORT_ACTIVE_MONTHS = [1, 2, 3, 5, 6, 7, 9, 10, 11]

/* -------------------------------------------------------------------------- */
/*  Basic date helpers                                                        */
/* -------------------------------------------------------------------------- */
export const getCurrentDate = (): string => new Date().toLocaleDateString()

export const getCurrentMonth = (): number => new Date().getMonth() + 1

export const getCurrentYear = (): number => new Date().getFullYear()

export const getCurrentDateTime = (): string => new Date().toISOString()

export const getStartOfMonth = (year: number, month: number): Date => new Date(year, month - 1, 1)

export const getEndOfMonth = (year: number, month: number): Date => new Date(year, month, 0)

export const getStartOfTerm = (year: number, termPeriod: number): Date => {
  const startMonth = TERM_START_MONTHS[termPeriod - 1] ?? 0
  return new Date(year, startMonth, 1)
}

export const getEndOfTerm = (year: number, termPeriod: number): Date => {
  const term = TERMS.find((t) => t.period === termPeriod)
  if (!term) return new Date(year, 11, 31)
  return getEndOfMonth(year, term.months.at(-1)!)
}

export const getMonthName = (month: number): string => MONTH_NAMES[month - 1] ?? `Month ${month}`

export const getShortMonthName = (month: number): string => SHORT_MONTH_NAMES[month - 1] ?? "Unknown"

/* -------------------------------------------------------------------------- */
/*  Validation & formatting                                                   */
/* -------------------------------------------------------------------------- */
export const formatDate = (date: Date | string): string =>
  (typeof date === "string" ? new Date(date) : date).toLocaleDateString()

export const formatShortDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })

export const formatReportDate = (dateString: string): string =>
  new Date(dateString).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

export const formatCurrency = (amount: number): string =>
  amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export const isValidDate = (dateString: string): boolean => !isNaN(new Date(dateString).getTime())

/* -------------------------------------------------------------------------- */
/*  Generic range / difference helpers                                        */
/* -------------------------------------------------------------------------- */
export const addMonths = (date: Date, months: number): Date => {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export const getDaysBetween = (startDate: Date, endDate: Date): number =>
  Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24))

export const getDaysBetweenDates = (startDate: string, endDate: string): number =>
  getDaysBetween(new Date(startDate), new Date(endDate))

export const getMonthsBetweenDates = (startDate: string, endDate: string): number => {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return Math.max(0, (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth()))
}

export const isDateInRange = (date: Date, startDate: Date, endDate: Date): boolean =>
  date >= startDate && date <= endDate

/* -------------------------------------------------------------------------- */
/*  Academic-year helpers                                                     */
/* -------------------------------------------------------------------------- */
export const getAcademicYear = (): string => {
  const year = getCurrentYear()
  // Academic year starts Jan for this app
  return year.toString()
}

export const isJanuary1st = (): boolean => {
  const today = new Date()
  return today.getMonth() === 0 && today.getDate() === 1
}

export const isEndOfTerm = (): boolean => {
  const month = getCurrentMonth()
  const currentDate = new Date().getDate()
  if (!TERM_END_MONTHS.includes(month)) return false
  return currentDate === getEndOfMonth(getCurrentYear(), month).getDate()
}

export const isInCurrentAcademicYear = (dateString: string): boolean =>
  new Date(dateString).getFullYear().toString() === getAcademicYear()

/* -------------------------------------------------------------------------- */
/*  Billing-cycle helpers                                                     */
/* -------------------------------------------------------------------------- */
export const getCurrentBillingPeriod = (billingCycle: BillingCycleType): number => {
  const month = getCurrentMonth()
  if (billingCycle === BillingCycle.MONTHLY) return month
  return TERMS.find((t) => t.months.includes(month))?.period ?? 1
}

export const getBillingPeriodName = (period: number, billingCycle: BillingCycleType): string => {
  if (billingCycle === BillingCycle.MONTHLY) return getMonthName(period)
  return TERMS.find((t) => t.period === period)?.name ?? `Term ${period}`
}

export const getBillingPeriodsBetweenDates = (
  startDate: string,
  endDate: string,
  billingCycle: BillingCycleType,
): number => {
  if (billingCycle === BillingCycle.MONTHLY) return getMonthsBetweenDates(startDate, endDate)
  // ~4 months per term
  return Math.ceil(getMonthsBetweenDates(startDate, endDate) / 4)
}

export const getNextBillingDueDate = (billingCycle: BillingCycleType, dueDay = 1): string => {
  const year = getCurrentYear()
  const month = getCurrentMonth()

  if (billingCycle === BillingCycle.MONTHLY) {
    const nextMonth = month === 12 ? 1 : month + 1
    const nextYear = month === 12 ? year + 1 : year
    return new Date(nextYear, nextMonth - 1, dueDay).toISOString().split("T")[0]
  }

  // Termly
  const currentTerm = TERMS.find((t) => t.months.includes(month))
  const nextTermPeriod = currentTerm?.period === 3 ? 1 : (currentTerm?.period ?? 1) + 1
  const nextTerm = TERMS.find((t) => t.period === nextTermPeriod)!
  const nextTermYear = nextTermPeriod === 1 ? year + 1 : year
  return new Date(nextTermYear, nextTerm.months[0] - 1, dueDay).toISOString().split("T")[0]
}

/* -------------------------------------------------------------------------- */
/*  Age helper                                                                 */
/* -------------------------------------------------------------------------- */
export const getAgeFromBirthDate = (birthDate: string): number => {
  const birth = new Date(birthDate)
  const today = new Date()
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return Math.max(0, age)
}

/* -------------------------------------------------------------------------- */
/*  Transport-specific helpers                                                */
/* -------------------------------------------------------------------------- */
export const getTransportDueDate = (year: number, month: number, dueDay = 7): string =>
  new Date(year, month - 1, dueDay).toISOString().split("T")[0]

export const isTransportMonth = (month: number): boolean => TRANSPORT_ACTIVE_MONTHS.includes(month)

/**
 * Returns the list of transport-billing months for the remainder of the
 * academic year, starting from the activation month.
 */
export const getTransportMonthsFromActivation = (activationMonth: number, year: number): number[] =>
  TRANSPORT_ACTIVE_MONTHS.filter((m) => m >= activationMonth)

/**
 * Tight date-string validator used when parsing user input.
 * Accepts YYYY-MM-DD format only.
 */
export const validateDateString = (dateString: string): boolean =>
  typeof dateString === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateString) && !isNaN(new Date(dateString).getTime())

/* -------------------------------------------------------------------------- */
/*  Misc                                                                      */
/* -------------------------------------------------------------------------- */
export const getCurrentTimestamp = (): string => new Date().toISOString()

export const isCurrentDatePastDay = (day: number): boolean => new Date().getDate() >= day
