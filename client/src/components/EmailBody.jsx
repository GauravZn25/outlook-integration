import { useMemo, useRef } from 'react';

const FRAME_STYLES = `
  body { margin: 0; padding: 20px; font: 14px/1.55 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
         color: #1c1f23; background: #fff; overflow-wrap: anywhere; }
  img { max-width: 100%; height: auto; }
  pre.plain { margin: 0; white-space: pre-wrap; font: inherit; }
`;

function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}

function buildDocument(body) {
  const content =
    body.contentType === 'html' ? body.content : `<pre class="plain">${escapeHtml(body.content)}</pre>`;
  // <base target="_blank"> makes every link in the email open in a new tab.
  return `<!doctype html><html><head><meta charset="utf-8"><base target="_blank"><style>${FRAME_STYLES}</style></head><body>${content}</body></html>`;
}

// Shows the email in a sandboxed frame: its own styles can't leak into the page
// and any scripts inside the email are blocked.
export default function EmailBody({ body }) {
  const frameRef = useRef(null);
  const srcDoc = useMemo(() => buildDocument(body), [body]);

  function fitToContent() {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (doc) frame.style.height = `${doc.documentElement.scrollHeight}px`;
  }

  return (
    <iframe
      ref={frameRef}
      className="email-body"
      title="Email content"
      sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
      srcDoc={srcDoc}
      onLoad={fitToContent}
    />
  );
}
