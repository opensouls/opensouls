import * as jose from 'jose';

class JWTManager {
  private local: boolean;
  private globalConfig: any;
  private organizationSlug: string;
  private rootUrl: string;

  constructor(local: boolean, organizationSlug: string, apiKey: string) {
    this.local = local;
    this.organizationSlug = organizationSlug;
    this.globalConfig = { get: (key: string) => key === "apiKey" ? apiKey : null };
    this.rootUrl = this.local ? "http://localhost:4000/api" : "https://servers.souls.chat/api";
  }

  public async listJWTs() {
    const url = `${this.rootUrl}/${this.organizationSlug}/jwt-public-keys`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.globalConfig.get("apiKey")}`,
          "Content-Type": "application/json"
        },
      });

      if (!response.ok) {
        console.error("Failed to fetch JWTs", { url, response: response.status, statusText: response.statusText });
        return;
      }

      const jwts = await response.json();
      return jwts;
    } catch (error) {
      console.error("Error fetching JWTs:", error);
      throw error
    }
  }
  public async createJWT(issuer: string) {
    const url = `${this.rootUrl}/${this.organizationSlug}/jwt-public-keys`;

    try {
      const { publicKey, privateKey } = await jose.generateKeyPair('ES256', { extractable: true });
      const publicKeyJwk = await jose.exportJWK(publicKey);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          "Authorization": `Bearer ${this.globalConfig.get("apiKey")}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ publicKey: JSON.stringify(publicKeyJwk), issuer })
      });

      if (!response.ok) {
        console.error("Failed to create JWT", { url, response: response.status, statusText: response.statusText });
        return;
      }

      const newJWT = await response.json();
      const privateKeyPem = Buffer.from(JSON.stringify(await jose.exportJWK(privateKey))).toString('base64');

      return { ...newJWT, privateKey: privateKeyPem };
    } catch (error) {
      console.error("Error creating JWT:", error);
      throw error
    }
  }

  public async deleteJWT(jwtId: string) {
    const url = `${this.rootUrl}/${this.organizationSlug}/jwt-public-keys/${jwtId}`;

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          "Authorization": `Bearer ${this.globalConfig.get("apiKey")}`,
          "Content-Type": "application/json"
        },
      });

      if (!response.ok) {
        console.error("Failed to delete JWT", { url, response: response.status, statusText: response.statusText });
        return false;
      }

      return true;
    } catch (error) {
      console.error("Error deleting JWT:", error);
      return false;
    }
  }
}

export default JWTManager;
