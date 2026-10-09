const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const PAGE_SIZE = 30;
const MAX_INLINE_IMAGE_BYTES = 3 * 1024 * 1024;

// File types the browser can safely show in a new tab. Everything else is downloaded.
const PREVIEWABLE_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/bmp',
  'text/plain',
]);

// Used when Outlook labels a file as "application/octet-stream".
const TYPES_BY_EXTENSION = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  bmp: 'image/bmp',
  txt: 'text/plain',
};

export class GraphError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function buildQuery(params) {
  return Object.entries(params)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
}

async function graphFetch(accessToken, path, params) {
  const url = `${GRAPH_BASE}${path}${params ? `?${buildQuery(params)}` : ''}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new GraphError(
      res.status === 404 ? 404 : 502,
      `Microsoft Graph error ${res.status}: ${body.error?.message || res.statusText}`
    );
  }
  return res;
}

async function graphJson(accessToken, path, params) {
  const res = await graphFetch(accessToken, path, params);
  return res.json();
}

const toPerson = (recipient) => ({
  name: recipient?.emailAddress?.name || '',
  address: recipient?.emailAddress?.address || '',
});

function attachmentKind(attachment) {
  const type = attachment['@odata.type'] || '';
  if (type.includes('itemAttachment')) return 'item'; // an attached email/calendar item
  if (type.includes('referenceAttachment')) return 'reference'; // a OneDrive link
  return 'file';
}

function toAttachmentInfo(attachment) {
  const kind = attachmentKind(attachment);
  const name = attachment.name || 'attachment';
  let contentType = (attachment.contentType || '').split(';')[0].trim().toLowerCase();
  if (!contentType || contentType === 'application/octet-stream') {
    const extension = name.split('.').pop().toLowerCase();
    contentType = TYPES_BY_EXTENSION[extension] || 'application/octet-stream';
  }

  return {
    id: attachment.id,
    name,
    contentType,
    size: attachment.size || 0,
    kind,
    previewable: kind === 'file' && PREVIEWABLE_TYPES.has(contentType),
  };
}

// ---------- Folders ----------

export async function listFolders(accessToken) {
  const [list, inbox] = await Promise.all([
    graphJson(accessToken, '/me/mailFolders', {
      $top: 100,
      $select: 'id,displayName,totalItemCount,unreadItemCount',
    }),
    graphJson(accessToken, '/me/mailFolders/inbox', { $select: 'id' }),
  ]);

  const order = ['inbox', 'archive', 'sent items', 'drafts', 'junk email', 'deleted items'];
  const rank = (folder) => {
    if (folder.id === inbox.id) return -1;
    const index = order.indexOf(folder.name.toLowerCase());
    return index === -1 ? order.length : index;
  };

  const folders = list.value
    .map((folder) => ({
      id: folder.id,
      name: folder.displayName,
      total: folder.totalItemCount,
      unread: folder.unreadItemCount,
    }))
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return { folders, inboxId: inbox.id };
}

// ---------- Message list ----------

// folderId "all" lists every folder at once.
export async function listMessages(accessToken, { folderId, skip = 0, attachmentsOnly = false }) {
  const path =
    folderId === 'all' ? '/me/messages' : `/me/mailFolders/${encodeURIComponent(folderId)}/messages`;

  const data = await graphJson(accessToken, path, {
    $select: 'id,subject,from,toRecipients,receivedDateTime,bodyPreview,isRead,hasAttachments',
    // Graph requires the $orderby property to also appear (first) in $filter.
    $filter: attachmentsOnly
      ? 'receivedDateTime ge 1900-01-01T00:00:00Z and hasAttachments eq true'
      : undefined,
    $orderby: 'receivedDateTime desc',
    $top: PAGE_SIZE,
    $skip: skip,
  });

  return {
    messages: data.value.map((message) => ({
      id: message.id,
      subject: message.subject || '',
      from: toPerson(message.from),
      to: (message.toRecipients || []).map(toPerson),
      receivedDateTime: message.receivedDateTime,
      preview: message.bodyPreview || '',
      isRead: message.isRead,
      hasAttachments: message.hasAttachments,
    })),
    hasMore: Boolean(data['@odata.nextLink']),
  };
}

// ---------- Single message ----------

// Emails reference embedded pictures (logos, signatures) as "cid:..." links to
// their attachments. Swap those for the actual image data so they display.
async function embedInlineImages(accessToken, messagePath, html, attachments) {
  const candidates = attachments
    .filter(
      (a) =>
        attachmentKind(a) === 'file' &&
        a.contentType?.startsWith('image/') &&
        a.size <= MAX_INLINE_IMAGE_BYTES
    )
    .slice(0, 20);

  const fullAttachments = await Promise.all(
    candidates.map((a) =>
      graphJson(accessToken, `${messagePath}/attachments/${encodeURIComponent(a.id)}`)
    )
  );

  const embeddedIds = new Set();
  for (const attachment of fullAttachments) {
    const contentId = attachment.contentId?.replace(/^<|>$/g, '');
    const reference = `cid:${contentId}`;
    if (contentId && attachment.contentBytes && html.includes(reference)) {
      html = html
        .split(reference)
        .join(`data:${attachment.contentType};base64,${attachment.contentBytes}`);
      embeddedIds.add(attachment.id);
    }
  }
  return { html, embeddedIds };
}

export async function getMessage(accessToken, messageId) {
  const path = `/me/messages/${encodeURIComponent(messageId)}`;
  const [message, attachmentList] = await Promise.all([
    graphJson(accessToken, path, {
      $select: 'id,subject,from,toRecipients,ccRecipients,receivedDateTime,body,isRead,webLink',
    }),
    graphJson(accessToken, `${path}/attachments`, {
      $select: 'id,name,contentType,size,isInline',
    }),
  ]);

  const attachments = attachmentList.value;
  const body = {
    contentType: message.body?.contentType === 'html' ? 'html' : 'text',
    content: message.body?.content || '',
  };

  let embeddedIds = new Set();
  if (body.contentType === 'html' && body.content.includes('cid:')) {
    ({ html: body.content, embeddedIds } = await embedInlineImages(
      accessToken,
      path,
      body.content,
      attachments
    ));
  }

  return {
    id: message.id,
    subject: message.subject || '',
    from: toPerson(message.from),
    to: (message.toRecipients || []).map(toPerson),
    cc: (message.ccRecipients || []).map(toPerson),
    receivedDateTime: message.receivedDateTime,
    isRead: message.isRead,
    webLink: message.webLink,
    body,
    // Pictures already shown inside the email body are not listed again.
    attachments: attachments.filter((a) => !embeddedIds.has(a.id)).map(toAttachmentInfo),
  };
}

// ---------- Attachment file ----------

export async function getAttachmentFile(accessToken, messageId, attachmentId) {
  const path = `/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`;
  const info = toAttachmentInfo(
    await graphJson(accessToken, path, { $select: 'id,name,contentType,size,isInline' })
  );

  if (info.kind === 'reference') {
    throw new GraphError(400, 'This attachment is a cloud link. Open the email in Outlook to view it.');
  }

  const res = await graphFetch(accessToken, `${path}/$value`);
  const isItem = info.kind === 'item';

  return {
    ...info,
    name: isItem ? `${info.name}.eml` : info.name,
    contentType: isItem ? 'message/rfc822' : info.contentType,
    stream: res.body,
  };
}
