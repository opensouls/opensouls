import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { origin } = new URL(request.url)
  // Local-only mode: skip auth flow entirely.
  return NextResponse.redirect(`${origin}/`)
}
