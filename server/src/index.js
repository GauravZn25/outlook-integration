import express from 'express';
import { config } from './config.js';
import { connectDb } from './db.js';
import apiRoutes from './routes/api.js';
import { getConnectedAccount, startTokenKeepAlive } from './services/msal.js';

const app = express();

app.use('/api', apiRoutes);

// Express 5 forwards errors from async route handlers here.
app.use((err, req, res, next) => {
  console.error(err);
  if (res.headersSent) return next(err);
  res.status(err.status || 500).json({ error: err.message || 'Something went wrong on the server.' });
});

await connectDb();
console.log('Connected to MongoDB');

const account = await getConnectedAccount();
console.log(
  account
    ? `Mailbox connected: ${account.username}`
    : 'No mailbox connected yet. Run "npm run connect" in another terminal.'
);
startTokenKeepAlive();

app.listen(config.port, () => {
  console.log(`Server running on http://localhost:${config.port}`);
});
