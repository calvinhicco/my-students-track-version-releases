// Enhanced browser-compatible licensing system with advanced security features

export interface LicenseData {
  schoolName: string
  issuedOn: string
  expiresOn: string
  licenseType: "1_month_trial" | "3_months" | "4_months" | "6_months" | "1_year" | "lifetime"
  version: string
  features: string[]
  maxStudents?: number
  licenseId: string
  checksum: string
}

export interface LicenseValidationResult {
  valid: boolean
  reason?: string
  message?: string
  daysUntilExpiration?: number
  isExpiringSoon?: boolean
}

// Enhanced license validation with detailed feedback
export function validateLicense(licenseData: LicenseData, schoolName: string): LicenseValidationResult {
  try {
    // Check school name (case-insensitive, trimmed)
    const licenseSchoolName = licenseData.schoolName.toLowerCase().trim()
    const inputSchoolName = schoolName.toLowerCase().trim()

    if (licenseSchoolName !== inputSchoolName) {
      return {
        valid: false,
        reason: "School name mismatch",
        message: `License is issued for "${licenseData.schoolName}" but you entered "${schoolName}"`,
      }
    }

    // Check expiration (all license types now have expiration dates)
    const now = new Date()
    const expiration = new Date(licenseData.expiresOn)

    if (isNaN(expiration.getTime())) {
      return {
        valid: false,
        reason: "Invalid expiration date",
        message: "License contains invalid expiration date",
      }
    }

    if (now > expiration) {
      const daysExpired = Math.ceil((now.getTime() - expiration.getTime()) / (1000 * 60 * 60 * 24))
      return {
        valid: false,
        reason: "License expired",
        message: `License expired ${daysExpired} day${daysExpired === 1 ? "" : "s"} ago on ${expiration.toLocaleDateString()}`,
      }
    }

    // Check if license will expire within 30 days
    const thirtyDaysFromNow = new Date()
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)
    const daysUntilExpiration = Math.ceil((expiration.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    // Special handling for trial licenses (warn earlier)
    const warningDays = licenseData.licenseType === "1_month_trial" ? 7 : 30 // lifetime has no expiration date

    if (daysUntilExpiration <= warningDays) {
      const trialMessage = licenseData.licenseType === "1_month_trial" ? " (Trial License)" : ""
      return {
        valid: true,
        reason: "License expires soon",
        message: `License${trialMessage} will expire in ${daysUntilExpiration} day${daysUntilExpiration === 1 ? "" : "s"} on ${expiration.toLocaleDateString()}`,
        daysUntilExpiration,
        isExpiringSoon: true,
      }
    }

    const trialMessage = licenseData.licenseType === "1_month_trial" ? " (Trial)" : ""
    return {
      valid: true,
      message: `License${trialMessage} is valid until ${expiration.toLocaleDateString()}`,
      daysUntilExpiration,
      isExpiringSoon: false,
    }
  } catch (error) {
    return {
      valid: false,
      reason: "Validation error",
      message: "An error occurred while validating the license",
    }
  }
}

// Helper to get days until expiration
export function getDaysUntilExpiration(licenseData: LicenseData): number {
  const expiration = new Date(licenseData.expiresOn)
  const now = new Date()
  const diffTime = expiration.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  return Math.max(0, diffDays)
}

export function getLicenseTypeDisplayName(licenseType: LicenseData["licenseType"]): string {
  const displayNames: Record<LicenseData["licenseType"], string> = {
    "1_month_trial": "1 Month Trial License",
    "3_months": "3 Months License",
    "4_months": "4 Months License",
    "6_months": "6 Months License",
    "1_year": "1 Year License",
    lifetime: "Lifetime License",
  }

  return displayNames[licenseType] || licenseType
}

// Check if license is a trial
export function isTrialLicense(licenseData: LicenseData): boolean {
  return licenseData.licenseType === "1_month_trial"
}

// Get license duration in months
export function getLicenseDurationInMonths(licenseType: LicenseData["licenseType"]): number {
  const durations: Record<LicenseData["licenseType"], number> = {
    "1_month_trial": 1,
    "3_months": 3,
    "4_months": 4,
    "6_months": 6,
    "1_year": 12,
    lifetime: 0, // lifetime has no expiration date
  }

  return durations[licenseType] || 0
}

// License health check
export function performLicenseHealthCheck(licenseData: LicenseData): {
  healthy: boolean
  issues: string[]
  warnings: string[]
} {
  const issues: string[] = []
  const warnings: string[] = []

  // Check required fields
  if (!licenseData.schoolName) issues.push("Missing school name")
  if (!licenseData.licenseId) issues.push("Missing license ID")
  if (!licenseData.checksum) issues.push("Missing integrity checksum")

  // Check dates
  const issuedDate = new Date(licenseData.issuedOn)
  const expirationDate = new Date(licenseData.expiresOn)

  if (isNaN(issuedDate.getTime())) issues.push("Invalid issue date")
  if (isNaN(expirationDate.getTime())) issues.push("Invalid expiration date")

  if (issuedDate > expirationDate) {
    issues.push("Issue date is after expiration date")
  }

  // Check for expiration warnings
  const daysUntilExpiration = getDaysUntilExpiration(licenseData)

  // Different warning thresholds for trial vs regular licenses
  const warningThreshold = licenseData.licenseType === "1_month_trial" ? 7 : 30
  const criticalThreshold = licenseData.licenseType === "1_month_trial" ? 3 : 7

  if (daysUntilExpiration <= criticalThreshold) {
    warnings.push(`License expires in ${daysUntilExpiration} days - URGENT`)
  } else if (daysUntilExpiration <= warningThreshold) {
    warnings.push(`License expires in ${daysUntilExpiration} days`)
  }

  // Special trial license warnings
  if (licenseData.licenseType === "1_month_trial") {
    warnings.push("This is a trial license with limited duration")
  }

  // Check features (simple validation, could be more complex)
  if (!licenseData.features || licenseData.features.length === 0) {
    warnings.push("No features defined in license")
  }

  // Check version (simple validation, could be more complex)
  if (!licenseData.version) {
    warnings.push("License version not specified")
  }

  // Check if license type is supported
  const supportedTypes: LicenseData["licenseType"][] = ["1_month_trial", "3_months", "4_months", "6_months", "1_year", "lifetime"]
  if (!supportedTypes.includes(licenseData.licenseType)) {
    issues.push(`Unsupported license type: ${licenseData.licenseType}`)
  }

  return {
    healthy: issues.length === 0,
    issues,
    warnings,
  }
}

// Check if license is expired
export function isLicenseExpired(licenseData: LicenseData): boolean {
  return new Date() > new Date(licenseData.expiresOn)
}

// Get license status with color coding for UI
export function getLicenseStatus(licenseData: LicenseData): {
  status: "active" | "expiring_soon" | "expired" | "trial"
  color: "green" | "yellow" | "red" | "blue"
  message: string
} {
  if (isLicenseExpired(licenseData)) {
    return {
      status: "expired",
      color: "red",
      message: "License has expired",
    }
  }

  const daysUntilExpiration = getDaysUntilExpiration(licenseData)
  const isTrial = isTrialLicense(licenseData)

  if (isTrial) {
    if (daysUntilExpiration <= 3) {
      return {
        status: "expiring_soon",
        color: "red",
        message: `Trial expires in ${daysUntilExpiration} days`,
      }
    }
    return {
      status: "trial",
      color: "blue",
      message: `Trial license - ${daysUntilExpiration} days remaining`,
    }
  }

  if (daysUntilExpiration <= 7) {
    return {
      status: "expiring_soon",
      color: "red",
      message: `Expires in ${daysUntilExpiration} days`,
    }
  }

  if (daysUntilExpiration <= 30) {
    return {
      status: "expiring_soon",
      color: "yellow",
      message: `Expires in ${daysUntilExpiration} days`,
    }
  }

  return {
    status: "active",
    color: "green",
    message: `Active - ${daysUntilExpiration} days remaining`,
  }
}

// --- Local Storage Management Functions ---
const LOCAL_STORAGE_KEY = "myStudentsTrackLicense"

export function saveLicenseToStorage(licenseData: LicenseData) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(licenseData))
  } catch (error) {
    console.error("Error saving license to local storage:", error)
  }
}

