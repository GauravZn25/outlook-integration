// One-time setup: get read-only access to the mailbox from its owner.
//
//   npm run connect     prints a code for the mailbox owner; saves their token in MongoDB
//   npm run disconnect  deletes the saved token
import { config } from '../src/config.js';
import { connectDb, disconnectDb } from '../src/db.js';
import { SCOPES, msalClient, removeAllAccounts } from '../src/services/msal.js';

const LINE = '─'.repeat(64);
const mailboxLabel = config.mailboxAddress || 'the mailbox';

class SetupError extends Error {}

function printInstructions({ verificationUri, userCode, expiresIn }) {
  // MSAL calls this with empty values when Microsoft rejects the request outright.
  if (!userCode) {
    throw new SetupError(
      'Microsoft did not return a sign-in code. Check that AZURE_CLIENT_ID in server/.env is correct\n' +
        '  and that the Azure app allows personal Microsoft accounts (README, Step 2).'
    );
  }

  const expiresAt = new Date(Date.now() + expiresIn * 1000).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });

  console.log(`
${LINE}
 Copy everything between the lines and send it to the owner of
 ${mailboxLabel} (WhatsApp, SMS, email...):
${LINE}

 Hi! Please give me read-only access to your Outlook email:

   1. Open this link: ${verificationUri}
   2. Enter this code: ${userCode}
   3. Sign in with ${mailboxLabel} and click "Accept".

 The code works once and expires at ${expiresAt} (in ${Math.round(expiresIn / 60)} minutes).
 You can remove the access any time at https://account.live.com/consent/Manage

${LINE}

Waiting for them to finish... (keep this window open)
`);
}

// MSAL only passes on Microsoft's short error code here (e.g. "invalid_client").
function explain(err) {
  const text = `${err.errorCode || ''} ${err.errorMessage || ''} ${err.message || ''}`;
  if (/invalid_client|AADSTS7000218/.test(text)) {
    return 'In Azure, open your app > Authentication, set "Allow public client flows" to Yes, click Save, and try again.';
  }
  if (/authorization_declined|access_denied/.test(text)) {
    return 'The mailbox owner declined the request. Run "npm run connect" again if that was a mistake.';
  }
  if (/expired_token|device_code_expired/.test(text)) {
    return 'The code expired before it was used. Run "npm run connect" again.';
  }
  return 'See "Troubleshooting" in README.md.';
}

async function connect() {
  console.log(`Asking Microsoft for a sign-in code for ${mailboxLabel}...`);

  let result;
  try {
    result = await msalClient.acquireTokenByDeviceCode({
      scopes: SCOPES,
      deviceCodeCallback: printInstructions,
    });
  } catch (err) {
    if (err instanceof SetupError) {
      console.error(`\n✗ ${err.message}`);
    } else {
      console.error(`\n✗ Connection failed: ${err.errorMessage || err.message}`);
      console.error(`  → ${explain(err)}`);
    }
    process.exitCode = 1;
    return;
  }

  const signedInAs = result.account.username.toLowerCase();
  if (config.mailboxAddress && signedInAs !== config.mailboxAddress) {
    await msalClient.getTokenCache().removeAccount(result.account);
    console.error(
      `\n✗ They signed in as ${signedInAs}, but MAILBOX_ADDRESS in server/.env is ${config.mailboxAddress}.\n` +
        '  Nothing was saved. Run "npm run connect" again and ask them to use the right account.'
    );
    process.exitCode = 1;
    return;
  }

  // Keep exactly one connected mailbox.
  await removeAllAccounts({ except: result.account });
  console.log(`\n✓ Connected ${signedInAs}. The token is saved in MongoDB.`);
  console.log('  Open the web page (http://localhost:5173) and click Refresh.');
}

async function disconnect() {
  await removeAllAccounts();
  console.log('✓ The saved mailbox token was deleted from MongoDB.');
}

const command = process.argv[2];
await connectDb();
try {
  if (command === 'connect') await connect();
  else if (command === 'disconnect') await disconnect();
  else console.error('Usage: npm run connect | npm run disconnect');
} finally {
  await disconnectDb();
}
