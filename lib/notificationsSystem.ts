import type { Student, AppSettings, FeePayment } from "../types/index"
import { calculateOutstandingFromEnrollment } from "./calculations"
import { getCurrentMonth } from "./dateUtils"

export interface NotificationRule {
  id: string
  name: string
  type: "payment_reminder" | "overdue_notice" | "promotion_alert" | "transport_update" | "system_alert"
  enabled: boolean
  conditions: {
    daysBefore?: number
    daysAfter?: number
    amountThreshold?: number
    classFilter?: string[]
    customCondition?: (student: Student) => boolean
  }
  template: {
    subject: string
    message: string
    urgency: "low" | "medium" | "high" | "critical"
  }
  channels: ("email" | "sms" | "in_app" | "print")[]
  schedule?: {
    frequency: "once" | "daily" | "weekly" | "monthly"
    time?: string
    days?: number[]
  }
}

export interface Notification {
  id: string
  ruleId: string
  studentId: string
  studentName: string
  parentContact: string
  type: string
  subject: string
  message: string
  urgency: "low" | "medium" | "high" | "critical"
  channels: string[]
  status: "pending" | "sent" | "failed" | "cancelled"
  createdAt: string
  sentAt?: string
  error?: string
  metadata?: Record<string, any>
}

export interface NotificationStats {
  totalSent: number
  totalPending: number
  totalFailed: number
  byType: Record<string, number>
  byUrgency: Record<string, number>
  successRate: number
  lastProcessed: string
}

/**
 * Advanced Notification System for My School Track
 * Handles automated notifications for payments, alerts, and communications
 */
export class NotificationSystem {
  private settings: AppSettings
  private rules: NotificationRule[]
  private notifications: Notification[]
  private isProcessing = false

  constructor(settings: AppSettings) {
    this.settings = settings
    this.rules = this.loadDefaultRules()
    this.notifications = this.loadNotifications()
  }

  /**
   * Process all notification rules and generate notifications
   */
  async processNotifications(students: Student[]): Promise<{
    generated: number
    sent: number
    failed: number
    notifications: Notification[]
  }> {
    if (this.isProcessing) {
      throw new Error("Notification processing already in progress")
    }

    this.isProcessing = true
    const result = {
      generated: 0,
      sent: 0,
      failed: 0,
      notifications: [] as Notification[],
    }

    try {
      // Process each enabled rule
      for (const rule of this.rules.filter((r) => r.enabled)) {
        const ruleNotifications = await this.processRule(rule, students)
        result.notifications.push(...ruleNotifications)
        result.generated += ruleNotifications.length
      }

      // Send pending notifications
      const sendResults = await this.sendPendingNotifications()
      result.sent = sendResults.sent
      result.failed = sendResults.failed

      // Save notifications
      this.saveNotifications()

      return result
    } finally {
      this.isProcessing = false
    }
  }

  /**
   * Add or update notification rule
   */
  addRule(rule: NotificationRule): void {
    const existingIndex = this.rules.findIndex((r) => r.id === rule.id)
    if (existingIndex >= 0) {
      this.rules[existingIndex] = rule
    } else {
      this.rules.push(rule)
    }
    this.saveRules()
  }

  /**
   * Remove notification rule
   */
  removeRule(ruleId: string): boolean {
    const initialLength = this.rules.length
    this.rules = this.rules.filter((r) => r.id !== ruleId)
    if (this.rules.length < initialLength) {
      this.saveRules()
      return true
    }
    return false
  }

  /**
   * Get notification statistics
   */
  getStats(): NotificationStats {
    const totalSent = this.notifications.filter((n) => n.status === "sent").length
    const totalPending = this.notifications.filter((n) => n.status === "pending").length
    const totalFailed = this.notifications.filter((n) => n.status === "failed").length
    const total = totalSent + totalFailed

    const byType: Record<string, number> = {}
    const byUrgency: Record<string, number> = {}

    this.notifications.forEach((notification) => {
      byType[notification.type] = (byType[notification.type] || 0) + 1
      byUrgency[notification.urgency] = (byUrgency[notification.urgency] || 0) + 1
    })

    return {
      totalSent,
      totalPending,
      totalFailed,
      byType,
      byUrgency,
      successRate: total > 0 ? (totalSent / total) * 100 : 0,
      lastProcessed: new Date().toISOString(),
    }
  }

