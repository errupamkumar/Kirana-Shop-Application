import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { RouteError } from './RouteError'

function renderThrowing(error: Error) {
  const Throw = () => {
    throw error
  }
  const router = createMemoryRouter([{ path: '/', element: <Throw />, errorElement: <RouteError /> }])
  return render(<RouterProvider router={router} />)
}

describe('RouteError', () => {
  const reload = vi.fn()
  const originalLocation = window.location

  beforeEach(() => {
    reload.mockReset()
    sessionStorage.clear()
    Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, reload } })
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    vi.restoreAllMocks()
  })

  it('shows a friendly message for ordinary errors', () => {
    renderThrowing(new Error('Boom'))
    expect(screen.getByRole('alert')).toHaveTextContent('Boom')
    expect(reload).not.toHaveBeenCalled()
  })

  it('reloads once when a page chunk cannot be fetched, then explains instead of looping', () => {
    const chunkError = new TypeError('Failed to fetch dynamically imported module: http://localhost:5174/src/pages/DashboardPage.tsx')
    const first = renderThrowing(chunkError)
    expect(reload).toHaveBeenCalledTimes(1)
    first.unmount()

    renderThrowing(chunkError)
    expect(reload).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent('admin server may have restarted')
  })
})
