import { describe, it, expect } from "bun:test";
import { exportJWK, generateKeyPair } from 'jose'
import { issueToken, JWTOptions } from "../src/jwt-auth.ts";

describe("JWT Auth Tests", () => {
  it("issues a valid JWT token", async () => {
    const { publicKey, privateKey } = await generateKeyPair('ES256', { extractable: true });

    const options: JWTOptions = {
      privateKey: Buffer.from(JSON.stringify(await exportJWK(privateKey))).toString('base64'),
      issuer: "test-issuer",
      payload: {
        aud: "test-audience",
        sub: "test-subject"
      }
    };

    const token = await issueToken(options);

    expect(typeof token).toBe('string');
    expect(token.split('.').length).toBe(3); // Header, Payload, Signature

    // Verify the token using the public key
    const { jwtVerify } = await import('jose');
    
    try {
      const { payload, protectedHeader } = await jwtVerify(token, publicKey, {
        issuer: "test-issuer",
        audience: "test-audience",
      });
      
      expect(typeof payload).toBe('object');
      expect(typeof protectedHeader).toBe('object');
      expect(protectedHeader.alg).toBe('ES256');
    } catch (error) {
      throw new Error('Token verification should not throw an error');
    }
  });

  it("includes correct claims in the token", async () => {
    const { privateKey } = await generateKeyPair('ES256', { extractable: true });

    const options: JWTOptions = {
      privateKey: await exportJWK(privateKey),
      issuer: "test-issuer",
      payload: {
        aud: "test-audience",
        sub: "test-subject",
        customClaim: "custom-value"
      }
    };

    const token = await issueToken(options);

    const [, payloadBase64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());

    expect(payload.iss).toBe("test-issuer");
    expect(payload.aud).toBe("test-audience");
    expect(payload.sub).toBe("test-subject");
    expect(payload.customClaim).toBe("custom-value");
    expect(typeof payload.iat).toBe('number');
    expect(typeof payload.exp).toBe('number');
  });
});