  /**
   * Get notifications for a specific student
   */
  getStudentNotifications(studentId: string): Notification[] {
    return this.notifications
      .filter((n) => n.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }

  /**
   * Mark notification as sent
   */
  markAsSent(notificationId: string): boolean {
    const notification = this.notifications.find((n) => n.id === notificationId)
    if (notification && notification.status === "pending") {
      notification.status = "sent"
      notification.sentAt = new Date().toISOString()
      this.saveNotifications()
      return true
    }
    return false
  }

  /**
   * Mark notification as failed
   */
  markAsFailed(notificationId: string, error: string): boolean {
    const notification = this.notifications.find((n) => n.id === notificationId)
    if (notification && notification.status === "pending") {
      notification.status = "failed"
      notification.error = error
      this.saveNotifications()
      return true
    }
    return false
  }

  /**
   * Generate payment reminder notifications
   */
  generatePaymentReminders(students: Student[]): Notification[] {
    const notifications: Notification[] = []
    const currentDate = new Date()

    students.forEach((student) => {
      if (student.isTransferred) return

      const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
      if (outstanding <= 0) return

      // Check for overdue payments
      const overduePayments = this.getOverduePayments(student)
      if (overduePayments.length > 0) {
        const daysPastDue = this.calculateDaysPastDue(overduePayments[0])

        let urgency: "low" | "medium" | "high" | "critical" = "low"
        if (daysPastDue > 90) urgency = "critical"
        else if (daysPastDue > 60) urgency = "high"
        else if (daysPastDue > 30) urgency = "medium"

        const notification: Notification = {
          id: this.generateNotificationId(),
          ruleId: "payment_reminder",
          studentId: student.id,
          studentName: student.fullName,
          parentContact: student.parentContact,
          type: "payment_reminder",
          subject: `Payment Reminder - ${student.fullName}`,
          message: this.generatePaymentReminderMessage(student, outstanding, daysPastDue),
          urgency,
          channels: ["email", "sms"],
          status: "pending",
          createdAt: new Date().toISOString(),
          metadata: {
            outstandingAmount: outstanding,
            daysPastDue,
            overduePayments: overduePayments.length,
          },
        }

        notifications.push(notification)
      }
    })

    return notifications
  }

  /**
   * Generate promotion alert notifications
   */
  generatePromotionAlerts(students: Student[]): Notification[] {
    const notifications: Notification[] = []
    const currentMonth = getCurrentMonth()

    // Check if it's promotion season (typically November-December)
    if (currentMonth >= 11 || currentMonth <= 1) {
      students.forEach((student) => {
        if (student.isTransferred) return

        const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

        // Alert for students with outstanding payments during promotion season
        if (outstanding > 0) {
          const notification: Notification = {
            id: this.generateNotificationId(),
            ruleId: "promotion_alert",
            studentId: student.id,
            studentName: student.fullName,
            parentContact: student.parentContact,
            type: "promotion_alert",
            subject: `Promotion Alert - Outstanding Payment Required`,
            message: this.generatePromotionAlertMessage(student, outstanding),
            urgency: "high",
            channels: ["email", "in_app"],
            status: "pending",
            createdAt: new Date().toISOString(),
            metadata: {
              outstandingAmount: outstanding,
              promotionSeason: true,
            },
          }

          notifications.push(notification)
        }
      })
    }

    return notifications
  }

  // Private methods

  private async processRule(rule: NotificationRule, students: Student[]): Promise<Notification[]> {
    const notifications: Notification[] = []

    for (const student of students) {
      if (this.shouldTriggerNotification(rule, student)) {
        const notification = this.createNotificationFromRule(rule, student)
        notifications.push(notification)
        this.notifications.push(notification)
      }
    }

    return notifications
  }

  private shouldTriggerNotification(rule: NotificationRule, student: Student): boolean {
    if (student.isTransferred) return false

    // Check class filter
    if (rule.conditions.classFilter && !rule.conditions.classFilter.includes(student.className)) {
      return false
    }

    // Check amount threshold
    if (rule.conditions.amountThreshold) {
      const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)
      if (outstanding < rule.conditions.amountThreshold) {
        return false
      }
    }

    // Check custom condition
    if (rule.conditions.customCondition && !rule.conditions.customCondition(student)) {
      return false
    }

    // Check if notification already exists for this rule and student
    const existingNotification = this.notifications.find(
      (n) =>
        n.ruleId === rule.id &&
        n.studentId === student.id &&
        n.status !== "failed" &&
        this.isRecentNotification(n.createdAt),
    )

    return !existingNotification
  }

