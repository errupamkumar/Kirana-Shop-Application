import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { isTerminal, nextStatuses } from '@/lib/orderStatus'
import type { OrderStatus } from '@/lib/types'
import { StatusActions } from './StatusActions'

describe('nextStatuses (mirrors the server state machine for staff)', () => {
  it.each<[OrderStatus, OrderStatus[]]>([
    ['PENDING_PAYMENT', ['CANCELLED']],
    ['PLACED', ['PACKED', 'CANCELLED']],
    ['PACKED', ['OUT_FOR_DELIVERY', 'CANCELLED']],
    ['OUT_FOR_DELIVERY', ['DELIVERED', 'CANCELLED']],
    ['DELIVERED', []],
    ['CANCELLED', []],
  ])('%s -> %j', (status, expected) => {
    expect(nextStatuses(status)).toEqual(expected)
  })

  it('treats delivered and cancelled as terminal', () => {
    expect(isTerminal('DELIVERED')).toBe(true)
    expect(isTerminal('CANCELLED')).toBe(true)
    expect(isTerminal('PACKED')).toBe(false)
  })
})

describe('StatusActions', () => {
  it('shows only the valid next step for a placed order', () => {
    render(<StatusActions status="PLACED" onChange={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Mark packed' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Mark delivered' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Out for delivery' })).not.toBeInTheDocument()
  })

  it('offers delivery once the order is out', async () => {
    const onChange = vi.fn()
    render(<StatusActions status="OUT_FOR_DELIVERY" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Mark delivered' }))
    expect(onChange).toHaveBeenCalledWith('DELIVERED')
    expect(screen.queryByRole('button', { name: 'Mark packed' })).not.toBeInTheDocument()
  })

  it('has no actions for closed orders', () => {
    render(<StatusActions status="DELIVERED" onChange={vi.fn()} />)
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    expect(screen.getByText(/this order is closed/)).toBeInTheDocument()
  })

  it('only offers cancel while awaiting payment', () => {
    render(<StatusActions status="PENDING_PAYMENT" onChange={vi.fn()} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument()
  })

  it('requires a reason before cancelling', async () => {
    const onChange = vi.fn()
    render(<StatusActions status="PACKED" onChange={onChange} />)
    await userEvent.click(screen.getByRole('button', { name: 'Cancel order' }))
    const confirm = within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cancel order' })
    expect(confirm).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Reason'), 'Customer unreachable')
    await userEvent.click(confirm)
    expect(onChange).toHaveBeenCalledWith('CANCELLED', 'Customer unreachable')
  })
})

import { within } from '@testing-library/react'
