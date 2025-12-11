import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(_request: NextRequest) {
  // Local-only mode: no auth checks required.
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|auth/callback).*)'],
}