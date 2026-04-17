import { render, screen } from '@testing-library/react'
import { StatCard } from '@/components/stat-card'

describe('StatCard', () => {
  it('renders title and value', () => {
    render(<StatCard title="Total Sessions" value={42} />)
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
  })

  it('renders optional subtitle', () => {
    render(<StatCard title="Revenue" value="$200" subtitle="Month to date" />)
    expect(screen.getByText('Month to date')).toBeInTheDocument()
  })

  it('applies emerald highlight classes when highlight is true', () => {
    render(<StatCard title="Break-even" value="20/20" highlight />)
    const value = screen.getByText('20/20')
    expect(value).toHaveClass('text-emerald-400')
  })

  it('does not apply highlight classes by default', () => {
    render(<StatCard title="Test" value="0" />)
    const value = screen.getByText('0')
    expect(value).not.toHaveClass('text-emerald-400')
  })
})
