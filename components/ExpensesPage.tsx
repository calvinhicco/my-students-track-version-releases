"use client"

import { CardFooter } from "@/components/ui/card"
import type React from "react"
import { useState, useEffect, useMemo } from "react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs"
import { Search, Filter, Plus, AlertCircle, Undo2, DollarSign, FileDown } from "lucide-react"
import { format, startOfWeek, startOfMonth, startOfYear, isWithinInterval } from "date-fns"
import {
  type Expense,
  type ExpenseCategory,
  type ExpenseFilter,
  type ExpenseSummary,
  DEFAULT_EXPENSE_CATEGORIES,
  EXPENSE_STORAGE_KEYS,
} from "../types/expense"
import type { AppSettings, Student } from "../types"
import { SchoolDataStorage } from "../lib/storage"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { getCurrentMonth } from "../lib/dateUtils"
import { BillingCycle, TERMS } from "../types/index"
import { calculateMonthlyCollections } from "../lib/calculations"
import { exportExpensesToPDF } from "@/lib/pdfUtils"

interface ExpensesPageProps {
  settings: AppSettings
  onBack: () => void
}

interface CollectionsState {
  currentTerm: number
  currentMonth: number
  currentTransport: number
  remainingTerm: number
  remainingMonth: number
  remainingTransport: number
}

