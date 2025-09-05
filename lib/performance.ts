interface PerformanceMetric {
  name: string
  value: number
  timestamp: Date
  type: "timing" | "memory" | "custom"
}

class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: PerformanceMetric[] = []
  private maxMetrics = 1000

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }

  recordTiming(name: string, startTime: number): void {
    const endTime = performance.now()
    const duration = endTime - startTime

    this.addMetric({
      name,
      value: duration,
      timestamp: new Date(),
      type: "timing",
    })

    // Log slow operations
    if (duration > 1000) {
      console.warn(`Slow operation detected: ${name} took ${duration.toFixed(2)}ms`)
    }
  }

  recordMemoryUsage(): void {
    if ("memory" in performance) {
      const memory = (performance as any).memory
      this.addMetric({
        name: "memory_used",
        value: memory.usedJSHeapSize,
        timestamp: new Date(),
        type: "memory",
      })

      this.addMetric({
        name: "memory_total",
        value: memory.totalJSHeapSize,
        timestamp: new Date(),
        type: "memory",
      })
    }
  }

  recordCustomMetric(name: string, value: number): void {
    this.addMetric({
      name,
      value,
      timestamp: new Date(),
      type: "custom",
    })
  }

  private addMetric(metric: PerformanceMetric): void {
    this.metrics.unshift(metric)

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(0, this.maxMetrics)
    }
  }

  getMetrics(type?: PerformanceMetric["type"]): PerformanceMetric[] {
    if (type) {
      return this.metrics.filter((m) => m.type === type)
    }
    return [...this.metrics]
  }

  getAverageMetric(name: string, timeWindow = 300000): number {
    // 5 minutes default
    const cutoff = new Date(Date.now() - timeWindow)
    const relevantMetrics = this.metrics.filter((m) => m.name === name && m.timestamp > cutoff)

    if (relevantMetrics.length === 0) return 0

    const sum = relevantMetrics.reduce((acc, m) => acc + m.value, 0)
    return sum / relevantMetrics.length
  }

  clearMetrics(): void {
    this.metrics = []
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance()

// Utility function to measure function execution time
export function measurePerformance<T>(name: string, fn: () => T): T {
  const startTime = performance.now()
  try {
    const result = fn()
    performanceMonitor.recordTiming(name, startTime)
    return result
  } catch (error) {
    performanceMonitor.recordTiming(`${name}_error`, startTime)
    throw error
  }
}

// Utility function to measure async function execution time
export async function measureAsyncPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = performance.now()
  try {
    const result = await fn()
    performanceMonitor.recordTiming(name, startTime)
    return result
  } catch (error) {
    performanceMonitor.recordTiming(`${name}_error`, startTime)
    throw error
  }
}
