import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AddToKbButton } from '@/components/add-to-kb-button'

describe('AddToKbButton', () => {
  beforeEach(() => {
    global.fetch = jest.fn()
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('renders the add button', () => {
    render(<AddToKbButton question="Q?" answer="A." />)
    expect(screen.getByRole('button', { name: '+ Add to KB' })).toBeInTheDocument()
  })

  it('shows loading state while request is in flight', async () => {
    ;(global.fetch as jest.Mock).mockImplementation(
      () => new Promise(() => {}) // never resolves
    )
    render(<AddToKbButton question="Q?" answer="A." />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add to KB' }))
    expect(await screen.findByRole('button', { name: 'Adding...' })).toBeInTheDocument()
  })

  it('shows success state after successful request', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: true })
    render(<AddToKbButton question="Q?" answer="A." />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add to KB' }))
    await waitFor(() => expect(screen.getByText('Added to KB ✓')).toBeInTheDocument())
  })

  it('shows error state when request fails', async () => {
    ;(global.fetch as jest.Mock).mockResolvedValue({ ok: false })
    render(<AddToKbButton question="Q?" answer="A." />)
    fireEvent.click(screen.getByRole('button', { name: '+ Add to KB' }))
    await waitFor(() => expect(screen.getByText('Error — try again')).toBeInTheDocument())
  })
})
