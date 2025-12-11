export * from './lib/setupAuth'

function shouldPolyfillWebsocket() {
  // Check if the code is running in a browser environment
  const isBrowser = typeof window !== 'undefined';

  // If it's not in a browser environment and it's Node.js but not Bun, return true
  return !isBrowser && typeof process !== 'undefined' && process.versions && !process.versions.bun;
}

const setupPolyfill = async () => {
  if (!('ws' in globalThis) && shouldPolyfillWebsocket()) {
    (globalThis as any)['ws'] = await import('ws');
  }
}

setupPolyfill();
