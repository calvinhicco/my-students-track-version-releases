const admin = require('firebase-admin')

// Type definitions for compatibility
interface Student {
  id: string
  fullName: string
  admissionDate: string
  classGroup: string
  feePayments?: any[]
  transportPayments?: any[]
  hasTransport?: boolean
  transportFee?: number
}

interface TransferredStudent {
  id: string
  fullName: string
  transferDate: string
}

interface PendingPromotedStudent {
  id: string
  fullName: string
  currentClass: string
  promotedToClass: string
}

interface AppSettings {
  schoolName: string
  billingCycle: string
  classGroups: any[]
}

class FirebaseSync {
  private db: any | null = null
  private initialized = false

  async initialize() {
    if (this.initialized) return

    try {
      // Initialize Firebase Admin SDK
      if (!admin.apps.length) {
        const serviceAccount = require('../firebase-service-account.json')
        
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount)
        })
      }

      this.db = admin.firestore()
      this.initialized = true
      console.log('Firebase Admin SDK initialized successfully')
    } catch (error) {
      console.error('Failed to initialize Firebase Admin SDK:', error)
      throw error
    }
  }

  async syncStudents(students: Student[]) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db!.batch()
      const studentsRef = this.db!.collection('students')

      // Clear existing students and add new ones
      const existingStudents = await studentsRef.get()
      existingStudents.docs.forEach((doc: any) => {
        batch.delete(doc.ref)
      })

      // Add current students
      students.forEach(student => {
        const docRef = studentsRef.doc(student.id)
        batch.set(docRef, {
          ...student,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Synced ${students.length} students to Firestore`)
    } catch (error) {
      console.error('Error syncing students:', error)
      throw error
    }
  }

  async syncTransferredStudents(students: TransferredStudent[]) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db!.batch()
      const transferredRef = this.db!.collection('transferredStudents')

      // Clear and update
      const existing = await transferredRef.get()
      existing.docs.forEach((doc: any) => batch.delete(doc.ref))

      students.forEach(student => {
        const docRef = transferredRef.doc(student.id)
        batch.set(docRef, {
          ...student,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Synced ${students.length} transferred students to Firestore`)
    } catch (error) {
      console.error('Error syncing transferred students:', error)
      throw error
    }
  }

  async syncPendingPromoted(students: PendingPromotedStudent[]) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db!.batch()
      const pendingRef = this.db!.collection('pendingPromoted')

      // Clear and update
      const existing = await pendingRef.get()
      existing.docs.forEach((doc: any) => batch.delete(doc.ref))

      students.forEach(student => {
        const docRef = pendingRef.doc(student.id)
        batch.set(docRef, {
          ...student,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Synced ${students.length} pending promoted students to Firestore`)
    } catch (error) {
      console.error('Error syncing pending promoted students:', error)
      throw error
    }
  }

  async syncSettings(settings: AppSettings) {
    if (!this.db) await this.initialize()

    try {
      await this.db!.collection('settings').doc('appSettings').set({
        ...settings,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('Synced app settings to Firestore')
    } catch (error) {
      console.error('Error syncing settings:', error)
      throw error
    }
  }

  async syncExpenses(expenses: any[]) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db!.batch()
      const expensesRef = this.db!.collection('expenses')

      // Clear existing expenses and add new ones
      const existingExpenses = await expensesRef.get()
      existingExpenses.docs.forEach((doc: any) => {
        batch.delete(doc.ref)
      })

      // Add current expenses
      expenses.forEach(expense => {
        const docRef = expensesRef.doc(expense.id)
        batch.set(docRef, {
          ...expense,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Synced ${expenses.length} expenses to Firestore`)
    } catch (error) {
      console.error('Error syncing expenses:', error)
      throw error
    }
  }

  async syncExtraBilling(extraBilling: any[]) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db!.batch()
      const extraBillingRef = this.db!.collection('extraBilling')

      // Clear existing and add new
      const existing = await extraBillingRef.get()
      existing.docs.forEach((doc: any) => batch.delete(doc.ref))

      extraBilling.forEach(item => {
        const docRef = extraBillingRef.doc(item.id)
        batch.set(docRef, {
          ...item,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Synced ${extraBilling.length} extra billing items to Firestore`)
    } catch (error) {
      console.error('Error syncing extra billing:', error)
      throw error
    }
  }

  async syncOutstandingStudents(outstandingStudents: any[]) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db!.batch()
      const outstandingRef = this.db!.collection('outstandingStudents')

      // Clear existing and add new
      const existing = await outstandingRef.get()
      existing.docs.forEach((doc: any) => batch.delete(doc.ref))

      outstandingStudents.forEach(student => {
        const docRef = outstandingRef.doc(student.id)
        batch.set(docRef, {
          ...student,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Synced ${outstandingStudents.length} outstanding students to Firestore`)
    } catch (error) {
      console.error('Error syncing outstanding students:', error)
      throw error
    }
  }

  async syncExpense(expense: any) {
    if (!this.db) await this.initialize()

    try {
      await this.db!.collection('expenses').doc(expense.id).set({
        ...expense,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('Synced expense to Firestore')
    } catch (error) {
      console.error('Error syncing expense:', error)
      throw error
    }
  }

  async deleteExpense(expenseId: string) {
    if (!this.db) await this.initialize()

    try {
      await this.db!.collection('expenses').doc(expenseId).delete()
      console.log('Deleted expense from Firestore')
    } catch (error) {
      console.error('Error deleting expense:', error)
      throw error
    }
  }
}

const firebaseSync = new FirebaseSync()
module.exports = { firebaseSync }