  private createNotificationFromRule(rule: NotificationRule, student: Student): Notification {
    const outstanding = calculateOutstandingFromEnrollment(student, this.settings.billingCycle)

    return {
      id: this.generateNotificationId(),
      ruleId: rule.id,
      studentId: student.id,
      studentName: student.fullName,
      parentContact: student.parentContact,
      type: rule.type,
      subject: this.processTemplate(rule.template.subject, student, { outstanding }),
      message: this.processTemplate(rule.template.message, student, { outstanding }),
      urgency: rule.template.urgency,
      channels: rule.channels,
      status: "pending",
      createdAt: new Date().toISOString(),
      metadata: {
        outstandingAmount: outstanding,
        ruleConditions: rule.conditions,
      },
    }
  }

  private async sendPendingNotifications(): Promise<{ sent: number; failed: number }> {
    const pendingNotifications = this.notifications.filter((n) => n.status === "pending")
    let sent = 0
    let failed = 0

    for (const notification of pendingNotifications) {
      try {
        // Simulate sending notification (in real implementation, integrate with email/SMS services)
        await this.simulateSendNotification(notification)
        notification.status = "sent"
        notification.sentAt = new Date().toISOString()
        sent++
      } catch (error) {
        notification.status = "failed"
        notification.error = error instanceof Error ? error.message : "Unknown error"
        failed++
      }
    }

    return { sent, failed }
  }

