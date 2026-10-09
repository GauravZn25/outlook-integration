import { InteractionRequiredAuthError, PublicClientApplication } from '@azure/msal-node';
import { config } from '../config.js';
import { TokenCache } from '../models/TokenCache.js';

// Read-only mail access. MSAL adds offline_access (refresh token), openid and
// profile automatically.
export const SCOPES = ['User.Read', 'Mail.Read'];

const CACHE_ID = 'msal-token-cache';
const KEEP_ALIVE_MS = 24 * 60 * 60 * 1000;

// The cache as this process last read it from (or wrote it to) MongoDB.
let lastSnapshot = null;

// Persist MSAL's token cache in MongoDB instead of memory, so the token the
// mailbox owner granted survives restarts and is shared with `npm run connect`.
const mongoCachePlugin = {
  async beforeCacheAccess(cacheContext) {
    const doc = await TokenCache.findById(CACHE_ID).lean();
    const snapshot = doc?.data ?? null;
    if (snapshot === lastSnapshot) return;

    // Another process (npm run connect / disconnect) changed the saved tokens.
    // MSAL merges on deserialize, so clear first or removed accounts would linger.
    msalClient.clearCache();
    if (snapshot) cacheContext.tokenCache.deserialize(snapshot);
    lastSnapshot = snapshot;
  },
  async afterCacheAccess(cacheContext) {
    if (!cacheContext.cacheHasChanged) return;
    lastSnapshot = cacheContext.tokenCache.serialize();
    await TokenCache.findByIdAndUpdate(CACHE_ID, { data: lastSnapshot }, { upsert: true });
  },
};

export const msalClient = new PublicClientApplication({
  auth: {
    clientId: config.azure.clientId,
    authority: config.azure.authority,
  },
  cache: { cachePlugin: mongoCachePlugin },
});

export class NotConnectedError extends Error {}

export async function getConnectedAccount() {
  const accounts = await msalClient.getTokenCache().getAllAccounts();
  return accounts[0] ?? null;
}

export async function removeAllAccounts({ except } = {}) {
  const cache = msalClient.getTokenCache();
  for (const account of await cache.getAllAccounts()) {
    if (account.homeAccountId !== except?.homeAccountId) {
      await cache.removeAccount(account);
    }
  }
}

// Returns a valid access token for the connected mailbox. MSAL renews it with
// the stored refresh token when it expires (every ~1 hour).
export async function getAccessToken({ forceRefresh = false } = {}) {
  const account = await getConnectedAccount();
  if (!account) {
    throw new NotConnectedError('No mailbox is connected yet. Run "npm run connect" in the server folder.');
  }

  try {
    const result = await msalClient.acquireTokenSilent({ account, scopes: SCOPES, forceRefresh });
    return { accessToken: result.accessToken, account };
  } catch (err) {
    if (err instanceof InteractionRequiredAuthError) {
      throw new NotConnectedError(
        'Access to the mailbox has expired or was revoked. Run "npm run connect" in the server folder again.'
      );
    }
    throw err;
  }
}

// Refresh tokens stop working after a long period without use (about 90 days).
// Renewing once a day keeps the mailbox connected while the server is running.
export function startTokenKeepAlive() {
  setInterval(async () => {
    try {
      if (await getConnectedAccount()) await getAccessToken({ forceRefresh: true });
    } catch (err) {
      console.error('Daily token renewal failed:', err.message);
    }
  }, KEEP_ALIVE_MS).unref();
}
