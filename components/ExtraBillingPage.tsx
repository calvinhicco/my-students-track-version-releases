"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Button } from "./ui/button"
import { Card, CardHeader, CardTitle } from "./ui/card"
import { Plus, ArrowLeft, FileText, Trash2, RefreshCw } from "lucide-react"
import { Input } from "./ui/input" // Assuming Input is from shadcn/ui
// PDF generation utilities
import { exportExtraBillingToPDF } from "@/lib/pdfUtils"



export type ExtraBillingEntry = {
  id: string
  studentName: string
  purpose: string
  payments: { amount: number; date: string }[]
  deleted?: boolean
  deletedDate?: string
}

export type ExtraBillingPageType = {
  id: string
  name: string
  entries: ExtraBillingEntry[]
  createdAt: string
}

interface ExtraBillingPageProps {
  page: ExtraBillingPageType
  onUpdate: (page: ExtraBillingPageType) => void
  onDelete: (id: string) => void
  onBack: () => void
}

const ExtraBillingPage: React.FC<ExtraBillingPageProps> = ({ page, onUpdate, onDelete, onBack }) => {
  const [localPage, setLocalPage] = useState<ExtraBillingPageType>(page)
  const [dateRange, setDateRange] = useState({
    from: new Date(),
    to: new Date(),
  })
  const pageRef = useRef<HTMLDivElement>(null)

  // Modal state for adding entry
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [entryStudentName, setEntryStudentName] = useState("")
  const [entryPurpose, setEntryPurpose] = useState("")
  const [entryAmount, setEntryAmount] = useState("")
  // Search state
  const [search, setSearch] = useState("")
  const openAddEntryModal = () => {
    setEntryStudentName("")
    setEntryPurpose("")
    setEntryAmount("")
    setShowAddEntryModal(true)
  }
  const confirmAddEntry = () => {
    const amount = Number.parseFloat(entryAmount)
    if (!entryStudentName.trim() || isNaN(amount)) return
    const newEntry: ExtraBillingEntry = {
      id: Date.now().toString(),
      studentName: entryStudentName.trim(),
      purpose: entryPurpose.trim() || "—",
      payments: [{ amount, date: new Date().toISOString() }],
    }
    const updated = { ...localPage, entries: [...localPage.entries, newEntry] }
    setLocalPage(updated)
    onUpdate(updated)
    setShowAddEntryModal(false)
  }

  // Modal state for adding payment
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [paymentEntryId, setPaymentEntryId] = useState<string | null>(null)
  const [paymentAmount, setPaymentAmount] = useState("")
  const openPaymentModal = (entryId: string) => {
    setPaymentEntryId(entryId)
    setPaymentAmount("")
    setShowPaymentModal(true)
  }
  const confirmAddPayment = () => {
    const amount = Number.parseFloat(paymentAmount)
    if (!paymentEntryId || isNaN(amount)) return
    const updatedEntries = localPage.entries.map((e) =>
      e.id === paymentEntryId ? { ...e, payments: [...e.payments, { amount, date: new Date().toISOString() }] } : e,
    )
    const updated = { ...localPage, entries: updatedEntries }
    setLocalPage(updated)
    onUpdate(updated)
    setShowPaymentModal(false)
  }

  const handleExportPdf = async () => {
    try {
      await exportExtraBillingToPDF(localPage, dateRange)
    } catch (error) {
      console.error("Failed to generate PDF:", error)
      alert("Failed to generate PDF. Please try again.")
    }
  }

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this billing page? This action is irreversible.")) {
      onDelete(localPage.id)
    }
  }

  const handleDeleteEntry = (entryId: string) => {
    if (confirm("Are you sure you want to delete/refund this entry? It will be marked as deleted but remain visible.")) {
      const updatedEntries = localPage.entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, deleted: true, deletedDate: new Date().toISOString() }
          : entry
      )
      const updated = { ...localPage, entries: updatedEntries }
      setLocalPage(updated)
      onUpdate(updated)
    }
  }

  const handleRestoreEntry = (entryId: string) => {
    if (confirm("Are you sure you want to restore this entry?")) {
      const updatedEntries = localPage.entries.map((entry) =>
        entry.id === entryId
          ? { ...entry, deleted: false, deletedDate: undefined }
          : entry
      )
      const updated = { ...localPage, entries: updatedEntries }
      setLocalPage(updated)
      onUpdate(updated)
    }
  }

  return (
    <div className="p-4" ref={pageRef}>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-1 bg-transparent">
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>{localPage.name}</CardTitle>
          </CardHeader>
        </Card>
        <Button variant="outline" onClick={handleExportPdf} className="flex items-center gap-1 bg-transparent">
          <FileText className="w-4 h-4" /> Export PDF
        </Button>
        <Button variant="destructive" onClick={handleDelete} className="flex items-center gap-1">
          <Trash2 className="w-4 h-4" /> Delete Page
        </Button>
      </div>

      <Button onClick={openAddEntryModal} className="mb-3 flex items-center gap-1">
        <Plus className="w-4 h-4" /> Add Student
      </Button>

      <input
        type="text"
        className="mb-3 w-full md:w-1/3 border rounded p-2"
        placeholder="Search by student name"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b">
            <th className="p-2 text-left">Student Name</th>
            <th className="p-2 text-left">Purpose</th>
            <th className="p-2 text-left">Amount Paid (with Date)</th>
            <th className="p-2 text-left">Status</th>
            <th className="p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {localPage.entries
            .filter((e) => e.studentName.toLowerCase().includes(search.toLowerCase()))
            .map((entry) => (
              <tr key={entry.id} className={`border-b align-top ${
                entry.deleted ? 'opacity-50 bg-gray-100' : ''
              }`}>
                <td className={`p-2 ${
                  entry.deleted ? 'text-gray-500 line-through' : ''
                }`}>{entry.studentName}</td>
                <td className={`p-2 ${
                  entry.deleted ? 'text-gray-500 line-through' : ''
                }`}>{entry.purpose}</td>
                <td className={`p-2 ${
                  entry.deleted ? 'text-gray-500 line-through' : ''
                }`}>
                  {entry.payments.map((p, idx) => (
                    <div key={idx}>
                      ${p.amount.toFixed(2)} ({new Date(p.date).toLocaleDateString()})
                    </div>
                  ))}
                </td>
                <td className="p-2">
                  {entry.deleted ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                      DELETED
                    </span>
                  ) : (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                      ACTIVE
                    </span>
                  )}
                  {entry.deleted && entry.deletedDate && (
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(entry.deletedDate).toLocaleDateString()}
                    </div>
                  )}
                </td>
                <td className="p-2">
                  <div className="flex gap-1">
                    {!entry.deleted && (
                      <Button size="sm" variant="outline" onClick={() => openPaymentModal(entry.id)}>
                        +
                      </Button>
                    )}
                    {entry.deleted ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleRestoreEntry(entry.id)}
                        className="text-green-600 border-green-600 hover:bg-green-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </Button>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleDeleteEntry(entry.id)}
                        className="text-red-600 border-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
        </tbody>
      </table>

      {/* Add Entry Modal */}
      {showAddEntryModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-purple-800">Add Student Payment</h3>
            <Input
              className="w-full border rounded p-2"
              placeholder="Student name"
              value={entryStudentName}
              onChange={(e) => setEntryStudentName(e.target.value)}
            />
            <Input
              className="w-full border rounded p-2"
              placeholder="Purpose"
              value={entryPurpose}
              onChange={(e) => setEntryPurpose(e.target.value)}
            />
            <Input
              type="number"
              className="w-full border rounded p-2"
              placeholder="Amount"
              value={entryAmount}
              onChange={(e) => setEntryAmount(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddEntryModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmAddEntry} disabled={!entryStudentName.trim() || !entryAmount}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-purple-800">Add Payment</h3>
            <Input
              type="number"
              className="w-full border rounded p-2"
              placeholder="Amount"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button onClick={confirmAddPayment} disabled={!paymentAmount}>
                Add
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExtraBillingPage
