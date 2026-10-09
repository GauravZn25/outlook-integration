import { useCallback, useEffect, useRef, useState } from 'react';
import { getFolders, getMessage, getMessages, getStatus } from './api.js';
import FolderList from './components/FolderList.jsx';
import { MailIcon, RefreshIcon } from './components/Icons.jsx';
import MessageList from './components/MessageList.jsx';
import MessageView from './components/MessageView.jsx';

const EMPTY_LIST = { messages: [], hasMore: false, loading: false, error: '' };

function ConnectHelp({ message }) {
  return (
    <div className="connect-help">
      <MailIcon size={40} />
      <h2>No mailbox connected yet</h2>
      {message && <p className="error">{message}</p>}
      <ol>
        <li>
          Open a terminal in the <code>server</code> folder and run <code>npm run connect</code>.
        </li>
        <li>Send the message it prints (a link and a code) to the mailbox owner.</li>
        <li>
          When the terminal says <strong>✓ Connected</strong>, click <strong>Refresh</strong> above.
        </li>
      </ol>
    </div>
  );
}

export default function App() {
  const [status, setStatus] = useState({ loading: true, connected: false, mailbox: null, message: '' });
  const [folders, setFolders] = useState([]);
  const [inboxId, setInboxId] = useState(null);
  const [folderId, setFolderId] = useState(null);
  const [attachmentsOnly, setAttachmentsOnly] = useState(false);
  const [list, setList] = useState(EMPTY_LIST);
  const [selection, setSelection] = useState(null); // { id, loading, message, error }
  const [refreshKey, setRefreshKey] = useState(0);
  const [error, setError] = useState('');

  // Identifies the list currently on screen, so late responses for an older one are ignored.
  const listKeyRef = useRef('');

  const handleError = useCallback((err) => {
    if (err.needsConnect) {
      setStatus({ loading: false, connected: false, mailbox: null, message: err.message });
    }
    return err.message;
  }, []);

  // Connection status and folders: on page load and on every Refresh.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setError('');
      try {
        const current = await getStatus();
        if (cancelled) return;
        setStatus({ loading: false, message: '', ...current });
        if (!current.connected) return;

        const data = await getFolders();
        if (cancelled) return;
        setFolders(data.folders);
        setInboxId(data.inboxId);
        setFolderId((id) => id ?? data.inboxId);
      } catch (err) {
        if (cancelled) return;
        setStatus((s) => ({ ...s, loading: false }));
        setError(handleError(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [refreshKey, handleError]);

  // Emails of the selected folder: when the folder or filter changes, and on Refresh.
  useEffect(() => {
    if (!folderId) return;

    const scope = `${folderId}|${attachmentsOnly}`;
    const key = `${scope}|${refreshKey}`;
    const sameScope = listKeyRef.current.startsWith(`${scope}|`);
    listKeyRef.current = key;

    // Keep the current emails visible during a Refresh; clear them when switching folders.
    setList((current) => ({ ...(sameScope ? current : EMPTY_LIST), loading: true, error: '' }));

    getMessages({ folderId, attachmentsOnly })
      .then((data) => {
        if (listKeyRef.current === key) setList({ ...data, loading: false, error: '' });
      })
      .catch((err) => {
        if (listKeyRef.current === key) setList({ ...EMPTY_LIST, error: handleError(err) });
      });
  }, [folderId, attachmentsOnly, refreshKey, handleError]);

  async function loadMore() {
    const key = listKeyRef.current;
    setList((current) => ({ ...current, loading: true }));

    try {
      const data = await getMessages({ folderId, attachmentsOnly, skip: list.messages.length });
      if (listKeyRef.current !== key) return;
      setList((current) => {
        const seen = new Set(current.messages.map((m) => m.id));
        return {
          messages: [...current.messages, ...data.messages.filter((m) => !seen.has(m.id))],
          hasMore: data.hasMore,
          loading: false,
          error: '',
        };
      });
    } catch (err) {
      if (listKeyRef.current === key) {
        setList((current) => ({ ...current, loading: false, error: handleError(err) }));
      }
    }
  }

  function openMessage(id) {
    setSelection({ id, loading: true });
    getMessage(id)
      .then((message) => setSelection((current) => (current?.id === id ? { id, message } : current)))
      .catch((err) =>
        setSelection((current) => (current?.id === id ? { id, error: handleError(err) } : current))
      );
  }

  function selectFolder(id) {
    setFolderId(id);
    setSelection(null);
  }

  const busy = status.loading || list.loading;
  const folderTitle =
    folderId === 'all' ? 'All mail' : folders.find((f) => f.id === folderId)?.name || 'Inbox';

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <MailIcon size={22} />
          <span>Mailbox Viewer</span>
        </div>
        {status.mailbox && <span className="mailbox-chip">{status.mailbox}</span>}
        <button
          type="button"
          className="button primary"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={busy}
        >
          <RefreshIcon className={busy ? 'spin' : ''} />
          {busy ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {error && <div className="error banner">{error}</div>}

      {!status.loading && !status.connected ? (
        <ConnectHelp message={status.message} />
      ) : (
        <div className={`layout${selection ? ' reading' : ''}`}>
          <FolderList
            folders={folders}
            inboxId={inboxId}
            selectedId={folderId}
            onSelect={selectFolder}
          />
          <MessageList
            title={folderTitle}
            mailbox={status.mailbox}
            list={list}
            selectedId={selection?.id}
            onSelect={openMessage}
            onLoadMore={loadMore}
            attachmentsOnly={attachmentsOnly}
            onToggleAttachments={setAttachmentsOnly}
          />
          <MessageView selection={selection} onBack={() => setSelection(null)} />
        </div>
      )}
    </div>
  );
}