export function ExpensesPage({ settings, onBack }: ExpensesPageProps) {
  // Initialize storage
  const storage = new SchoolDataStorage()
  
  // Component state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>(DEFAULT_EXPENSE_CATEGORIES)
  const [isLoading, setIsLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [activeTab, setActiveTab] = useState("yearly")
  const [reversingExpense, setReversingExpense] = useState<string | null>(null)
  const [reversalReason, setReversalReason] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [students, setStudents] = useState<Student[]>([])

  // Date range state
  const [dateRange, setDateRange] = useState({
    from: startOfYear(new Date()),
    to: new Date(),
  })

  // New expense form state
  const [newExpense, setNewExpense] = useState<Omit<Expense, "id" | "createdAt" | "isReversed">>({
    purpose: "",
    amount: 0,
    date: new Date().toISOString().split("T")[0],
    createdBy: "System",
    category: "",
    receiptNumber: "",
    notes: "",
  })

  // Collections state
  const [collections, setCollections] = useState<CollectionsState>({
    currentTerm: 0,
    currentMonth: 0,
    currentTransport: 0,
    remainingTerm: 0,
    remainingMonth: 0,
    remainingTransport: 0,
  })

  // Filters state
  const [filters, setFilters] = useState<ExpenseFilter>({
    dateRange: {
      from: startOfYear(new Date()),
      to: new Date(),
    },
  })

  // Calculate real-time transport fees (matching dashboard logic)
  const currentMonthTransportFees = useMemo(() => {
    const currentMonth = getCurrentMonth()
    const currentYear = new Date().getFullYear()

    return students.reduce((total, student) => {
      if (!student.hasTransport || !Array.isArray(student.transportPayments)) {
        return total
      }

      // Get all transport payments that have any amount paid in the current month
      const studentTransportPaymentsInCurrentMonth = student.transportPayments.filter((payment) => {
        // Include any payment with amountPaid > 0 for current month period OR with paidDate in current month
        if ((payment.amountPaid || 0) <= 0 || payment.isSkipped) return false

        // Check if this is a payment for the current month period (month 9 = September)
        const isCurrentMonthPeriod = payment.month === currentMonth
        
        // Check if this payment was made in the current calendar month (paidDate)
        let isPaidInCurrentMonth = false
        if (payment.paidDate) {
          try {
            const paymentDate = new Date(payment.paidDate)
            isPaidInCurrentMonth = paymentDate.getFullYear() === currentYear && paymentDate.getMonth() + 1 === currentMonth
          } catch (error) {
            console.warn("Invalid transport payment paidDate:", payment.paidDate, error)
          }
        }
        
        return isCurrentMonthPeriod || isPaidInCurrentMonth
      })

      // Sum the transport payments made in current month
      const sumForStudent = studentTransportPaymentsInCurrentMonth.reduce((sum, payment) => {
        return sum + (payment.amountPaid || 0)
      }, 0)

      return total + sumForStudent
    }, 0)
  }, [students])

  // Calculate current term and termly collections
  const getCurrentTerm = () => {
    const month = new Date().getMonth()
    if (month >= 0 && month <= 3) return "1st Term (Jan - Apr)"
    if (month >= 4 && month <= 7) return "2nd Term (May - Aug)"
    return "3rd Term (Sep - Dec)"
  }

  const currentTermLabel = useMemo(getCurrentTerm, [])

  const currentTermCollections = useMemo(() => {
    if (settings.billingCycle === BillingCycle.TERMLY) {
      return calculateMonthlyCollections(students, BillingCycle.TERMLY)
    }
    return 0
  }, [students, settings.billingCycle])

  // Load data from localStorage on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true)

        // Load students data to calculate real-time figures
        const savedStudents = localStorage.getItem("studentTrackStudents")
        if (savedStudents) {
          const parsedStudents = JSON.parse(savedStudents) as Student[]
          setStudents(parsedStudents)
        }

        const savedExpenses = storage.getExpenses()
        const savedCollections = localStorage.getItem("schoolCollections")

        setExpenses(savedExpenses)

        const savedCategories = localStorage.getItem(EXPENSE_STORAGE_KEYS.CATEGORIES)
        if (savedCategories) {
          setCategories(JSON.parse(savedCategories))
        }

        if (savedCollections) {
          const collectionsData = JSON.parse(savedCollections)
          setCollections({
            currentTerm: collectionsData.currentTerm || 0,
            currentMonth: collectionsData.currentMonth || 0,
            currentTransport: collectionsData.currentTransport || 0,
            remainingTerm: collectionsData.remainingTerm || 0,
            remainingMonth: collectionsData.remainingMonth || 0,
            remainingTransport: collectionsData.remainingTransport || 0,
          })
        }
      } catch (error) {
        console.error("Error loading data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    loadData()
  }, [])

  // Save data to storage when expenses or collections change
  useEffect(() => {
    if (!isLoading) {
      storage.saveExpenses(expenses)
      localStorage.setItem("schoolCollections", JSON.stringify(collections))
    }
  }, [expenses, collections, isLoading, storage])

  // Calculate filtered expenses
  const filteredExpenses = useMemo(() => {
    return expenses
      .filter((expense) => {
        // Apply search term filter
        if (filters.searchTerm && !expense.purpose.toLowerCase().includes(filters.searchTerm.toLowerCase())) {
          return false
        }

        // Apply purpose filter (for backward compatibility)
        if (filters.purpose && !expense.purpose.toLowerCase().includes(filters.purpose.toLowerCase())) {
          return false
        }

        // Apply date range filter
        const expenseDate = new Date(expense.date)
        if (
          filters.dateRange &&
          !isWithinInterval(expenseDate, {
            start: filters.dateRange.from,
            end: filters.dateRange.to,
          })
        ) {
          return false
        }

        // Apply category filter
        if (filters.category && expense.category !== filters.category) {
          return false
        }

        // Apply amount filters
        if (filters.minAmount !== undefined && expense.amount < filters.minAmount) {
          return false
        }

        if (filters.maxAmount !== undefined && expense.amount > filters.maxAmount) {
          return false
        }

        // Apply reversal status filter
        if (filters.isReversed !== undefined && expense.isReversed !== filters.isReversed) {
          return false
        }

        // Apply created by filter
        if (filters.createdBy && expense.createdBy !== filters.createdBy) {
          return false
        }

        return true
      })
      .sort((a, b) => {
        // Sort by date (latest first), then by creation time if dates are same
        const dateA = new Date(a.date)
        const dateB = new Date(b.date)

        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime() // Latest date first
        }

        // If dates are same, sort by creation time (latest first)
        const createdA = new Date(a.createdAt)
        const createdB = new Date(b.createdAt)
        return createdB.getTime() - createdA.getTime()
      })
  }, [expenses, filters])

  // Calculate summary
  const summary: ExpenseSummary = useMemo(() => {
    const filtered = filteredExpenses.filter((expense) => !expense.isReversed)
    const reversed = filteredExpenses.filter((expense) => expense.isReversed)
    const totalExpenses = filtered.reduce((sum, expense) => sum + expense.amount, 0)
    const totalReversed = reversed.reduce((sum, expense) => sum + expense.amount, 0)

    return {
      period: {
        from: filters.dateRange?.from || new Date(),
        to: filters.dateRange?.to || new Date(),
      },
      totalExpenses,
      totalReversed,
      netExpenses: totalExpenses - totalReversed,
      count: filtered.length,
      reversedCount: reversed.length,
      totalTransactions: filteredExpenses.length,
      reversedTransactions: reversed.length,
    }
  }, [filteredExpenses, filters.dateRange])

  // Handle tab changes
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    const today = new Date()
    let from: Date

    switch (value) {
      case "daily":
        from = new Date(today.setHours(0, 0, 0, 0))
        break
      case "weekly":
        from = startOfWeek(today)
        break
      case "monthly":
        from = startOfMonth(today)
        break
      default: // yearly
        from = startOfYear(today)
    }

    setFilters((prev) => ({
      ...prev,
      dateRange: {
        from,
        to: new Date(),
      },
    }))
  }

  // Handle adding a new expense
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault()

    const expense: Expense = {
      ...newExpense,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      isReversed: false,
    }

    setExpenses((prev) => [...prev, expense])
    setShowAddForm(false)

    // Reset form
    setNewExpense({
      purpose: "",
      amount: 0,
      date: new Date().toISOString().split("T")[0],
      createdBy: "System",
      category: "",
      receiptNumber: "",
      notes: "",
    })
  }

  // Handle reversing an expense
  const handleReverseExpense = (id: string, reason: string) => {
    if (!reason.trim()) return

    setExpenses((prev) =>
      prev.map((expense) =>
        expense.id === id
          ? {
              ...expense,
              isReversed: true,
              reversedAt: new Date().toISOString(),
              reversalReason: reason,
              notes: `${expense.notes ? expense.notes + "\n" : ""}Reversed: ${reason}`,
            }
          : expense,
      ),
    )

    setReversingExpense(null)
    setReversalReason("")
  }

  // Handle exporting to PDF
  const handleExportPDF = () => {
    const title = activeTab === 'daily' ? 'Daily' : 
                 activeTab === 'weekly' ? 'Weekly' : 
                 activeTab === 'monthly' ? 'Monthly' : 'Yearly';
    
    exportExpensesToPDF(
      expenses,
      categories,
      `${title} Expenses`,
      {
        from: dateRange.from,
        to: dateRange.to
      }
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-gray-500">Track and manage school expenses</p>
        </div>
        <Button onClick={onBack} variant="outline">
          ← Back to Dashboard
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        {/* Current Month Transport Fees Card - Green for collections */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium">Transport Fees Collected (Current Month Only)</CardTitle>
            <DollarSign className="h-3 w-3 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-purple-800">
              $
              {currentMonthTransportFees.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[10px] text-gray-600">
              {new Date(0, new Date().getMonth()).toLocaleString("default", { month: "long" })}
            </p>
          </CardContent>
        </Card>

        {/* Current Month Collections Card - Green for collections */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-green-800">Current Month Collections</CardTitle>
            <DollarSign className="h-3 w-3 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-800">${collections.currentMonth.toFixed(2)}</div>
            <p className="text-[10px] text-green-600">School fees collected</p>
          </CardContent>
        </Card>

        {/* Current Term Collections Card - Green for collections */}
        <Card className="border-green-200 bg-green-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-green-800">Current Term Collections</CardTitle>
            <DollarSign className="h-3 w-3 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-green-800">
              $
              {currentTermCollections.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] text-green-600">{currentTermLabel}</p>
          </CardContent>
        </Card>



        {/* Total Expenses Card - Red for expenses */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader className="pb-1">
            <CardTitle className="text-xs font-medium text-red-800">Total Expenses</CardTitle>
            <DollarSign className="h-3 w-3 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-red-800">${summary.totalExpenses.toFixed(2)}</div>
            <p className="text-xs text-red-600">{summary.count} transactions</p>
          </CardContent>
        </Card>

        {/* Expected Cash In Hand Card - Blue for net calculation */}
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
            <CardTitle className="text-xs font-medium text-blue-800">Expected Cash In Hand</CardTitle>
            <DollarSign className="h-3 w-3 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold text-blue-800">
              $
              {(
                currentMonthTransportFees +
                collections.currentMonth +
                currentTermCollections -
                summary.totalExpenses
              ).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-[10px] text-blue-600">Total Income - Expenses</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs and Filters */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-4">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="daily">Today</TabsTrigger>
            <TabsTrigger value="weekly">This Week</TabsTrigger>
            <TabsTrigger value="monthly">This Month</TabsTrigger>
            <TabsTrigger value="yearly">This Year</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                type="search"
                placeholder="Search expenses..."
                className="w-full pl-10"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value)
                  setFilters((prev) => ({ ...prev, searchTerm: e.target.value }))
                }}
              />
            </div>

            {/* Filters */}
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="gap-2 bg-transparent"
                onClick={() => setShowFilters(!showFilters)}
                type="button"
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
              {showFilters && (
                <div className="absolute z-10 right-0 mt-1 w-80 bg-white border rounded-md shadow-lg p-4">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="category">Category</Label>
                      <select
                        id="category"
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                        value={filters.category || ""}
                        onChange={(e) =>
                          setFilters({
                            ...filters,
                            category: e.target.value || undefined,
                          })
                        }
                      >
                        <option value="">All Categories</option>
                        {categories
                          .filter((category) => category.isActive)
                          .map((category) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="minAmount">Min Amount</Label>
                        <Input
                          id="minAmount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={filters.minAmount || ""}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              minAmount: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="maxAmount">Max Amount</Label>
                        <Input
                          id="maxAmount"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={filters.maxAmount || ""}
                          onChange={(e) =>
                            setFilters({
                              ...filters,
                              maxAmount: e.target.value ? Number.parseFloat(e.target.value) : undefined,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Status</Label>
                      <div className="space-y-2">
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="status"
                            className="h-4 w-4"
                            checked={filters.isReversed === undefined}
                            onChange={() => setFilters({ ...filters, isReversed: undefined })}
                          />
                          <span>All</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="status"
                            className="h-4 w-4"
                            checked={filters.isReversed === false}
                            onChange={() => setFilters({ ...filters, isReversed: false })}
                          />
                          <span>Active Only</span>
                        </label>
                        <label className="flex items-center space-x-2">
                          <input
                            type="radio"
                            name="status"
                            className="h-4 w-4"
                            checked={filters.isReversed === true}
                            onChange={() => setFilters({ ...filters, isReversed: true })}
                          />
                          <span>Reversed Only</span>
                        </label>
                      </div>
                    </div>

                    <div className="flex justify-end space-x-2 pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setFilters({
                            dateRange: {
                              from: startOfYear(new Date()),
                              to: new Date(),
                            },
                          })
                          setSearchTerm("")
                          setShowFilters(false)
                        }}
                      >
                        Reset
                      </Button>
                      <Button size="sm" onClick={() => setShowFilters(false)}>
                        Apply
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <Button onClick={handleExportPDF}>
              <FileDown className="h-4 w-4 mr-2" />
              Export PDF
            </Button>

            <Button onClick={() => setShowAddForm(true)} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Expense
            </Button>
          </div>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-lg">Expense Records</CardTitle>
              <CardDescription>
                {filteredExpenses.length} {filteredExpenses.length === 1 ? "record" : "records"} found
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="w-[100px]">Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="h-24 text-center">
                        No expenses found. Try adjusting your filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredExpenses.map((expense) => (
                      <TableRow key={expense.id} className={expense.isReversed ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{format(new Date(expense.date), "MMM d, yyyy")}</TableCell>
                        <TableCell>
                          <div className="font-medium">{expense.purpose}</div>
                          {expense.notes && <p className="text-sm text-gray-500 line-clamp-1">{expense.notes}</p>}
                          {expense.isReversed && expense.reversalReason && (
                            <div className="flex items-center text-xs text-red-500 mt-1">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Reversed: {expense.reversalReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {categories.find((c) => c.id === expense.category)?.name || "Uncategorized"}
                          </span>
                          {expense.receiptNumber && (
                            <div className="text-xs text-gray-500 mt-1">Receipt: {expense.receiptNumber}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={expense.isReversed ? "line-through text-gray-400" : ""}>
                            ${expense.amount.toFixed(2)}
                          </span>
                          {expense.isReversed && <div className="text-red-500">-${expense.amount.toFixed(2)}</div>}
                        </TableCell>
                        <TableCell>
                          {expense.isReversed ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              Reversed
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {!expense.isReversed && (
                            <div className="relative">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setReversingExpense(expense.id)}
                                type="button"
                              >
                                <Undo2 className="h-4 w-4" />
                                <span className="sr-only">Reverse</span>
                              </Button>
                              {reversingExpense === expense.id && (
                                <div className="absolute z-10 right-0 mt-1 w-80 bg-white border rounded-md shadow-lg p-4">
                                  <h4 className="font-medium mb-2">Reverse Transaction</h4>
                                  <p className="text-sm text-gray-600 mb-4">
                                    Are you sure you want to reverse this transaction? This action cannot be undone.
                                  </p>
                                  <div className="space-y-3">
                                    <div>
                                      <Label htmlFor={`reversalReason-${expense.id}`}>Reason for Reversal</Label>
                                      <Input
                                        id={`reversalReason-${expense.id}`}
                                        placeholder="Enter reason"
                                        className="mt-1"
                                        value={reversalReason}
                                        onChange={(e) => setReversalReason(e.target.value)}
                                      />
                                    </div>
                                    <div className="flex justify-end space-x-2 pt-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          setReversingExpense(null)
                                          setReversalReason("")
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => {
                                          handleReverseExpense(expense.id, reversalReason || "No reason provided")
                                          setReversingExpense(null)
                                          setReversalReason("")
                                        }}
                                      >
                                        Confirm Reversal
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </Tabs>

      {/* Add Expense Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle>Add New Expense</CardTitle>
              <CardDescription>Fill in the details below to record a new expense.</CardDescription>
            </CardHeader>
            <form onSubmit={handleAddExpense}>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="purpose">Purpose *</Label>
                    <Input
                      id="purpose"
                      placeholder="e.g. Office supplies, Rent, etc."
                      value={newExpense.purpose}
                      onChange={(e) => setNewExpense({ ...newExpense, purpose: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="amount">Amount ({settings.currency}) *</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={newExpense.amount || ""}
                      onChange={(e) => setNewExpense({ ...newExpense, amount: Number.parseFloat(e.target.value) || 0 })}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Date *</Label>
                    <Input
                      id="date"
                      type="date"
                      value={newExpense.date}
                      onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="category">Category *</Label>
                    <select
                      id="category"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                      value={newExpense.category}
                      onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                      required
                    >
                      <option value="">Select a category</option>
                      {categories
                        .filter((category) => category.isActive)
                        .map((category) => (
                          <option key={category.id} value={category.id}>
                            {category.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiptNumber">Receipt # (Optional)</Label>
                  <Input
                    id="receiptNumber"
                    placeholder="e.g. INV-1234"
                    value={newExpense.receiptNumber || ""}
                    onChange={(e) => setNewExpense({ ...newExpense, receiptNumber: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <textarea
                    id="notes"
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
                    placeholder="Any additional details about this expense..."
                    value={newExpense.notes || ""}
                    onChange={(e) => setNewExpense({ ...newExpense, notes: e.target.value })}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!newExpense.purpose || !newExpense.amount || !newExpense.category || !newExpense.date}
                >
                  Add Expense
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>
      )}
    </div>
  )
}

export default ExpensesPage
