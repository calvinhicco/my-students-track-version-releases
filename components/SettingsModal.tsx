"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "./ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Badge } from "./ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import type { AppSettings, ClassGroup } from "../types/index"
import { BillingCycle } from "../types/index"
import { Settings, DollarSign, Users, Calendar, Clock } from "lucide-react"

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: AppSettings) => void
  onClose: () => void
  studentCount: number
}

export default function SettingsModal({ settings, onSave, onClose, studentCount }: SettingsModalProps) {
  const initialGroups: ClassGroup[] = Array.isArray(settings?.classGroups) ? settings.classGroups : []

  const [formData, setFormData] = useState<AppSettings>({
    schoolName: settings?.schoolName || "",
    classGroups: initialGroups,
    autoPromotionEnabled: settings?.autoPromotionEnabled ?? true,
    transferRetentionYears: settings?.transferRetentionYears || 5,
    savedClassNames: settings?.savedClassNames || [],
    billingCycle: settings?.billingCycle || BillingCycle.MONTHLY,
    paymentDueDate: settings?.paymentDueDate || 1, // New: Payment due date
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: name === "paymentDueDate" ? Number.parseInt(value) : value,
    }))
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }))
    }
  }

  const handleSelectChange = (name: string, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleClassGroupToggle = (groupId: string, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      classGroups: prev.classGroups.map((group) => (group.id === groupId ? { ...group, enabled } : group)),
    }))
  }

  const handleClassGroupFeeChange = (groupId: string, fee: number) => {
    setFormData((prev) => ({
      ...prev,
      classGroups: prev.classGroups.map((group) => (group.id === groupId ? { ...group, standardFee: fee } : group)),
    }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.schoolName.trim()) {
      newErrors.schoolName = "School name is required"
    }

    const hasEnabled = formData.classGroups.some((group) => group.enabled)
    if (!hasEnabled) {
      newErrors.classGroups = "Please enable at least one class group"
    }

    formData.classGroups.forEach((group) => {
      if (group.enabled && (group.standardFee <= 0 || isNaN(group.standardFee))) {
        newErrors[`fee_${group.id}`] = "Fee must be greater than 0"
      }
    })

    if (formData.paymentDueDate < 1 || formData.paymentDueDate > 28) {
      newErrors.paymentDueDate = "Payment due date must be between 1-28"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validateForm()) {
      onSave(formData)
    }
  }

  if (!Array.isArray(settings?.classGroups)) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center text-red-600">
            <p>⚠️ Settings failed to load properly. Please restart the app or reset saved settings.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const classGroupCards = formData.classGroups.map((group) => (
    <div
      key={group.id}
      className={`border rounded-lg p-4 ${
        group.enabled ? "border-purple-200 bg-purple-50" : "border-gray-200 bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <div
            className="w-5 h-5 border rounded flex items-center justify-center cursor-pointer"
            onClick={() => handleClassGroupToggle(group.id, !group.enabled)}
          >
            {group.enabled && <div className="w-3 h-3 bg-purple-600 rounded-sm"></div>}
          </div>
          <Label className="font-medium">{group.name}</Label>
        </div>
        {group.enabled && (
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            Active
          </Badge>
        )}
      </div>

      {group.enabled && (
        <div className="ml-6 space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <Label className="text-sm">
                {formData.billingCycle === BillingCycle.MONTHLY ? "Monthly" : "Per Term"} Fee ($)
              </Label>
            </div>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={group.standardFee || 0}
              onChange={(e) => handleClassGroupFeeChange(group.id, Number(e.target.value))}
              className={`w-32 ${errors[`fee_${group.id}`] ? "border-red-500" : ""}`}
            />
            <span className="text-sm text-gray-600">
              Annual: $
              {formData.billingCycle === BillingCycle.MONTHLY
                ? (group.standardFee * 12).toFixed(2)
                : (group.standardFee * 3).toFixed(2)}
            </span>
          </div>
          {errors[`fee_${group.id}`] && <p className="text-sm text-red-600">{errors[`fee_${group.id}`]}</p>}
        </div>
      )}
    </div>
  ))

  const enabledGroups = formData.classGroups.filter((g) => g.enabled)

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle className="text-purple-800 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            School Settings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="schoolName">School Name *</Label>
              <Input
                id="schoolName"
                name="schoolName"
                value={formData.schoolName}
                onChange={handleInputChange}
                className={errors.schoolName ? "border-red-500" : ""}
              />
              {errors.schoolName && <p className="text-sm text-red-600">{errors.schoolName}</p>}
            </div>

            {/* Fee Billing Configuration */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Fee Billing Configuration
              </h3>
              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg space-y-4">
                <div>
                  <Label htmlFor="billingCycle" className="mb-2 block">
                    Select Billing Cycle:
                  </Label>
                  <Select
                    value={formData.billingCycle}
                    onValueChange={(value: BillingCycle) => handleSelectChange("billingCycle", value)}
                  >
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Select billing cycle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={BillingCycle.MONTHLY}>Monthly Fees</SelectItem>
                      <SelectItem value={BillingCycle.TERMLY}>Termly Fees</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-gray-600 mt-2">
                    {formData.billingCycle === BillingCycle.TERMLY
                      ? "Termly: Term 1 (Jan-Apr), Term 2 (May-Aug), Term 3 (Sept-Dec)"
                      : "Monthly billing occurs on the 1st of each month"}
                  </p>
                </div>

                <div>
                  <Label htmlFor="paymentDueDate" className="mb-2 block flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    Payment Due Date:
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="paymentDueDate"
                      name="paymentDueDate"
                      type="number"
                      min="1"
                      max="28"
                      value={formData.paymentDueDate}
                      onChange={handleInputChange}
                      className={`w-20 ${errors.paymentDueDate ? "border-red-500" : ""}`}
                    />
                    <span className="text-sm text-gray-600">
                      of each {formData.billingCycle === BillingCycle.MONTHLY ? "month" : "term start month"}
                    </span>
                  </div>
                  {errors.paymentDueDate && <p className="text-sm text-red-600">{errors.paymentDueDate}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    Transport fees are billed on the 7th of each month regardless of billing cycle
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                <Users className="w-5 h-5" />
                Class Groups & Standard Fees
              </h3>
              <p className="text-sm text-gray-600">
                Select applicable class groups and set standard fees. These will replace per-student custom fees.
              </p>
              {errors.classGroups && <p className="text-sm text-red-600">{errors.classGroups}</p>}
              <div className="grid gap-4">{classGroupCards}</div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-800 flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Automatic Promotions & Transfers
              </h3>

              <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg">
                <div className="flex items-center space-x-3 mb-3">
                  <div
                    className="w-5 h-5 border rounded flex items-center justify-center cursor-pointer"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        autoPromotionEnabled: !prev.autoPromotionEnabled,
                      }))
                    }
                  >
                    {formData.autoPromotionEnabled && <div className="w-3 h-3 bg-purple-600 rounded-sm"></div>}
                  </div>
                  <Label className="font-medium">Enable Automatic Promotions (January 1st)</Label>
                </div>

                {formData.autoPromotionEnabled && (
                  <div className="ml-6 text-sm text-blue-700 space-y-1">
                    <p>• Grade 1–6 students will be promoted to next grade</p>
                    <p>• Grade 7 students will be automatically transferred</p>
                    <p>• Form 1–5 students will be promoted to next form</p>
                    <p>• Form 6 students will be automatically transferred</p>
                    <p>• Billing will be frozen on transfer date</p>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4">
                <Label htmlFor="transferRetentionYears" className="text-sm">
                  Keep transfer records for:
                </Label>
                <Input
                  id="transferRetentionYears"
                  type="number"
                  min="1"
                  max="10"
                  value={formData.transferRetentionYears}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      transferRetentionYears: Number(e.target.value),
                    }))
                  }
                  className="w-20"
                />
                <span className="text-sm text-gray-600">years</span>
              </div>
            </div>

            <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">Configuration Summary</h4>
              <div className="text-sm text-green-700 space-y-1">
                <p>
                  <strong>School:</strong> {formData.schoolName || "Not set"}
                </p>
                <p>
                  <strong>Enabled Class Groups:</strong> {enabledGroups.length}
                </p>
                <p>
                  <strong>Current Students:</strong> {studentCount || 0}
                </p>
                <p>
                  <strong>Billing Cycle:</strong>{" "}
                  {formData.billingCycle === BillingCycle.MONTHLY ? "Monthly" : "Termly"}
                </p>
                <p>
                  <strong>Payment Due:</strong> {formData.paymentDueDate}
                  {formData.billingCycle === BillingCycle.MONTHLY ? " of each month" : " of term start month"}
                </p>
                <p>
                  <strong>Auto-Promotions:</strong> {formData.autoPromotionEnabled ? "Enabled" : "Disabled"}
                </p>
                <p>
                  <strong>Transfer Retention:</strong> {formData.transferRetentionYears} years
                </p>
              </div>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="button" variant="outline" onClick={onClose} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" className="bg-purple-600 hover:bg-purple-700 text-white flex-1">
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