  private async simulateSendNotification(notification: Notification): Promise<void> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 100))

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      // 5% failure rate
      throw new Error("Network error")
    }

    console.log(`📧 Notification sent: ${notification.subject} to ${notification.parentContact}`)
  }

  private getOverduePayments(student: Student): FeePayment[] {
    if (!Array.isArray(student.feePayments)) return []

    const currentDate = new Date()
    return student.feePayments.filter((payment) => {
      const dueDate = new Date(payment.dueDate)
      return !payment.paid && payment.outstandingAmount > 0 && dueDate < currentDate
    })
  }

  private calculateDaysPastDue(payment: FeePayment): number {
    const currentDate = new Date()
    const dueDate = new Date(payment.dueDate)
    const diffTime = currentDate.getTime() - dueDate.getTime()
    return Math.floor(diffTime / (1000 * 60 * 60 * 24))
  }

  private generatePaymentReminderMessage(student: Student, outstanding: number, daysPastDue: number): string {
    return `
Dear Parent/Guardian of ${student.fullName},

This is a friendly reminder that your child has an outstanding balance of $${outstanding.toFixed(2)} that is ${daysPastDue} days past due.

Student Details:
- Name: ${student.fullName}
- Class: ${student.className}
- Student ID: ${student.id}

Please arrange payment at your earliest convenience to avoid any disruption to your child's education.

For payment arrangements or questions, please contact the school office.

Thank you for your attention to this matter.

${this.settings.schoolName}
School Administration
    `.trim()
  }

  private generatePromotionAlertMessage(student: Student, outstanding: number): string {
    return `
Dear Parent/Guardian of ${student.fullName},

As we approach the end of the academic year and prepare for student promotions, we need to address the outstanding balance on your child's account.

Outstanding Amount: $${outstanding.toFixed(2)}

To ensure your child's smooth promotion to the next grade, please settle this balance before the promotion deadline.

Contact the school office to arrange payment or discuss payment plans.

${this.settings.schoolName}
School Administration
    `.trim()
  }

  private processTemplate(template: string, student: Student, variables: Record<string, any>): string {
    let processed = template

    // Replace student variables
    processed = processed.replace(/\{student\.(\w+)\}/g, (match, property) => {
      return (student as any)[property] || match
    })

    // Replace custom variables
    Object.entries(variables).forEach(([key, value]) => {
      processed = processed.replace(new RegExp(`\\{${key}\\}`, "g"), String(value))
    })

    return processed
  }

  private isRecentNotification(createdAt: string): boolean {
    const notificationDate = new Date(createdAt)
    const now = new Date()
    const daysDiff = (now.getTime() - notificationDate.getTime()) / (1000 * 60 * 60 * 24)
    return daysDiff < 7 // Consider notifications from last 7 days as recent
  }

  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private loadDefaultRules(): NotificationRule[] {
    return [
      {
        id: "payment_reminder_30",
        name: "Payment Reminder - 30 Days Overdue",
        type: "payment_reminder",
        enabled: true,
        conditions: {
          daysAfter: 30,
          amountThreshold: 50,
        },
        template: {
          subject: "Payment Reminder - {student.fullName}",
          message:
            "Your child {student.fullName} has an outstanding balance of ${outstanding}. Please arrange payment to avoid any disruption to their education.",
          urgency: "medium",
        },
        channels: ["email", "sms"],
        schedule: {
          frequency: "weekly",
          days: [1], // Monday
        },
      },
      {
        id: "payment_overdue_60",
        name: "Overdue Notice - 60 Days",
        type: "overdue_notice",
        enabled: true,
        conditions: {
          daysAfter: 60,
          amountThreshold: 100,
        },
        template: {
          subject: "URGENT: Overdue Payment Notice - {student.fullName}",
          message:
            "This is an urgent notice regarding the overdue payment of ${outstanding} for {student.fullName}. Immediate action is required.",
          urgency: "high",
        },
        channels: ["email", "sms", "print"],
        schedule: {
          frequency: "weekly",
          days: [1, 4], // Monday and Thursday
        },
      },
      {
        id: "promotion_season_alert",
        name: "Promotion Season Payment Alert",
        type: "promotion_alert",
        enabled: true,
        conditions: {
          amountThreshold: 1,
          customCondition: (student: Student) => {
            const month = getCurrentMonth()
            return month >= 11 || month <= 1 // November to January
          },
        },
        template: {
          subject: "Promotion Alert - Payment Required",
          message:
            "To ensure smooth promotion for {student.fullName}, please settle the outstanding balance of ${outstanding}.",
          urgency: "high",
        },
        channels: ["email", "in_app"],
        schedule: {
          frequency: "weekly",
          days: [1],
        },
      },
    ]
  }

  private loadNotifications(): Notification[] {
    try {
      const saved = localStorage.getItem("notifications")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  private saveNotifications(): void {
    try {
      localStorage.setItem("notifications", JSON.stringify(this.notifications))
    } catch (error) {
      console.error("Failed to save notifications:", error)
    }
  }

  private loadRules(): NotificationRule[] {
    try {
      const saved = localStorage.getItem("notificationRules")
      return saved ? JSON.parse(saved) : this.loadDefaultRules()
    } catch {
      return this.loadDefaultRules()
    }
  }

  private saveRules(): void {
    try {
      localStorage.setItem("notificationRules", JSON.stringify(this.rules))
    } catch (error) {
      console.error("Failed to save notification rules:", error)
    }
  }
}

export default NotificationSystem
