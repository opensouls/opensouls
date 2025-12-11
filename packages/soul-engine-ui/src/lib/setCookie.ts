"use server"

import { cookies } from "next/headers"

const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

export async function setCookie(name: string, value: string) {      
  const cookieStore = cookies()
  cookieStore.set(name, value, { httpOnly: true, expires: new Date(Date.now() + thirtyMinutes) })
}
