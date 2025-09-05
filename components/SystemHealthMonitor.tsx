"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { performanceMonitor } from "@/lib/performance"
import { errorHandler } from "@/lib/errorHandler"
import { Activity, AlertTriangle, CheckCircle, XCircle, RefreshCw } from "lucide-react"

interface SystemHealth {
  status: "healthy" | "warning" | "critical"
  uptime: number
  memoryUsage: number
  errorCount: number
  averageResponseTime: number
  lastUpdated: Date
}

export default function SystemHealthMonitor() {
  const [health, setHealth] = useState<SystemHealth>({
    status: "healthy",
    uptime: 0,
    memoryUsage: 0,
    errorCount: 0,
    averageResponseTime: 0,
    lastUpdated: new Date(),
  })
  const [isVisible, setIsVisible] = useState(false)

  const checkSystemHealth = () => {
    try {
      // Record memory usage
      performanceMonitor.recordMemoryUsage()

      // Get metrics
      const memoryMetrics = performanceMonitor.getMetrics("memory")
      const timingMetrics = performanceMonitor.getMetrics("timing")
      const errors = errorHandler.getErrors()

      // Calculate memory usage percentage (rough estimate)
      const latestMemory = memoryMetrics.find((m) => m.name === "memory_used")
      const memoryUsage = latestMemory ? Math.min((latestMemory.value / (1024 * 1024 * 100)) * 100, 100) : 0

      // Calculate average response time
      const recentTimings = timingMetrics.filter(
        (m) => m.timestamp > new Date(Date.now() - 300000), // Last 5 minutes
      )
      const averageResponseTime =
        recentTimings.length > 0 ? recentTimings.reduce((sum, m) => sum + m.value, 0) / recentTimings.length : 0

      // Count recent errors
      const recentErrors = errors.filter(
        (e) => e.context?.timestamp && e.context.timestamp > new Date(Date.now() - 300000),
      )

      // Determine system status
      let status: SystemHealth["status"] = "healthy"
      if (recentErrors.length > 5 || memoryUsage > 80 || averageResponseTime > 2000) {
        status = "critical"
      } else if (recentErrors.length > 2 || memoryUsage > 60 || averageResponseTime > 1000) {
        status = "warning"
      }

      setHealth({
        status,
        uptime: performance.now() / 1000 / 60, // Convert to minutes
        memoryUsage,
        errorCount: recentErrors.length,
        averageResponseTime,
        lastUpdated: new Date(),
      })
    } catch (error) {
      console.error("Error checking system health:", error)
    }
  }

  useEffect(() => {
    checkSystemHealth()
    const interval = setInterval(checkSystemHealth, 30000) // Check every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = () => {
    switch (health.status) {
      case "healthy":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case "critical":
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  const getStatusColor = () => {
    switch (health.status) {
      case "healthy":
        return "bg-green-500"
      case "warning":
        return "bg-yellow-500"
      case "critical":
        return "bg-red-500"
    }
  }

  if (!isVisible) {
    return (
      <Button variant="outline" size="sm" onClick={() => setIsVisible(true)} className="fixed bottom-4 right-4 z-50">
        <Activity className="h-4 w-4 mr-2" />
        System Health
      </Button>
    )
  }

  return (
    <Card className="fixed bottom-4 right-4 w-80 z-50 shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            {getStatusIcon()}
            System Health
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={checkSystemHealth}>
              <RefreshCw className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setIsVisible(false)}>
              ×
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <Badge variant={health.status === "healthy" ? "default" : "destructive"}>{health.status.toUpperCase()}</Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Memory Usage</span>
            <span>{health.memoryUsage.toFixed(1)}%</span>
          </div>
          <Progress value={health.memoryUsage} className="h-1" />
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-muted-foreground">Uptime</div>
            <div className="font-mono">{health.uptime.toFixed(1)}m</div>
          </div>
          <div>
            <div className="text-muted-foreground">Errors</div>
            <div className="font-mono">{health.errorCount}</div>
          </div>
        </div>

        <div className="text-xs">
          <div className="text-muted-foreground">Avg Response Time</div>
          <div className="font-mono">{health.averageResponseTime.toFixed(0)}ms</div>
        </div>

        <div className="text-xs text-muted-foreground">Last updated: {health.lastUpdated.toLocaleTimeString()}</div>
      </CardContent>
    </Card>
  )
}
