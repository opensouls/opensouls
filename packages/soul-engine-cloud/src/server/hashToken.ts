import crypto from "node:crypto"

export const hashToken = async (token: string) => {
  const hashedToken = crypto.createHash("sha256").update(token).digest('hex')
  return `\\x${hashedToken}`
}
