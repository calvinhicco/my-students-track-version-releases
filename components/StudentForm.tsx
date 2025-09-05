"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { Checkbox } from "./ui/checkbox"
import type { Student, AppSettings, Gender } from "../types/index"
import { getCurrentAcademicYear } from "../lib/academicUtils"
import { getCurrentDate } from "../lib/dateUtils"
import { initializeTransportPayments } from "../lib/transportUtils"
import { User, Phone, GraduationCap, Car, FileText, Save, X, DollarSign } from "lucide-react"

interface StudentFormProps {
  onSubmit: (student: Omit<Student, "id" | "academicYear" | "feePayments" | "totalPaid" | "totalOwed">) => void
  settings: AppSettings
  initialData?: Partial<Student>
  isEditing?: boolean
  onCancel?: () => void
}

export default function StudentForm({
  onSubmit,
  settings,
  initialData,
  isEditing = false,
  onCancel,
}: StudentFormProps): JSX.Element {
  const [formData, setFormData] = useState<Omit<Student, "id" | "academicYear" | "feePayments" | "totalPaid" | "totalOwed">>({
    fullName: initialData?.fullName || "",
    gender: (initialData?.gender as Gender) || ("" as Gender),
    dateOfBirth: initialData?.dateOfBirth || "",
    parentContact: initialData?.parentContact || "",
    address: initialData?.address || "",
    admissionDate: initialData?.admissionDate || getCurrentDate(),
    classGroup: initialData?.classGroup || "",
    className: initialData?.className || "",
    hasTransport: initialData?.hasTransport || false,
    transportFee: initialData?.transportFee ?? 0,
    transportActivationDate: initialData?.transportActivationDate || "",
    notes: initialData?.notes || "",
    hasCustomFees: initialData?.hasCustomFees || false,
    customSchoolFee: initialData?.customSchoolFee || 0,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Auto-populate className when classGroup changes
  useEffect(() => {
    if (formData.classGroup && Array.isArray(settings.classGroups)) {
      const selectedGroup = settings.classGroups.find((g) => g.id === formData.classGroup)
      if (selectedGroup) {
        setFormData((prev) => ({
          ...prev,
          className: selectedGroup.name,
        }))
      }
    }
  }, [formData.classGroup, settings.classGroups])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.fullName.trim()) {
      newErrors.fullName = "Full name is required"
    }

    if (!formData.dateOfBirth) {
      newErrors.dateOfBirth = "Date of birth is required"
    } else {
      const birthDate = new Date(formData.dateOfBirth)
      const today = new Date()
      if (birthDate >= today) {
        newErrors.dateOfBirth = "Date of birth must be in the past"
      }
    }

    if (!formData.parentContact.trim()) {
      newErrors.parentContact = "Parent contact is required"
    }

    if (!formData.address.trim()) {
      newErrors.address = "Address is required"
    }

    if (!formData.admissionDate) {
      newErrors.admissionDate = "Admission date is required"
    }

    if (!formData.classGroup) {
      newErrors.classGroup = "Class group is required"
    }

    if (!formData.className.trim()) {
      newErrors.className = "Class name is required"
    }

    if (formData.hasTransport) {
      if (!formData.transportFee || formData.transportFee <= 0) {
        newErrors.transportFee = "Transport fee must be greater than 0"
      }
      if (!formData.transportActivationDate) {
        newErrors.transportActivationDate = "Transport activation date is required when transport is enabled"
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)

    try {
      const transportFee = formData.hasTransport ? Number(formData.transportFee) : 0;
      const transportActivationDate = formData.hasTransport ? (formData.transportActivationDate || getCurrentDate()) : "";
      
      const studentData = {
        ...formData,
        transportFee,
        transportActivationDate,
        transportPayments: formData.hasTransport 
          ? initializeTransportPayments(
              { ...formData, transportFee, id: initialData?.id || "", transportActivationDate } as Student,
              transportFee,
              transportActivationDate,
              settings,
            )
          : [],
      }

      console.log("🚌 Submitting student with transport data:", {
        hasTransport: studentData.hasTransport,
        transportFee: studentData.transportFee,
        transportPayments: studentData.transportPayments?.length || 0,
      })

      onSubmit(studentData)
    } catch (error) {
      console.error("Error submitting form:", error)
      setErrors({ submit: "Failed to save student. Please try again." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: "",
      }))
    }
  }

  const handleTransportFeeChange = (value: string) => {
    // Allow empty string and valid numbers
    if (value === "" || (!isNaN(Number(value)) && Number(value) >= 0)) {
      handleInputChange("transportFee", value === "" ? 0 : Number(value))
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <User className="w-5 h-5" />
            {isEditing ? "Edit Student Information" : "Add New Student"}
          </CardTitle>
          <CardDescription>
            {isEditing
              ? "Update the student's information below"
              : `Enter the student's information for Academic Year ${getCurrentAcademicYear()}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-800 text-sm">{errors.submit}</p>
              </div>
            )}

            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </h3>

              <div className="grid gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name *</Label>
                    <Input
                      id="fullName"
                      placeholder="Enter full name"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange("fullName", e.target.value)}
                      required
                    />
                    {errors.fullName && <p className="text-sm text-red-500">{errors.fullName}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) => handleInputChange("gender", value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select gender" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Male">Male</SelectItem>
                        <SelectItem value="Female">Female</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.gender && <p className="text-sm text-red-500">{errors.gender}</p>}
                  </div>
                </div>

                <div>
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input
                    id="dateOfBirth"
                    type="date"
                    value={formData.dateOfBirth}
                    onChange={(e) => handleInputChange("dateOfBirth", e.target.value)}
                    className={errors.dateOfBirth ? "border-red-500" : ""}
                  />
                  {errors.dateOfBirth && <p className="text-red-500 text-sm mt-1">{errors.dateOfBirth}</p>}
                </div>
              </div>
            </div>

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Contact Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="parentContact">Parent/Guardian Contact *</Label>
                  <Input
                    id="parentContact"
                    value={formData.parentContact}
                    onChange={(e) => handleInputChange("parentContact", e.target.value)}
                    placeholder="Phone number or email"
                    className={errors.parentContact ? "border-red-500" : ""}
                  />
                  {errors.parentContact && <p className="text-red-500 text-sm mt-1">{errors.parentContact}</p>}
                </div>

                <div>
                  <Label htmlFor="address">Address *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange("address", e.target.value)}
                    placeholder="Home address"
                    className={errors.address ? "border-red-500" : ""}
                  />
                  {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
                </div>
              </div>
            </div>

            {/* Academic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <GraduationCap className="w-5 h-5" />
                Academic Information
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="admissionDate">Admission Date *</Label>
                  <Input
                    id="admissionDate"
                    type="date"
                    value={formData.admissionDate}
                    onChange={(e) => handleInputChange("admissionDate", e.target.value)}
                    className={errors.admissionDate ? "border-red-500" : ""}
                  />
                  {errors.admissionDate && <p className="text-red-500 text-sm mt-1">{errors.admissionDate}</p>}
                </div>

                <div>
                  <Label htmlFor="classGroup">Class Group *</Label>
                  <Select value={formData.classGroup} onValueChange={(value) => handleInputChange("classGroup", value)}>
                    <SelectTrigger className={errors.classGroup ? "border-red-500" : ""}>
                      <SelectValue placeholder="Select class group" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.isArray(settings.classGroups) &&
                        settings.classGroups.map((group) => (
                          <SelectItem key={group.id} value={group.id}>
                            {group.name} - ${group.standardFee}/{settings.billingCycle === "monthly" ? "month" : "term"}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {errors.classGroup && <p className="text-red-500 text-sm mt-1">{errors.classGroup}</p>}
                </div>

                <div>
                  <Label htmlFor="className">Class Name *</Label>
                  <Input
                    id="className"
                    value={formData.className}
                    onChange={(e) => handleInputChange("className", e.target.value)}
                    placeholder="e.g., Grade 1A, Form 2B"
                    className={errors.className ? "border-red-500" : ""}
                  />
                  {errors.className && <p className="text-red-500 text-sm mt-1">{errors.className}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    This can be different from the class group (e.g., specific section or stream)
                  </p>
                </div>
              </div>
            </div>

            {/* Custom School Fees Section */}
            {formData.classGroup && (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-4">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5" />
                    Custom School Fees
                  </h3>
                  
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="hasCustomFees"
                      checked={formData.hasCustomFees}
                      onCheckedChange={(checked) => handleInputChange("hasCustomFees", checked)}
                    />
                    <Label htmlFor="hasCustomFees" className="font-medium">
                      Enable Custom School Fees
                    </Label>
                  </div>

                  {formData.hasCustomFees && (
                    <div className="ml-6 space-y-3">
                      <div className="flex items-center gap-4">
                        <Label className="text-sm">
                          Custom {settings.billingCycle === "monthly" ? "Monthly" : "Per Term"} Fee ($)
                        </Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formData.customSchoolFee || 0}
                          onChange={(e) => handleInputChange("customSchoolFee", Number(e.target.value))}
                          className="w-32"
                          placeholder="0.00"
                        />
                        <span className="text-sm text-gray-600">
                          Annual: $
                          {settings.billingCycle === "monthly"
                            ? ((formData.customSchoolFee || 0) * 12).toFixed(2)
                            : ((formData.customSchoolFee || 0) * 3).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-blue-700">
                        ⚠️ This will override the standard class group fee for this student.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Transport Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <Car className="w-5 h-5" />
                Transport Information
              </h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="hasTransport"
                    checked={formData.hasTransport}
                    onCheckedChange={(checked) => handleInputChange("hasTransport", checked)}
                  />
                  <Label htmlFor="hasTransport" className="text-sm font-medium">
                    Student uses school transport
                  </Label>
                </div>

                {formData.hasTransport && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 ml-6">
                    <div>
                      <Label htmlFor="transportFee">
                        Transport Fee ({settings.billingCycle === "monthly" ? "per month" : "per term"}) *
                      </Label>
                      <Input
                        id="transportFee"
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.transportFee || ""}
                        onChange={(e) => handleTransportFeeChange(e.target.value)}
                        placeholder="0.00"
                        className={errors.transportFee ? "border-red-500" : ""}
                      />
                      {errors.transportFee && <p className="text-red-500 text-sm mt-1">{errors.transportFee}</p>}
                    </div>

                    <div>
                      <Label htmlFor="transportActivationDate">Transport Start Date *</Label>
                      <Input
                        id="transportActivationDate"
                        type="date"
                        value={formData.transportActivationDate}
                        onChange={(e) => handleInputChange("transportActivationDate", e.target.value)}
                        className={errors.transportActivationDate ? "border-red-500" : ""}
                      />
                      {errors.transportActivationDate && (
                        <p className="text-red-500 text-sm mt-1">{errors.transportActivationDate}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Date when transport service begins for this student</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Notes */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Additional Information
              </h3>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange("notes", e.target.value)}
                  placeholder="Any additional notes about the student..."
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Medical conditions, special requirements, or other important information
                </p>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end gap-4 pt-6 border-t">
              {onCancel && (
                <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              )}

              <Button type="submit" className="bg-purple-600 hover:bg-purple-700" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    {isEditing ? "Updating..." : "Adding..."}
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? "Update Student" : "Add Student"}
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
