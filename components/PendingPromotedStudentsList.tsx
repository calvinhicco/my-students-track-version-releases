"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { PendingPromotedStudent, AppSettings } from "../types/index"
import { PromotionManager } from "../lib/promotionUtils"
import { ArrowLeft, Edit, Save, X, RotateCcw, Trash2, Users, GraduationCap, Download } from "lucide-react"

interface PendingPromotedStudentsListProps {
  onBack: () => void
  settings: AppSettings
}

export default function PendingPromotedStudentsList({ onBack, settings }: PendingPromotedStudentsListProps) {
  const [pendingStudents, setPendingStudents] = useState<PendingPromotedStudent[]>([])
  const [editingStudent, setEditingStudent] = useState<string | null>(null)
  const [editData, setEditData] = useState<Partial<PendingPromotedStudent>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedStudents, setSelectedStudents] = useState<string[]>([])
  const [bulkAction, setBulkAction] = useState<string>("")

  const promotionManager = new PromotionManager(settings)

  useEffect(() => {
    loadPendingStudents()
  }, [])

  const loadPendingStudents = () => {
    setIsLoading(true)
    try {
      const students = promotionManager.getPendingPromotedStudents()
      setPendingStudents(students)
    } catch (error) {
      console.error("Error loading pending students:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredStudents = pendingStudents.filter(
    (student) =>
      student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.parentContact.includes(searchTerm) ||
      student.fromClass.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.toClass.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const ecdBStudents = filteredStudents.filter((s) => s.promotionType === "ECD_B_TO_GRADE_1")
  const otherStudents = filteredStudents.filter((s) => s.promotionType !== "ECD_B_TO_GRADE_1")

  const handleEdit = (student: PendingPromotedStudent) => {
    setEditingStudent(student.id)
    setEditData({
      fullName: student.fullName,
      parentContact: student.parentContact,
      address: student.address,
      notes: student.notes || "",
      toClass: student.toClass,
      className: student.className,
    })
  }

  const handleSaveEdit = async () => {
    if (!editingStudent) return

    try {
      const result = promotionManager.restorePendingStudent(editingStudent, editData)
      if (result.success) {
        alert(result.message)
        loadPendingStudents()
        setEditingStudent(null)
        setEditData({})
      } else {
        alert(`Error: ${result.message}`)
      }
    } catch (error) {
      alert("Error saving changes")
      console.error(error)
    }
  }

  const handleCancelEdit = () => {
    setEditingStudent(null)
    setEditData({})
  }

  const handleRestore = async (studentId: string) => {
    if (!confirm("Are you sure you want to restore this student to the main system?")) return

    try {
      const result = promotionManager.restorePendingStudent(studentId)
      if (result.success) {
        alert(result.message)
        loadPendingStudents()
      } else {
        alert(`Error: ${result.message}`)
      }
    } catch (error) {
      alert("Error restoring student")
      console.error(error)
    }
  }

  const handleDelete = async (studentId: string) => {
    if (!confirm("Are you sure you want to permanently delete this student? This action cannot be undone.")) return

    try {
      const result = promotionManager.deletePendingStudent(studentId)
      if (result.success) {
        alert(result.message)
        loadPendingStudents()
      } else {
        alert(`Error: ${result.message}`)
      }
    } catch (error) {
      alert("Error deleting student")
      console.error(error)
    }
  }

  const handleBulkRestore = async () => {
    if (selectedStudents.length === 0) {
      alert("Please select students to restore")
      return
    }

    if (!confirm(`Are you sure you want to restore ${selectedStudents.length} selected students?`)) return

    let successCount = 0
    let errorCount = 0

    for (const studentId of selectedStudents) {
      try {
        const result = promotionManager.restorePendingStudent(studentId, { className: "Grade 1" })
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        errorCount++
      }
    }

    alert(`Bulk restore completed: ${successCount} successful, ${errorCount} errors`)
    loadPendingStudents()
    setSelectedStudents([])
  }

  const handleBulkDelete = async () => {
    if (selectedStudents.length === 0) {
      alert("Please select students to delete")
      return
    }

    if (
      !confirm(
        `Are you sure you want to permanently delete ${selectedStudents.length} selected students? This action cannot be undone.`,
      )
    )
      return

    let successCount = 0
    let errorCount = 0

    for (const studentId of selectedStudents) {
      try {
        const result = promotionManager.deletePendingStudent(studentId)
        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        errorCount++
      }
    }

    alert(`Bulk delete completed: ${successCount} successful, ${errorCount} errors`)
    loadPendingStudents()
    setSelectedStudents([])
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudents(filteredStudents.map((s) => s.id))
    } else {
      setSelectedStudents([])
    }
  }

  const handleSelectStudent = (studentId: string, checked: boolean) => {
    if (checked) {
      setSelectedStudents((prev) => [...prev, studentId])
    } else {
      setSelectedStudents((prev) => prev.filter((id) => id !== studentId))
    }
  }

  const exportPendingList = () => {
    const csvContent = [
      ["Student Name", "From Class", "To Class", "Promotion Date", "Parent Contact", "Address", "Notes"],
      ...filteredStudents.map((student) => [
        student.fullName,
        student.fromClass,
        student.toClass,
        new Date(student.promotionDate).toLocaleDateString(),
        student.parentContact,
        student.address,
        student.notes || "",
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n")

    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `pending-promoted-students-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600">Loading pending promoted students...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-purple-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Button onClick={onBack} variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-purple-800">ECD B to Grade 1 - Pending List</h1>
              <p className="text-sm text-gray-600">
                Students automatically promoted from ECD B, pending final processing
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={exportPendingList} variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export List
            </Button>
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-purple-600" />
              <span className="text-lg font-semibold text-purple-800">{pendingStudents.length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {pendingStudents.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <GraduationCap className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-600 mb-2">No Pending Promoted Students</h3>
              <p className="text-gray-500">
                ECD B students will automatically appear here when promoted on January 1st each year.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Search and Bulk Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="text-purple-800">Manage Pending Students</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Input
                      placeholder="Search by name, contact, or class..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="selectAll"
                      checked={selectedStudents.length === filteredStudents.length && filteredStudents.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                    <Label htmlFor="selectAll">Select All</Label>
                  </div>
                </div>

                {selectedStudents.length > 0 && (
                  <div className="flex items-center gap-4 p-3 bg-blue-50 rounded-lg">
                    <span className="text-sm text-blue-800">{selectedStudents.length} students selected</span>
                    <Button onClick={handleBulkRestore} size="sm" className="bg-green-600 hover:bg-green-700">
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Bulk Restore to Grade 1
                    </Button>
                    <Button
                      onClick={handleBulkDelete}
                      size="sm"
                      variant="outline"
                      className="text-red-600 border-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Bulk Delete
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Summary Card */}
            <Card>
              <CardHeader>
                <CardTitle className="text-purple-800">Promotion Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-purple-600">{pendingStudents.length}</p>
                    <p className="text-sm text-gray-600">Total Pending</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{ecdBStudents.length}</p>
                    <p className="text-sm text-gray-600">ECD B → Grade 1</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-blue-600">{otherStudents.length}</p>
                    <p className="text-sm text-gray-600">Other Promotions</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {pendingStudents.filter((s) => s.canBeRestored).length}
                    </p>
                    <p className="text-sm text-gray-600">Can Be Restored</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ECD B Students Section */}
            {ecdBStudents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-800 flex items-center gap-2">
                    <GraduationCap className="w-5 h-5" />
                    ECD B to Grade 1 Promotions ({ecdBStudents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {ecdBStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        isEditing={editingStudent === student.id}
                        editData={editData}
                        onEdit={handleEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onEditDataChange={setEditData}
                        isSelected={selectedStudents.includes(student.id)}
                        onSelect={(checked) => handleSelectStudent(student.id, checked)}
                        settings={settings}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Other Promotions Section */}
            {otherStudents.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-800 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Other Pending Promotions ({otherStudents.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {otherStudents.map((student) => (
                      <StudentCard
                        key={student.id}
                        student={student}
                        isEditing={editingStudent === student.id}
                        editData={editData}
                        onEdit={handleEdit}
                        onSave={handleSaveEdit}
                        onCancel={handleCancelEdit}
                        onRestore={handleRestore}
                        onDelete={handleDelete}
                        onEditDataChange={setEditData}
                        isSelected={selectedStudents.includes(student.id)}
                        onSelect={(checked) => handleSelectStudent(student.id, checked)}
                        settings={settings}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Student Card Component
interface StudentCardProps {
  student: PendingPromotedStudent
  isEditing: boolean
  editData: Partial<PendingPromotedStudent>
  onEdit: (student: PendingPromotedStudent) => void
  onSave: () => void
  onCancel: () => void
  onRestore: (studentId: string) => void
  onDelete: (studentId: string) => void
  onEditDataChange: (data: Partial<PendingPromotedStudent>) => void
  isSelected: boolean
  onSelect: (checked: boolean) => void
  settings: AppSettings
}

function StudentCard({
  student,
  isEditing,
  editData,
  onEdit,
  onSave,
  onCancel,
  onRestore,
  onDelete,
  onEditDataChange,
  isSelected,
  onSelect,
  settings,
}: StudentCardProps) {
  const availableClasses = settings.classGroups.filter((group) => group.enabled).flatMap((group) => group.classes)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        {isEditing ? (
          // Edit Mode
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-purple-800">Editing: {student.fullName}</h3>
              <div className="flex gap-2">
                <Button onClick={onSave} size="sm" className="bg-green-600 hover:bg-green-700">
                  <Save className="w-4 h-4 mr-2" />
                  Save & Restore
                </Button>
                <Button onClick={onCancel} variant="outline" size="sm">
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  value={editData.fullName || ""}
                  onChange={(e) => onEditDataChange({ ...editData, fullName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="parentContact">Parent Contact</Label>
                <Input
                  id="parentContact"
                  value={editData.parentContact || ""}
                  onChange={(e) => onEditDataChange({ ...editData, parentContact: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={editData.address || ""}
                  onChange={(e) => onEditDataChange({ ...editData, address: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="toClass">Promoted To Class</Label>
                <Select
                  value={editData.toClass || ""}
                  onValueChange={(value) => onEditDataChange({ ...editData, toClass: value, className: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select class" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((className) => (
                      <SelectItem key={className} value={className}>
                        {className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={editData.notes || ""}
                  onChange={(e) => onEditDataChange({ ...editData, notes: e.target.value })}
                  rows={3}
                />
              </div>
            </div>
          </div>
        ) : (
          // View Mode
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onSelect(e.target.checked)}
                  className="w-4 h-4"
                />
                <h3 className="text-lg font-semibold text-gray-900">{student.fullName}</h3>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {student.fromClass} → {student.toClass}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    student.promotionType === "ECD_B_TO_GRADE_1"
                      ? "bg-green-50 text-green-700"
                      : "bg-purple-50 text-purple-700"
                  }
                >
                  {student.promotionType.replace(/_/g, " ")}
                </Badge>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => onEdit(student)} variant="outline" size="sm">
                  <Edit className="w-4 h-4 mr-2" />
                  Edit
                </Button>
                <Button
                  onClick={() => onRestore(student.id)}
                  variant="outline"
                  size="sm"
                  className="text-green-600 border-green-600 hover:bg-green-50"
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore
                </Button>
                <Button
                  onClick={() => onDelete(student.id)}
                  variant="outline"
                  size="sm"
                  className="text-red-600 border-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Student ID</p>
                <p className="font-medium">{student.id}</p>
              </div>
              <div>
                <p className="text-gray-600">Parent Contact</p>
                <p className="font-medium">{student.parentContact}</p>
              </div>
              <div>
                <p className="text-gray-600">Promotion Date</p>
                <p className="font-medium">{new Date(student.promotionDate).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Address</p>
                <p className="font-medium">{student.address}</p>
              </div>
              <div>
                <p className="text-gray-600">Date of Birth</p>
                <p className="font-medium">{new Date(student.dateOfBirth).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-gray-600">Academic Year</p>
                <p className="font-medium">{student.academicYear}</p>
              </div>
            </div>

            {student.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-gray-600 text-sm">Notes:</p>
                <p className="text-gray-800">{student.notes}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
