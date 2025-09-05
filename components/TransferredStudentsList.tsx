"use client"

import { useState, useMemo } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import type { TransferredStudent } from "../types/index"
import { Search, UserX, Calendar, FileText, Trash2, Download, Filter, Users, Clock, Loader2 } from "lucide-react"
import { exportTransferredStudentsToPDF } from "@/lib/pdfUtils"
import { format } from 'date-fns'

const safeDate = (dateString?: string): Date => {
  return dateString ? new Date(dateString) : new Date();
};

interface TransferredStudentsListProps {
  students: TransferredStudent[]
  onDeleteStudent: (studentId: string) => void
}

export default function TransferredStudentsList({ students, onDeleteStudent }: TransferredStudentsListProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [showFilters, setShowFilters] = useState(false)
  const [transferReasonFilter, setTransferReasonFilter] = useState("all")
  const [yearFilter, setYearFilter] = useState("all")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const matchesSearch =
        searchTerm === "" ||
        student.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.parentContact.includes(searchTerm) ||
        student.originalClassName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.transferReason.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.id.includes(searchTerm)

      const matchesReason =
        transferReasonFilter === "all" ||
        student.transferReason.toLowerCase().includes(transferReasonFilter.toLowerCase())

      const transferYear = safeDate(student.transferDate).getFullYear().toString();
      
      const matchesYear = yearFilter === "all" || transferYear === yearFilter

      return matchesSearch && matchesReason && matchesYear
    })
  }, [students, searchTerm, transferReasonFilter, yearFilter])

  const transferReasons = useMemo(() => {
    const reasons = Array.from(new Set(students.map((s) => s.transferReason)))
    return reasons.sort()
  }, [students])

  const transferYears = useMemo(() => {
    const years = Array.from(new Set(students.map((s) => safeDate(s.transferDate).getFullYear().toString())))
    return years.sort((a, b) => Number.parseInt(b) - Number.parseInt(a))
  }, [students])

  const handleDeleteStudent = (studentId: string, studentName: string) => {
    if (showDeleteConfirm === studentId) {
      onDeleteStudent(studentId)
      setShowDeleteConfirm(null)
    } else {
      setShowDeleteConfirm(studentId)
    }
  }

  const handleExportTransferredStudents = async () => {
    if (filteredStudents.length === 0) return;
    
    setIsExporting(true);
    try {
      await exportTransferredStudentsToPDF(
        filteredStudents.map(student => ({
          id: student.id,
          fullName: student.fullName,
          gender: student.gender,
          parentContact: student.parentContact,
          originalClassName: student.originalClassName,
          transferDate: student.transferDate || new Date().toISOString(),
          transferReason: student.transferReason,
          newSchool: student.newSchool || 'Not specified',
          notes: student.notes
        })),
        `Filtered (${filteredStudents.length} students)`
      );
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchTerm("")
    setTransferReasonFilter("all")
    setYearFilter("all")
    setShowFilters(false)
  }

  const hasActiveFilters = searchTerm !== "" || transferReasonFilter !== "all" || yearFilter !== "all"

  return (
    <Card className="max-w-6xl mx-auto">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-purple-800 flex items-center gap-2">
              <UserX className="w-5 h-5" />
              Transferred Students ({students.length})
            </CardTitle>
            <p className="text-sm text-gray-600 mt-1">
              Students who have been transferred out of active enrollment. Records are kept for 5 years and then
              automatically archived.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportTransferredStudents}
              variant="outline"
              size="sm"
              className="text-green-600 border-green-600 hover:bg-green-50"
              disabled={students.length === 0 || isExporting}
            >
              {isExporting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Exporting...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Export PDF
                </>
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search by name, phone, class, transfer reason, or student ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className={`${showFilters ? "bg-purple-50 border-purple-300" : ""}`}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filters
            </Button>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="text-red-600 border-red-300">
                Clear All
              </Button>
            )}
          </div>

          {showFilters && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Filter className="w-4 h-4" />
                Filter Transferred Students
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-600">Transfer Reason</Label>
                  <Select value={transferReasonFilter} onValueChange={setTransferReasonFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Reasons</SelectItem>
                      {transferReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>
                          {reason}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs text-gray-600">Transfer Year</Label>
                  <Select value={yearFilter} onValueChange={setYearFilter}>
                    <SelectTrigger className="mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Years</SelectItem>
                      {transferYears.map((year) => (
                        <SelectItem key={year} value={year}>
                          {year}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-3 text-xs text-gray-600">
                  Showing {filteredStudents.length} of {students.length} transferred students
                </div>
              )}
            </div>
          )}
        </div>

        {/* Students List */}
        <div className="space-y-4">
          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <UserX className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">
                {students.length === 0
                  ? "No transferred students yet."
                  : hasActiveFilters
                    ? "No transferred students found matching your filters."
                    : "No transferred students found matching your search."}
              </p>
              {hasActiveFilters && (
                <Button onClick={clearFilters} variant="outline" className="mt-4">
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            filteredStudents
              .sort((a, b) => safeDate(b.transferDate).getTime() - safeDate(a.transferDate).getTime())
              .map((student) => (
                <div key={student.id} className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
                  <div className="flex items-center gap-4">
                    <div className="w-3 h-3 rounded-full bg-gray-400"></div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{student.fullName}</h3>
                      <p className="text-sm text-gray-600">{student.parentContact}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500 mt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          Transferred: {safeDate(student.transferDate).toLocaleDateString()}
                        </span>
                        <span>Original Class: {student.originalClassName}</span>
                        <span>ID: {student.id}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                        <FileText className="w-3 h-3" />
                        <span>Reason: {student.transferReason}</span>
                      </div>
                      {student.hasTransport && (
                        <div className="text-xs text-orange-600 mt-1">
                          Had Transport Service (${student.transportFee}/month) - Billing Frozen
                        </div>
                      )}
                      {student.notes && (
                        <div className="text-xs text-gray-500 italic mt-1">
                          Note: {student.notes.length > 100 ? student.notes.substring(0, 100) + "..." : student.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Badge variant="secondary" className="bg-gray-200 text-gray-700">
                        Transferred
                      </Badge>
                      <p className="text-xs text-gray-600 mt-1">Billing Frozen</p>
                      <p className="text-xs text-gray-500">Academic Year: {student.academicYear || "N/A"}</p>
                    </div>

                    <Button
                      onClick={() => handleDeleteStudent(student.id, student.fullName)}
                      variant="outline"
                      size="sm"
                      className={`${
                        showDeleteConfirm === student.id
                          ? "text-red-600 border-red-600 hover:bg-red-50"
                          : "text-gray-600 border-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {showDeleteConfirm === student.id ? (
                        <>
                          <Trash2 className="w-4 h-4 mr-1" />
                          Confirm Delete
                        </>
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                    {showDeleteConfirm === student.id && (
                      <Button
                        onClick={() => setShowDeleteConfirm(null)}
                        variant="outline"
                        size="sm"
                        className="text-gray-600"
                      >
                        Cancel
                      </Button>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Summary */}
        {students.length > 0 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Transfer Summary
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-700">
              <div>
                <p className="font-medium">Total Transferred: {students.length}</p>
                <p>Currently Showing: {filteredStudents.length}</p>
              </div>
              <div>
                <p className="font-medium">Most Recent Transfer:</p>
                <p>
                  {students.length > 0
                    ? safeDate(students[0].transferDate).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                <div>
                  <p className="font-medium">Data Retention:</p>
                  <p>Records kept for 5 years</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
