import { attachmentUrl } from '../api.js';
import { fileExtension, formatSize } from '../format.js';
import { DownloadIcon, ExternalIcon } from './Icons.jsx';

const BADGE_COLORS = {
  pdf: 'red',
  doc: 'blue',
  docx: 'blue',
  rtf: 'blue',
  xls: 'green',
  xlsx: 'green',
  csv: 'green',
  ppt: 'orange',
  pptx: 'orange',
  png: 'purple',
  jpg: 'purple',
  jpeg: 'purple',
  gif: 'purple',
  webp: 'purple',
  zip: 'gray',
  rar: 'gray',
  '7z': 'gray',
};

export default function AttachmentList({ messageId, attachments, webLink }) {
  if (!attachments.length) return null;

  return (
    <section className="attachments" aria-label="Attachments">
      <h3>
        {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
      </h3>
      <ul>
        {attachments.map((attachment) => {
          const extension = attachment.kind === 'item' ? 'eml' : fileExtension(attachment.name);

          return (
            <li key={attachment.id} className="attachment">
              <span className={`file-badge ${BADGE_COLORS[extension] || 'gray'}`}>
                {extension || 'file'}
              </span>
              <div className="attachment-info">
                <span className="attachment-name" title={attachment.name}>
                  {attachment.name}
                </span>
                <span className="muted">
                  {attachment.kind === 'reference' ? 'Cloud file' : formatSize(attachment.size)}
                </span>
              </div>
              <div className="attachment-actions">
                {attachment.kind === 'reference' ? (
                  <a className="button small" href={webLink} target="_blank" rel="noreferrer">
                    <ExternalIcon size={14} /> Open in Outlook
                  </a>
                ) : (
                  <>
                    {attachment.previewable && (
                      <a
                        className="button small"
                        href={attachmentUrl(messageId, attachment.id)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalIcon size={14} /> Open
                      </a>
                    )}
                    <a
                      className="button small"
                      href={attachmentUrl(messageId, attachment.id, { download: true })}
                      download
                    >
                      <DownloadIcon size={14} /> Download
                    </a>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