export function loadLicenseFromStorage(): LicenseData | null {
  try {
    const storedLicense = localStorage.getItem(LOCAL_STORAGE_KEY)
    return storedLicense ? JSON.parse(storedLicense) : null
  } catch (error) {
    console.error("Error loading license from local storage:", error)
    return null
  }
}

export function removeLicenseFromStorage() {
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY)
  } catch (error) {
    console.error("Error removing license from local storage:", error)
  }
}

// Migration helper for old license formats
export function migrateLegacyLicense(oldLicenseData: any): LicenseData | null {
  try {
    // Handle old license types that are no longer supported
    const legacyTypeMapping: Record<string, LicenseData["licenseType"] | null> = {
      "1_month": "1_month_trial", // Convert old 1_month to trial
      "2_years": null, // No longer supported
      "3_years": null, // No longer supported
      "4_years": null, // No longer supported
      "5_years": null, // No longer supported
      lifetime: "lifetime", // Convert old lifetime to new lifetime
    }

    if (oldLicenseData.licenseType in legacyTypeMapping) {
      const newType = legacyTypeMapping[oldLicenseData.licenseType]
      if (!newType) {
        console.warn(`Legacy license type ${oldLicenseData.licenseType} is no longer supported`)
        return null
      }
      oldLicenseData.licenseType = newType
    }

    // Validate that all required fields exist
    const requiredFields = [
      "schoolName",
      "issuedOn",
      "expiresOn",
      "licenseType",
      "version",
      "features",
      "licenseId",
      "checksum",
    ]
    for (const field of requiredFields) {
      if (!(field in oldLicenseData)) {
        console.warn(`Missing required field: ${field}`)
        return null
      }
    }

    return oldLicenseData as LicenseData
  } catch (error) {
    console.error("Error migrating legacy license:", error)
    return null
  }
}
