"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Plus, ArrowLeft, FileText, Trash2 } from "lucide-react"
import type { ExtraBillingPageType, ExtraBillingEntry } from "./ExtraBillingPage" // Adjust path if necessary

interface ExtraBillingOverviewPageProps {
  pages: ExtraBillingPageType[]
  onAddPage: (name: string) => void
  onSelectPage: (id: string) => void
  onDeletePage: (id: string) => void
  onBack: () => void
}

const ExtraBillingOverviewPage: React.FC<ExtraBillingOverviewPageProps> = ({
  pages,
  onAddPage,
  onSelectPage,
  onDeletePage,
  onBack,
}) => {
  const [showAddPageModal, setShowAddPageModal] = useState(false)
  const [newPageName, setNewPageName] = useState("")

  const handleConfirmAddPage = () => {
    if (newPageName.trim()) {
      onAddPage(newPageName.trim())
      setNewPageName("")
      setShowAddPageModal(false)
    }
  }

  const handleDeletePage = (id: string, name: string) => {
    if (confirm(`Are you sure you want to delete the billing page "${name}"? This action is irreversible.`)) {
      onDeletePage(id)
    }
  }

  return (
    <div className="min-h-screen bg-purple-50 p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="outline" onClick={onBack} className="flex items-center gap-1 bg-transparent">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-purple-800">Extra Billing Pages</h1>
      </div>

      <Button onClick={() => setShowAddPageModal(true)} className="mb-6 flex items-center gap-1">
        <Plus className="w-4 h-4" /> Create New Billing Page
      </Button>

      {pages.length === 0 ? (
        <Card className="p-6 text-center text-gray-600">
          <p>No extra billing pages created yet. Click "Create New Billing Page" to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map((page) => (
            <Card key={page.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">{page.name}</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Created: {new Date(page.createdAt).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-between">
                <div className="text-sm text-gray-700 mb-4">
                  Total Entries: {page.entries.length}
                  <br />
                  Total Collected: $
                  {page.entries
                    .reduce(
                      (sum: number, entry: ExtraBillingEntry) =>
                        sum +
                        entry.payments.reduce((pSum: number, p: { amount: number }) => pSum + p.amount, 0),
                      0,
                    )
                    .toFixed(2)}
                </div>
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" onClick={() => onSelectPage(page.id)} className="flex-1">
                    <FileText className="w-4 h-4 mr-2" /> Open
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDeletePage(page.id, page.name)}
                    className="flex-1"
                  >
                    <Trash2 className="w-4 h-4 mr-2" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add New Page Modal */}
      {showAddPageModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-purple-800">Create New Billing Page</h3>
            <Input
              placeholder="Enter page name (e.g., 'School Trip 2024', 'Uniform Sales')"
              value={newPageName}
              onChange={(e) => setNewPageName(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowAddPageModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmAddPage} disabled={!newPageName.trim()}>
                Create Page
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExtraBillingOverviewPage
