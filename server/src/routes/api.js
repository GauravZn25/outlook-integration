import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { Router } from 'express';
import { getAttachmentFile, getMessage, listFolders, listMessages } from '../services/graph.js';
import { NotConnectedError, getAccessToken, getConnectedAccount } from '../services/msal.js';

const router = Router();

// Is a mailbox connected, and which one?
router.get('/status', async (req, res) => {
  const account = await getConnectedAccount();
  res.json({ connected: Boolean(account), mailbox: account?.username ?? null });
});

// Every route below needs a valid Microsoft access token.
router.use(async (req, res, next) => {
  try {
    const { accessToken } = await getAccessToken();
    req.accessToken = accessToken;
    next();
  } catch (err) {
    if (err instanceof NotConnectedError) {
      return res.status(401).json({ needsConnect: true, error: err.message });
    }
    next(err);
  }
});

router.get('/folders', async (req, res) => {
  res.json(await listFolders(req.accessToken));
});

// ?folder=<folder id | "all">&skip=<number>&attachmentsOnly=1
router.get('/messages', async (req, res) => {
  const result = await listMessages(req.accessToken, {
    folderId: req.query.folder || 'inbox',
    skip: Math.max(0, Number.parseInt(req.query.skip, 10) || 0),
    attachmentsOnly: req.query.attachmentsOnly === '1',
  });
  res.json(result);
});

router.get('/messages/:messageId', async (req, res) => {
  res.json(await getMessage(req.accessToken, req.params.messageId));
});

// Opens the file in the browser when it is safe to preview (PDF, images, text);
// add ?download=1 to always download it.
router.get('/messages/:messageId/attachments/:attachmentId', async (req, res) => {
  const file = await getAttachmentFile(req.accessToken, req.params.messageId, req.params.attachmentId);
  const inline = file.previewable && req.query.download !== '1';

  res.set({
    // Downloads are sent as plain bytes so the browser never tries to render them.
    'Content-Type': inline ? file.contentType : 'application/octet-stream',
    'Content-Disposition': contentDisposition(inline ? 'inline' : 'attachment', file.name),
    'X-Content-Type-Options': 'nosniff',
  });

  try {
    await pipeline(Readable.fromWeb(file.stream), res);
  } catch (err) {
    // The browser closed the connection mid-download; nothing to report.
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw err;
  }
});

function contentDisposition(type, filename) {
  const asciiName = filename.replace(/[^\x20-\x7e]|["\\]/g, '_');
  const encodedName = encodeURIComponent(filename).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `${type}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
}

export default router;
