const admin = require('firebase-admin')

class FirebaseSync {
  constructor() {
    this.db = null
    this.initialized = false
  }

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

  // Helper function to clean up undefined values in transport payments
  cleanTransportPayments(transportPayments) {
    if (!transportPayments) return [];
    return transportPayments.map(payment => ({
      ...payment,
      paidDate: payment.paidDate || null, // Convert undefined to null
      amount: payment.amount || 0,
      // Add other fields with defaults as needed
    }));
  }

  async syncStudents(students) {
    if (!this.db) await this.initialize()

    try {
      const batch = this.db.batch()
      const studentsRef = this.db.collection('students')

      // Clear existing students and add new ones
      const existingStudents = await studentsRef.get()
      existingStudents.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Add current students
      students.forEach(student => {
        const docRef = studentsRef.doc(student.id)
        // Clean up the student data before saving
        const cleanStudent = {
          ...student,
          transportPayments: this.cleanTransportPayments(student.transportPayments),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
        batch.set(docRef, cleanStudent, { merge: true })
      })

      await batch.commit()
      console.log(`Successfully synced ${students.length} students to Firestore`)
    } catch (error) {
      console.error('Error syncing students:', error)
      throw error
    }
  }

  async syncTransferredStudents(students) {
    if (!students || !Array.isArray(students)) {
      console.log('No transferred students to sync or invalid input')
      return
    }

    if (!this.db) await this.initialize()

    try {
      const batch = this.db.batch()
      const transferredRef = this.db.collection('transferredStudents')

      // Clear existing records
      const existing = await transferredRef.get()
      existing.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Add current transferred students
      students.forEach(student => {
        if (!student || !student.id) return // Skip invalid entries
        
        const docRef = transferredRef.doc(student.id)
        const cleanStudent = {
          ...student,
          transportPayments: this.cleanTransportPayments(student.transportPayments),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
        batch.set(docRef, cleanStudent, { merge: true })
      })

      await batch.commit()
      console.log(`Successfully synced ${students.length} transferred students to Firestore`)
      return true
    } catch (error) {
      console.error('Error syncing transferred students:', error)
      throw error
    }
  }

  async syncPendingPromoted(students) {
    if (!students || !Array.isArray(students)) {
      console.log('No pending promoted students to sync or invalid input')
      return
    }

    if (!this.db) await this.initialize()

    try {
      const batch = this.db.batch()
      const pendingRef = this.db.collection('pendingPromoted')

      // Clear existing records
      const existing = await pendingRef.get()
      existing.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Add current pending promoted students
      students.forEach(student => {
        if (!student || !student.id) return // Skip invalid entries
        
        const docRef = pendingRef.doc(student.id)
        const cleanStudent = {
          ...student,
          transportPayments: this.cleanTransportPayments(student.transportPayments),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
        batch.set(docRef, cleanStudent, { merge: true })
      })

      await batch.commit()
      console.log(`Successfully synced ${students.length} pending promoted students to Firestore`)
      return true
    } catch (error) {
      console.error('Error syncing pending promoted students:', error)
      throw error
    }
  }

  async syncSettings(settings) {
    if (!settings) {
      console.log('No settings to sync')
      return
    }

    if (!this.db) await this.initialize()

    try {
      const settingsRef = this.db.collection('settings').doc('app')
      await settingsRef.set({
        ...settings,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true })
      console.log('Successfully synced settings to Firestore')
    } catch (error) {
      console.error('Error syncing settings:', error)
      throw error
    }
  }

  async syncExpense(expense) {
    if (!this.db) await this.initialize()

    try {
      await this.db.collection('expenses').doc(expense.id).set({
        ...expense,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp()
      })
      console.log('Successfully synced expense to Firestore')
    } catch (error) {
      console.error('Error syncing expense:', error)
      throw error
    }
  }

  async deleteExpense(expenseId) {
    if (!this.db) await this.initialize()

    try {
      await this.db.collection('expenses').doc(expenseId).delete()
      console.log('Successfully deleted expense from Firestore')
    } catch (error) {
      console.error('Error deleting expense:', error)
      throw error
    }
  }

  async syncExtraBilling(extraBillingPages) {
    if (!this.db) await this.initialize()
    if (!extraBillingPages || !Array.isArray(extraBillingPages)) {
      console.log('No extra billing pages to sync or invalid input')
      return
    }

    try {
      const batch = this.db.batch()
      const extraBillingRef = this.db.collection('extraBilling')
      
      // Clear existing extra billing
      const existingBilling = await extraBillingRef.get()
      existingBilling.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Flatten pages into individual billing items
      let totalItems = 0
      extraBillingPages.forEach(page => {
        if (page.entries && Array.isArray(page.entries)) {
          page.entries.forEach(entry => {
            // Create individual billing items from entries
            entry.payments.forEach((payment, paymentIndex) => {
              const itemId = `${page.id}_${entry.id}_${paymentIndex}`
              const docRef = extraBillingRef.doc(itemId)
              
              batch.set(docRef, {
                id: itemId,
                studentId: entry.id,
                studentName: entry.studentName,
                description: `${page.name} - ${entry.purpose}`,
                amount: payment.amount,
                date: payment.date,
                dueDate: payment.date, // Use same date as due date
                paid: true, // Assume paid since it's in payments array
                paidDate: payment.date,
                notes: `From billing page: ${page.name}`,
                pageId: page.id,
                pageName: page.name,
                lastUpdated: admin.firestore.FieldValue.serverTimestamp()
              })
              totalItems++
            })
          })
        }
      })

      await batch.commit()
      console.log(`Successfully synced ${totalItems} extra billing items to Firestore from ${extraBillingPages.length} pages`)
    } catch (error) {
      console.error('Error syncing extra billings:', error)
      throw error
    }
  }

  async deleteExtraBilling(billingId) {
    if (!this.db) await this.initialize()

    try {
      await this.db.collection('extraBillings').doc(billingId).delete()
      console.log('Successfully deleted extra billing from Firestore')
      return true
    } catch (error) {
      console.error('Error deleting extra billing:', error)
      throw error
    }
  }

  async syncOutstandingStudents(students) {
    if (!students || !Array.isArray(students)) {
      console.log('No outstanding students to sync or invalid input')
      return
    }

    if (!this.db) await this.initialize()

    try {
      const batch = this.db.batch()
      const outstandingRef = this.db.collection('outstandingStudents')

      // Clear existing records
      const existing = await outstandingRef.get()
      existing.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Add current outstanding students
      students.forEach(student => {
        if (!student || !student.id) return // Skip invalid entries
        
        const docRef = outstandingRef.doc(student.id)
        const cleanStudent = {
          ...student,
          transportPayments: this.cleanTransportPayments(student.transportPayments),
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        }
        batch.set(docRef, cleanStudent, { merge: true })
      })

      await batch.commit()
      console.log(`Successfully synced ${students.length} outstanding students to Firestore`)
      return true
    } catch (error) {
      console.error('Error syncing outstanding students:', error)
      throw error
    }
  }

  async syncExpenses(expenses) {
    if (!this.db) await this.initialize()
    if (!expenses || !Array.isArray(expenses)) {
      console.log('No expenses to sync or invalid input')
      return
    }

    try {
      const batch = this.db.batch()
      const expensesRef = this.db.collection('expenses')
      
      // Clear existing expenses
      const existingExpenses = await expensesRef.get()
      existingExpenses.docs.forEach(doc => {
        batch.delete(doc.ref)
      })

      // Add new expenses
      expenses.forEach(expense => {
        const docRef = expensesRef.doc(expense.id)
        batch.set(docRef, {
          ...expense,
          lastUpdated: admin.firestore.FieldValue.serverTimestamp()
        })
      })

      await batch.commit()
      console.log(`Successfully synced ${expenses.length} expenses to Firestore`)
    } catch (error) {
      console.error('Error syncing expenses:', error)
      throw error
    }
  }

}

const firebaseSync = new FirebaseSync()
module.exports = { firebaseSync }
