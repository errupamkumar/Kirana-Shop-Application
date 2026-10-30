import '@testing-library/jest-dom/vitest'

// jsdom lacks ResizeObserver, which Radix primitives (Switch, Select) use to measure themselves
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver
