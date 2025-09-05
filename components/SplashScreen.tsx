'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import logo from '@/public/logo.png'

interface SplashScreenProps {
  version?: string
}

const SplashScreen: React.FC<SplashScreenProps> = ({ version = 'v1.0' }) => {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-transparent select-none">
      {/* Logo */}
      <div className="relative w-64 h-64">
        <Image
          src={logo}
          alt="My Students Track logo"
          fill
          className="object-contain animate-pulse"
          priority
        />
      </div>
      
      {/* App Title */}
      <h1 className="mt-6 text-3xl font-bold text-gray-900">My Students Track</h1>
      
      {/* Loading Text */}
      <p className="mt-2 text-gray-600">Loading...</p>
      
      {/* Version */}
      {version && (
        <div className="absolute bottom-4 right-4 text-sm text-gray-400">
          v{version}
        </div>
      )}
    </div>
  )
}

export default SplashScreen