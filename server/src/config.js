import 'dotenv/config';

const required = ['MONGODB_URI', 'AZURE_CLIENT_ID'];

// Treat the placeholder values from .env.example as "not filled in".
const missing = required.filter(
  (key) => !process.env[key] || process.env[key].startsWith('paste-your-')
);

if (missing.length) {
  console.error(
    `\nMissing settings in server/.env: ${missing.join(', ')}\n` +
      'Copy server/.env.example to server/.env and fill in these values.\n'
  );
  process.exit(1);
}

export const config = {
  port: Number(process.env.PORT) || 4000,
  mongoUri: process.env.MONGODB_URI,
  azure: {
    clientId: process.env.AZURE_CLIENT_ID.trim(),
    authority: process.env.AZURE_AUTHORITY || 'https://login.microsoftonline.com/consumers',
  },
  mailboxAddress: (process.env.MAILBOX_ADDRESS || '').trim().toLowerCase(),
};
