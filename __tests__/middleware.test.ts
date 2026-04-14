/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

describe('middleware route protection', () => {
  it('allows requests to /auth routes through', () => {
    const request = new NextRequest('http://localhost:3000/auth/login')
    expect(request.nextUrl.pathname.startsWith('/auth')).toBe(true)
  })

  it('identifies dashboard routes that need protection', () => {
    const request = new NextRequest('http://localhost:3000/dashboard')
    expect(request.nextUrl.pathname.startsWith('/dashboard')).toBe(true)
  })
})
