"use client"
import type React from "react"
import { useEffect, useState } from "react"
import dynamic from 'next/dynamic'
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

// Simple SplashScreen component
const SplashScreen = dynamic(() => import('@/components/SplashScreen'), {
  ssr: false,
  loading: () => null
})

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [showSplash, setShowSplash] = useState(true)
  
  useEffect(() => {
    const init = async () => {
      try {
        // Check if running in Electron
        const isElectron = typeof window !== 'undefined' && 
          window.electron !== undefined
        
        if (isElectron) {
                  // In Electron, the splash is handled by the main process
          // Just a small delay to ensure smooth transition
          await new Promise(resolve => setTimeout(resolve, 1000))
        } else {
          // Web: Simulate async init (replace with actual initialization)
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } catch (error) {
        console.error('Initialization error:', error)
      } finally {
        setShowSplash(false)
      }
    }
    
    init()
    
    // Cleanup function
    return () => {
      setShowSplash(false)
    }
  }, [])

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta
          name="description"
          content="Comprehensive school management system with student tracking, fee management, transport services, and automated reporting. Licensed by Calch Media."
        />
        <meta
          name="keywords"
          content="school management, student tracking, fee management, transport services, academic records, billing system"
        />
        <meta name="author" content="Calch Media" />
        <meta name="robots" content="noindex, nofollow" />

        {/* Open Graph / Facebook */}
        <meta property="og:type" content="website" />
        <meta property="og:title" content="My Students Track - Professional School Management System" />
        <meta
          property="og:description"
          content="Comprehensive school management system with student tracking, fee management, transport services, and automated reporting. Licensed by Calch Media."
        />
        <meta property="og:site_name" content="My Students Track" />

        {/* Twitter */}
        <meta property="twitter:card" content="summary_large_image" />
        <meta property="twitter:title" content="My Students Track - Professional School Management System" />
        <meta
          property="twitter:description"
          content="Comprehensive school management system with student tracking, fee management, transport services, and automated reporting. Licensed by Calch Media."
        />

        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />

        {/* Theme */}
        <meta name="theme-color" content="#7c3aed" />
        <meta name="msapplication-TileColor" content="#7c3aed" />

        <title>My Students Track - Professional School Management System</title>
      </head>
      <body className="font-sans antialiased bg-gray-50 text-gray-900">
        <div id="root" className="min-h-screen">
          {showSplash ? <SplashScreen version="v2.0.0" /> : (
            <>
              {children}
              <Toaster />
            </>
          )}
        </div>

        {/* Global Loading Indicator */}
        <div
          id="global-loading"
          className="hidden fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50"
        >
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-purple-600">Loading...</p>
          </div>
        </div>

        {/* Global Error Boundary */}
        <div id="global-error" className="hidden fixed inset-0 bg-red-50 flex items-center justify-center z-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-red-800 mb-2">Something went wrong</h2>
            <p className="text-red-600 mb-4">The application encountered an unexpected error.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
