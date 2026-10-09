import { displayName, formatFullDate } from '../format.js';
import AttachmentList from './AttachmentList.jsx';
import Avatar from './Avatar.jsx';
import EmailBody from './EmailBody.jsx';
import { BackIcon, ExternalIcon, MailIcon } from './Icons.jsx';

function BackButton({ onBack }) {
  return (
    <button type="button" className="back-button" onClick={onBack}>
      <BackIcon /> Back to list
    </button>
  );
}

function people(list) {
  return list.map((person) => displayName(person)).join(', ');
}

export default function MessageView({ selection, onBack }) {
  if (!selection) {
    return (
      <section className="reader reader-empty">
        <MailIcon size={40} />
        <p>Select an email to read it</p>
      </section>
    );
  }

  const { loading, error, message } = selection;

  if (loading || error) {
    return (
      <section className="reader">
        <BackButton onBack={onBack} />
        {loading ? <p className="muted">Loading email…</p> : <div className="error">{error}</div>}
      </section>
    );
  }

  return (
    <section className="reader" aria-label="Email">
      <BackButton onBack={onBack} />
      <h2 className="reader-subject">{message.subject || '(no subject)'}</h2>

      <div className="reader-meta">
        <Avatar person={message.from} size={44} />
        <div className="reader-people">
          <div>
            <strong>{displayName(message.from)}</strong>
            {message.from.name && message.from.address && (
              <span className="muted"> &lt;{message.from.address}&gt;</span>
            )}
          </div>
          {message.to.length > 0 && <div className="muted">To: {people(message.to)}</div>}
          {message.cc.length > 0 && <div className="muted">Cc: {people(message.cc)}</div>}
          <div className="muted">{formatFullDate(message.receivedDateTime)}</div>
        </div>
        {message.webLink && (
          <a className="button small" href={message.webLink} target="_blank" rel="noreferrer">
            <ExternalIcon size={14} /> Open in Outlook
          </a>
        )}
      </div>

      <AttachmentList
        messageId={message.id}
        attachments={message.attachments}
        webLink={message.webLink}
      />

      <EmailBody body={message.body} />
    </section>
  );
}
