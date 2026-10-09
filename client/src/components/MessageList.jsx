import { displayName, formatListDate } from '../format.js';
import Avatar from './Avatar.jsx';
import { PaperclipIcon } from './Icons.jsx';

export default function MessageList({
  title,
  mailbox,
  list,
  selectedId,
  onSelect,
  onLoadMore,
  attachmentsOnly,
  onToggleAttachments,
}) {
  const { messages, hasMore, loading, error } = list;

  return (
    <section className="list-pane" aria-label="Emails">
      <div className="list-header">
        <h2>{title}</h2>
        <label className="toggle">
          <input
            type="checkbox"
            checked={attachmentsOnly}
            onChange={(e) => onToggleAttachments(e.target.checked)}
          />
          <PaperclipIcon size={14} /> With attachments
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      <ul className="messages">
        {messages.map((message) => {
          // For emails the mailbox sent itself, show who they went to.
          const sentByMailbox =
            mailbox && message.from.address.toLowerCase() === mailbox.toLowerCase();
          const person = sentByMailbox && message.to.length ? message.to[0] : message.from;

          return (
            <li key={message.id}>
              <button
                type="button"
                className={[
                  'message',
                  message.isRead ? '' : 'unread',
                  message.id === selectedId ? 'selected' : '',
                ].join(' ')}
                onClick={() => onSelect(message.id)}
              >
                <Avatar person={person} />
                <div className="message-summary">
                  <div className="message-row">
                    <span className="sender">
                      {sentByMailbox ? `To: ${displayName(person)}` : displayName(person)}
                    </span>
                    <time dateTime={message.receivedDateTime}>
                      {formatListDate(message.receivedDateTime)}
                    </time>
                  </div>
                  <div className="message-row">
                    <span className="subject">{message.subject || '(no subject)'}</span>
                    {message.hasAttachments && (
                      <PaperclipIcon size={14} className="clip" />
                    )}
                  </div>
                  <p className="preview">{message.preview}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {loading && <p className="list-status">Loading…</p>}
      {!loading && !error && messages.length === 0 && (
        <p className="list-status">No emails here.</p>
      )}
      {!loading && hasMore && (
        <button type="button" className="button load-more" onClick={onLoadMore}>
          Load more
        </button>
      )}
    </section>
  );
}
