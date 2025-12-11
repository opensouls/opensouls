import { importJWK, JWTPayload, type KeyLike, SignJWT, type JWK } from 'jose'

const ALGORITHM = "ES256"

export interface JWTOptions {
  privateKey: string | JWK | KeyLike,
  issuer: string,
  // JWT payload, the audience is required
  payload: JWTPayload & { aud: string }
}

export interface EngineJWTOptions {
  privateKey: string | JWK | KeyLike,
  issuer: string,
  organization: string,
  blueprint: string,
  soulId: string,
  additionalPayload?: JWTPayload
}

const privateKeyFromString = (privateKey: string) => {
  return importJWK(JSON.parse(Buffer.from(privateKey, 'base64').toString()), ALGORITHM)
}

const privateKeyFromObject = (privateKey: KeyLike | JWK) => {
  return importJWK(privateKey, ALGORITHM)
}

export const issueTokenForEngine = async ({ privateKey, issuer, organization, blueprint, soulId, additionalPayload = {} }: EngineJWTOptions) => {
  const token = await issueToken({
    privateKey,
    issuer,
    payload: {
      ...additionalPayload,
      aud: audienceForJWT({ organizationSlug: organization, blueprint, soulId }),
    }
  })

  return `jwt:${token}`
}

export const issueToken = async ({ privateKey, issuer, payload: userPayload }: JWTOptions) => {
  const privateKeyJWK = typeof privateKey === 'string' ? (await privateKeyFromString(privateKey)) : (await privateKeyFromObject(privateKey))
  // Issue token

  const payload: JWTPayload = {
    iss: issuer,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...userPayload,
  }

  const jwtToken = await new SignJWT(payload)
    .setProtectedHeader({ alg: ALGORITHM })
    .sign(privateKeyJWK);

  return jwtToken
}


/**
 * Generates the audience (aud) claim for JWT tokens.
 * This function mimics the docName generation in the Soul class.
 * 
 * @param {Object} params - The parameters for generating the audience.
 * @param {string} params.organizationSlug - The organization slug.
 * @param {string} params.blueprint - The blueprint name.
 * @param {string} params.soulId - The soul ID.
 * @returns {string} The generated audience string.
 */
export function audienceForJWT({
  organizationSlug,
  blueprint,
  soulId,
}: {
  organizationSlug: string,
  blueprint: string,
  soulId: string,
}): string {
  return `${organizationSlug}.${blueprint}.${soulId}`
}
