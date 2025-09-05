"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { Label } from "./ui/label"
import { Textarea } from "./ui/textarea"
import { Badge } from "./ui/badge"
import {
  validateLicense,
  saveLicenseToStorage,
  loadLicenseFromStorage,
  removeLicenseFromStorage,
  type LicenseData,
} from "../lib/licensing"
import { Shield, AlertCircle, CheckCircle, Key, School, Calendar, Clock, Users, DollarSign } from "lucide-react"

// Extend the Window interface to include electronAPI
declare global {
  interface Window {
    electronAPI?: {
      decryptLicense: (encryptedText: string) => Promise<{ success: boolean; decryptedText?: any; error?: string }>
    }
  }
}

interface LicenseValidationProps {
  onLicenseValid: (licenseData: LicenseData) => void
  schoolName: string
  onSchoolNameChange: (name: string) => void
}

export default function LicenseValidation({ onLicenseValid, schoolName, onSchoolNameChange }: LicenseValidationProps) {
  const [licenseCode, setLicenseCode] = useState("")
  const [error, setError] = useState("")
  const [isValidating, setIsValidating] = useState(false)
  const [existingLicense, setExistingLicense] = useState<LicenseData | null>(null)
  const [showLicenseDetails, setShowLicenseDetails] = useState(false)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)

  useEffect(() => {
    const savedLicense = loadLicenseFromStorage()
    if (savedLicense && schoolName) {
      const validation = validateLicense(savedLicense, schoolName)
      if (validation.valid) {
        setExistingLicense(savedLicense)
        onLicenseValid(savedLicense)
      } else {
        removeLicenseFromStorage()
        setError(validation.reason || "License validation failed")
      }
    }
  }, [schoolName, onLicenseValid])

  const handleValidateLicense = async () => {
    if (!schoolName.trim()) {
      setError("Please enter your school name first")
      return
    }

    if (!licenseCode.trim()) {
      setError("Please enter your license code")
      return
    }

    setIsValidating(true)
    setError("")

    try {
      if (!window.electronAPI || !window.electronAPI.decryptLicense) {
        throw new Error("Electron API not available. Cannot decrypt license.")
      }

      // Call the decryptLicense function exposed via Electron IPC
      const result = await window.electronAPI.decryptLicense(licenseCode.trim())

      if (result.success && result.decryptedText) {
        // Use the decryptedText object directly (do NOT JSON.parse)
        const licenseData: LicenseData = result.decryptedText
        const validation = validateLicense(licenseData, schoolName)

        if (validation.valid) {
          saveLicenseToStorage(licenseData)
          setExistingLicense(licenseData)
          onLicenseValid(licenseData)
        } else {
          setError(validation.reason || "License validation failed")
        }
      } else {
        setError(result.error || "Invalid license code. Decryption failed.")
      }
    } catch (err: any) {
      setError(`Error validating license: ${err.message || "Unknown error"}`)
    } finally {
      setIsValidating(false)
    }
  }

  const handleRemoveLicense = () => {
    if (showRemoveConfirm) {
      removeLicenseFromStorage()
      setExistingLicense(null)
      setLicenseCode("")
      setError("")
      setShowRemoveConfirm(false)
    } else {
      setShowRemoveConfirm(true)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  const getLicenseTypeDisplay = (type: string) => {
    switch (type) {
      case "lifetime":
        return "Lifetime License"
      case "1_month":
        return "1 Month License"
      case "3_months":
        return "3 Months License"
      case "6_months":
        return "6 Months License"
      case "1_year":
        return "1 Year License"
      case "2_years":
        return "2 Years License"
      case "3_years":
        return "3 Years License"
      case "4_years":
        return "4 Years License"
      case "5_years":
        return "5 Years License"
      default:
        return type
    }
  }

  const getDaysUntilExpiration = (expiresOn: string) => {
    if (existingLicense?.licenseType === "lifetime") return null

    const expiration = new Date(expiresOn)
    const now = new Date()
    const diffTime = expiration.getTime() - now.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays
  }

  const getLicenseFeatures = (licenseType: string) => {
    const baseFeatures = [
      "Student Registration & Management",
      "Fee Payment Tracking",
      "Class Group Organization",
      "Outstanding Payment Reports",
      "Student Details & History",
    ]

    const premiumFeatures = [
      "Transport Fee Management",
      "Automatic Class Promotions",
      "Custom Billing Cycles (Monthly/Termly)",
      "Advanced Reporting & Analytics",
      "Student Transfer Management",
      "Multi-Year Data Retention",
      "PDF Export Capabilities",
    ]

    if (licenseType === "lifetime" || licenseType.includes("year")) {
      return [...baseFeatures, ...premiumFeatures]
    }

    return baseFeatures
  }

  if (existingLicense) {
    const daysUntilExpiration = getDaysUntilExpiration(existingLicense.expiresOn)
    const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30
    const isExpired = daysUntilExpiration !== null && daysUntilExpiration <= 0
    const licenseFeatures = getLicenseFeatures(existingLicense.licenseType)

    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl space-y-6">
          <Card className="shadow-lg border-green-200">
            <CardHeader className="bg-green-50">
              <CardTitle className="text-center text-green-800 flex items-center justify-center gap-2">
                <CheckCircle className="w-6 h-6" />
                License Validated Successfully
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <School className="w-4 h-4" />
                      School Name
                    </Label>
                    <p className="text-lg font-semibold text-gray-900">{existingLicense.schoolName}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      License Type
                    </Label>
                    <Badge variant="secondary" className="text-sm">
                      {getLicenseTypeDisplay(existingLicense.licenseType)}
                    </Badge>
                  </div>

                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Issued On
                    </Label>
                    <p className="text-gray-700">{formatDate(existingLicense.issuedOn)}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      {existingLicense.licenseType === "lifetime" ? "Valid Until" : "Expires On"}
                    </Label>
                    {existingLicense.licenseType === "lifetime" ? (
                      <Badge variant="default" className="bg-purple-600">
                        Never Expires
                      </Badge>
                    ) : (
                      <div>
                        <p
                          className={`font-medium ${
                            isExpired ? "text-red-600" : isExpiringSoon ? "text-orange-600" : "text-gray-700"
                          }`}
                        >
                          {formatDate(existingLicense.expiresOn)}
                        </p>
                        {daysUntilExpiration !== null && (
                          <p
                            className={`text-sm ${
                              isExpired ? "text-red-600" : isExpiringSoon ? "text-orange-600" : "text-gray-600"
                            }`}
                          >
                            {daysUntilExpiration > 0
                              ? `${daysUntilExpiration} days remaining`
                              : `Expired ${Math.abs(daysUntilExpiration)} days ago`}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      License Status
                    </Label>
                    <Badge
                      variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "default"}
                      className={
                        isExpired
                          ? "bg-red-100 text-red-800"
                          : isExpiringSoon
                            ? "bg-orange-100 text-orange-800"
                            : "bg-green-100 text-green-800"
                      }
                    >
                      {isExpired ? "Expired" : isExpiringSoon ? "Expiring Soon" : "Active"}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* License Features */}
              <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h4 className="font-medium text-blue-800 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Licensed Features
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {licenseFeatures.map((feature, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm text-blue-700">
                      <CheckCircle className="w-3 h-3" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(isExpiringSoon || isExpired) && (
                <div
                  className={`mb-6 p-4 border rounded-md ${
                    isExpired ? "bg-red-50 border-red-200" : isExpiringSoon ? "bg-orange-50 border-orange-200" : ""
                  }`}
                >
                  <div
                    className={`flex items-center gap-2 ${
                      isExpired ? "text-red-800" : isExpiringSoon ? "text-orange-800" : ""
                    }`}
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span className="font-medium">{isExpired ? "License Expired" : "License Expiring Soon"}</span>
                  </div>
                  <p className={`text-sm mt-1 ${isExpired ? "text-red-700" : isExpiringSoon ? "text-orange-700" : ""}`}>
                    {isExpired
                      ? "Your license has expired. Some features may be limited. Please contact support to renew your license."
                      : `Your license will expire in ${daysUntilExpiration} days. Please contact support to renew your license.`}
                  </p>
                </div>
              )}

              <div className="flex gap-4">
                <Button
                  onClick={() => onLicenseValid(existingLicense)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  disabled={isExpired}
                >
                  {isExpired ? "License Expired" : "Continue to App"}
                </Button>
                <Button onClick={() => setShowLicenseDetails(!showLicenseDetails)} variant="outline">
                  {showLicenseDetails ? "Hide" : "Show"} Details
                </Button>
                <Button
                  onClick={handleRemoveLicense}
                  variant="outline"
                  className={`${
                    showRemoveConfirm
                      ? "text-red-600 border-red-600 hover:bg-red-50"
                      : "text-gray-600 border-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {showRemoveConfirm ? "Confirm Remove" : "Remove License"}
                </Button>
                {showRemoveConfirm && (
                  <Button onClick={() => setShowRemoveConfirm(false)} variant="outline" size="sm">
                    Cancel
                  </Button>
                )}
              </div>

              {showLicenseDetails && (
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <Label className="text-sm font-medium">License Details</Label>
                  <pre className="text-xs text-gray-600 mt-2 whitespace-pre-wrap">
                    {JSON.stringify(existingLicense, null, 2)}
                  </pre>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-purple-600 p-3 rounded-full">
              <Shield className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-purple-800 mb-2">My Students Track</h1>
          <p className="text-gray-600">Professional School Management System</p>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">System Features</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p>• Customizable billing cycles (Monthly/Termly)</p>
              <p>• Transport fee management with waivers</p>
              <p>• Automatic class promotions & transfers</p>
              <p>• Advanced reporting & analytics</p>
              <p>• Multi-year data retention</p>
            </div>
          </div>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-center text-purple-800 flex items-center justify-center gap-2">
              <Key className="w-5 h-5" />
              Enter License Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="schoolName" className="flex items-center gap-2">
                <School className="w-4 h-4" />
                School Name *
              </Label>
              <Input
                id="schoolName"
                value={schoolName}
                onChange={(e) => onSchoolNameChange(e.target.value)}
                placeholder="Enter your school name exactly as licensed"
                className="w-full"
              />
              <p className="text-xs text-gray-600">Enter your school name exactly as it appears in your license</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="licenseCode" className="flex items-center gap-2">
                <Key className="w-4 h-4" />
                License Code *
              </Label>
              <Textarea
                id="licenseCode"
                value={licenseCode}
                onChange={(e) => setLicenseCode(e.target.value)}
                placeholder="Paste your license code here..."
                className="w-full font-mono text-sm"
                rows={4}
              />
              <p className="text-xs text-gray-600">Paste the complete license code provided by Calch Media</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}

            <Button
              onClick={handleValidateLicense}
              disabled={isValidating || !schoolName.trim() || !licenseCode.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
            >
              {isValidating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Validating License...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Validate License
                </>
              )}
            </Button>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
              <h3 className="text-sm font-medium text-blue-800 mb-2">Need Help?</h3>
              <div className="text-sm text-blue-700 space-y-1">
                <p>• Make sure your school name matches exactly</p>
                <p>• Copy the entire license code without extra spaces</p>
                <p>• Contact Calch Media support if you are having issues</p>
                <p>• Email: support@calchmedia.com</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="text-center mt-8 text-sm text-gray-500">
          <p>Powered by Calch Media</p>
          <p className="mt-1">Secure • Licensed • Professional</p>
        </div>
      </div>
    </div>
  )
}