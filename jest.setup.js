import "@testing-library/jest-dom"

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}
global.localStorage = localStorageMock

// Mock performance API
global.performance = {
  ...global.performance,
  now: jest.fn(() => Date.now()),
  memory: {
    usedJSHeapSize: 1000000,
    totalJSHeapSize: 2000000,
    jsHeapSizeLimit: 4000000,
  },
}

// Mock window.electron for Electron environment
global.window = {
  ...global.window,
  electron: {
    store: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
    },
    app: {
      getVersion: jest.fn(() => "2.0.0"),
      quit: jest.fn(),
    },
  },
}

// Suppress console warnings in tests
const originalWarn = console.warn
beforeAll(() => {
  console.warn = (...args) => {
    if (typeof args[0] === "string" && args[0].includes("componentWillReceiveProps")) {
      return
    }
    originalWarn.call(console, ...args)
  }
})

afterAll(() => {
  console.warn = originalWarn
})
