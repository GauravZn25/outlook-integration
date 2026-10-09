import { FolderIcon, InboxIcon, MailIcon } from './Icons.jsx';

export default function FolderList({ folders, inboxId, selectedId, onSelect }) {
  const item = (id, name, icon, unread) => (
    <button
      key={id}
      type="button"
      className={`folder${selectedId === id ? ' active' : ''}`}
      onClick={() => onSelect(id)}
    >
      {icon}
      <span className="folder-name">{name}</span>
      {unread > 0 && <span className="badge">{unread}</span>}
    </button>
  );

  return (
    <nav className="folders" aria-label="Folders">
      {item('all', 'All mail', <MailIcon />, 0)}
      {folders.map((folder) =>
        item(
          folder.id,
          folder.name,
          folder.id === inboxId ? <InboxIcon /> : <FolderIcon />,
          folder.unread
        )
      )}
    </nav>
  );
}
