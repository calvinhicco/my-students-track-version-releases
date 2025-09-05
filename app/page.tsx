"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, type FormEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Shield, User, Lock, AlertCircle, School, Calendar, Clock } from "lucide-react";
import Dashboard from "../components/Dashboard";
import BroadcastPage from "../components/BroadcastPage";
import LicenseValidation from "../components/LicenseValidation";
import { validateLicense, loadLicenseFromStorage, type LicenseData } from "../lib/licensing";
import { DEFAULT_SETTINGS } from "../types/index";
import type { User as UserType, AppSettings } from "../types/index";

function getDaysUntilExpiration(expiresOn: string) {
  const expirationDate = new Date(expiresOn);
  const now = new Date();
  const diffTime = expirationDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export default function MainApp() {
  const [user, setUser] = useState<UserType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginData, setLoginData] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [validLicense, setValidLicense] = useState<LicenseData | null>(null);
  const [schoolName, setSchoolName] = useState("");
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [currentView, setCurrentView] = useState<'dashboard' | 'broadcast'>('dashboard');

  const daysUntilExpiration = validLicense ? getDaysUntilExpiration(validLicense.expiresOn) : null;
  const isExpired = daysUntilExpiration !== null && daysUntilExpiration < 0;
  const isExpiringSoon = daysUntilExpiration !== null && daysUntilExpiration <= 30;

  useEffect(() => {
    const initializeApp = async () => {
      try {
        const alreadyInitialized = localStorage.getItem("appInitialized");
        if (!alreadyInitialized) {
          localStorage.removeItem("studentTrackSettings");
          localStorage.removeItem("studentTrackUser");
          localStorage.removeItem("studentTrackLicense");
          localStorage.setItem("appInitialized", "true");
          localStorage.setItem("studentTrackSettings", JSON.stringify(DEFAULT_SETTINGS));
          setSettings(DEFAULT_SETTINGS);
          setSchoolName("");
          setValidLicense(null);
        } else {
          const savedSettings = localStorage.getItem("studentTrackSettings");
          if (savedSettings) {
            try {
              const parsedSettings = JSON.parse(savedSettings);
              const mergedSettings = { ...DEFAULT_SETTINGS, ...parsedSettings };
              setSettings(mergedSettings);
              setSchoolName(mergedSettings.schoolName || "");
            } catch (e) {
              setSettings(DEFAULT_SETTINGS);
              setSchoolName("");
            }
          }
          const savedLicense = loadLicenseFromStorage();
          if (savedLicense) {
            const validation = validateLicense(savedLicense, savedSettings ? JSON.parse(savedSettings).schoolName : "");
            if (validation.valid) {
              setValidLicense(savedLicense);
            } else {
              setValidLicense(null);
            }
          }
          const savedUser = localStorage.getItem("studentTrackUser");
          if (savedUser) {
            setUser(JSON.parse(savedUser));
          }
        }
      } catch (e) {
        console.error("Initialization error:", e);
        setUser(null);
        setValidLicense(null);
        setSettings(DEFAULT_SETTINGS);
      } finally {
        setIsLoading(false);
      }
    };
    initializeApp();
  }, []);

  const handleLogin = (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const validCredentials = [
      { email: "admin@school.com", password: "admin123", name: "Administrator" },
      { email: "principal@school.com", password: "principal123", name: "Principal" },
      { email: "clerk@school.com", password: "clerk123", name: "School Clerk" },
    ];
    const validUser = validCredentials.find(
      (cred) => cred.email === loginData.email && cred.password === loginData.password
    );
    if (validUser) {
      const newUser: UserType = { id: Date.now().toString(), email: validUser.email, name: validUser.name, role: "admin" };
      setUser(newUser);
      localStorage.setItem("studentTrackUser", JSON.stringify(newUser));
    } else {
      setError("Invalid email or password.");
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem("studentTrackUser");
    setLoginData({ email: "", password: "" });
    setError("");
  };

  const handleLicenseValid = (licenseData: LicenseData) => {
    setValidLicense(licenseData);
    const updatedSettings = { ...settings, schoolName: licenseData.schoolName };
    setSettings(updatedSettings);
    setSchoolName(licenseData.schoolName);
    localStorage.setItem("studentTrackSettings", JSON.stringify(updatedSettings));
  };

  const handleSchoolNameChange = (name: string) => {
    setSchoolName(name);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-purple-600">Loading My Students Track...</p>
        </div>
      </div>
    );
  }

  if (!validLicense) {
    return (
      <LicenseValidation
        onLicenseValid={handleLicenseValid}
        schoolName={schoolName}
        onSchoolNameChange={handleSchoolNameChange}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
             <div className="flex items-center justify-center mb-4"><div className="bg-purple-600 p-3 rounded-full"><Shield className="w-8 h-8 text-white" /></div></div>
            <h1 className="text-3xl font-bold text-purple-800">My Students Track</h1>
            <p className="text-gray-600 mt-2">School Management Made Easy</p>
          </div>
          {validLicense && (
            <div className={`p-3 rounded-lg border mb-6 text-center ${isExpired ? "bg-red-50 border-red-200" : isExpiringSoon ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200"}`}>
              <div className={`flex items-center justify-center gap-2 ${isExpired ? "text-red-800" : isExpiringSoon ? "text-orange-800" : "text-green-800"}`}>
                <span className="text-sm font-medium">{isExpired ? "License Expired" : isExpiringSoon ? "License Expiring Soon" : `Licensed to: ${validLicense.schoolName}`}</span>
              </div>
              <div className={`flex items-center justify-center gap-2 mt-1 ${isExpired ? "text-red-700" : isExpiringSoon ? "text-orange-700" : "text-green-700"}`}>
                <div className="flex items-center gap-1"><School className="w-3 h-3" /><span className="text-xs">{validLicense.schoolName}</span></div>
                <div className="flex items-center gap-1"><Clock className="w-3 h-3" /><span className="text-xs">{validLicense.licenseType === "lifetime" ? "Lifetime License" : isExpired ? `Expired ${Math.abs(daysUntilExpiration!)} days ago` : daysUntilExpiration !== null ? `${daysUntilExpiration} days remaining` : "Valid"}</span></div>
              </div>
            </div>
          )}
          <Card className="shadow-lg">
            <CardHeader><CardTitle className="text-center text-purple-800 flex items-center justify-center gap-2"><User className="w-5 h-5" />Administrator Login</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2"><Label htmlFor="email" className="flex items-center gap-2"><User className="w-4 h-4" />Email</Label><Input id="email" type="email" value={loginData.email} onChange={(e) => setLoginData((prev) => ({ ...prev, email: e.target.value }))} placeholder="Enter your email" required /></div>
                <div className="space-y-2"><Label htmlFor="password" className="flex items-center gap-2"><Lock className="w-4 h-4" />Password</Label><Input id="password" type="password" value={loginData.password} onChange={(e) => setLoginData((prev) => ({ ...prev, password: e.target.value }))} placeholder="Enter your password" required /></div>
                {error && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-md text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
                <Button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 text-white" disabled={isExpired}><Shield className="w-4 h-4 mr-2" />{isExpired ? "License Expired" : "Login to Dashboard"}</Button>
              </form>
            </CardContent>
          </Card>
          <div className="text-center mt-8 text-sm text-gray-500"><p>Powered by Calch Media</p><p className="mt-1">Secure • Licensed • Professional</p><div className="mt-2 flex items-center justify-center gap-2 text-xs"><Calendar className="w-3 h-3" /><span>Version 2.0 • Academic Year {new Date().getFullYear()}</span></div></div>
        </div>
      </div>
    );
  }

  if (currentView === 'broadcast') {
    return (
      <BroadcastPage
        goToDashboard={() => setCurrentView('dashboard')}
        settings={settings}
      />
    );
  }

  return (
    <Dashboard
      user={user}
      onLogout={handleLogout}
      goToBroadcast={() => setCurrentView('broadcast')}
    />
  );
}
