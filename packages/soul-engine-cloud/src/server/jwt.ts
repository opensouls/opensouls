import { JWTPayload } from "hono/utils/jwt/types";
import { createLocalJWKSet, JWK, jwtVerify, JWTVerifyOptions } from "jose";

function isValidJWTFormat(token: string): boolean {
  // Check if the token is a non-empty string
  if (typeof token !== 'string' || token.trim() === '') {
    return false;
  }

  // Check if the token consists of three parts separated by dots
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }
  
  return true
}

export function isJWT(token: string): boolean {
  if (!isValidJWTFormat(token)) {
    return false;
  }

  try {
    // Attempt to decode the JWT header
    const [headerBase64] = token.split('.');
    const decodedHeader = Buffer.from(headerBase64, 'base64').toString('utf-8');
    const header = JSON.parse(decodedHeader);

    // Check if it has typical JWT header fields
    if (!header.alg) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

export function issFromToken(token: string) {
  const [, payloadBase64] = token.split('.');
  const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
  const payload = JSON.parse(decodedPayload);
  return payload.iss;
}

export function orgFromToken(token: string) {
  const [, payloadBase64] = token.split('.');
  const decodedPayload = Buffer.from(payloadBase64, 'base64').toString('utf-8');
  const payload = JSON.parse(decodedPayload);
  return payload['urn:org'];
}

export async function validateJWT(token: string, jwks: JWK[], verifyOpts: JWTVerifyOptions = {}): Promise<JWTPayload | false> {
  try {    
    for (const jwk of jwks) {
      try {
        const { payload } = await jwtVerify(token, createLocalJWKSet({ keys: [jwk] }), {
          clockTolerance: 2 * 60, // 2 minutes tolerance for clock skew if not provided
          ...verifyOpts,
        })
        if (payload) {
          return payload;
        }
      } catch (err) {
        console.warn("failed to verify with jwk", jwk, err)
        continue
      }
    }

    return false
  } catch (err) {
    console.error('error validating jwt', err)
    return false
  }
}
