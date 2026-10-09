const SERVER_DOWN = 'Cannot reach the server. Is it running? (cd server && npm run dev)';

export class ApiError extends Error {
  constructor(message, status, data = {}) {
    super(message);
    this.status = status;
    this.needsConnect = Boolean(data.needsConnect);
  }
}

async function getJson(path) {
  let res;
  try {
    res = await fetch(path);
  } catch {
    throw new ApiError(SERVER_DOWN, 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The Vite proxy answers with an empty 5xx when the Express server is not running.
    const message = data.error || (res.status >= 500 ? SERVER_DOWN : `Request failed (${res.status}).`);
    throw new ApiError(message, res.status, data);
  }
  return data;
}

export const getStatus = () => getJson('/api/status');

export const getFolders = () => getJson('/api/folders');

export function getMessages({ folderId, skip = 0, attachmentsOnly = false }) {
  const params = new URLSearchParams({ folder: folderId, skip: String(skip) });
  if (attachmentsOnly) params.set('attachmentsOnly', '1');
  return getJson(`/api/messages?${params}`);
}

export const getMessage = (messageId) => getJson(`/api/messages/${encodeURIComponent(messageId)}`);

export function attachmentUrl(messageId, attachmentId, { download = false } = {}) {
  const url = `/api/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  return download ? `${url}?download=1` : url;
}
