import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/sidebar'

jest.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
}))

describe('Sidebar', () => {
  it('renders all 5 navigation items', () => {
    render(<Sidebar />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Sessions')).toBeInTheDocument()
    expect(screen.getByText('Call Review')).toBeInTheDocument()
    expect(screen.getByText('Knowledge Base')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('highlights the active route', () => {
    render(<Sidebar />)
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink).toHaveClass('bg-indigo-600')
  })
})
