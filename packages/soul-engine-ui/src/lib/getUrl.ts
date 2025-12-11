// utils/getURL.ts
const IS_SERVER = typeof window === "undefined";

const serverUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export default function getURL(path: string) {
  const baseURL = IS_SERVER ? serverUrl : window.location.origin;
  return new URL(path, baseURL).toString();
}
