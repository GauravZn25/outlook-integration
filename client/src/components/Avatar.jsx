const COLORS = ['#0f6cbd', '#8764b8', '#b4009e', '#c50f1f', '#ca5010', '#498205', '#038387', '#4f6bed'];

// A colored circle with the sender's initials.
export default function Avatar({ person, size = 36 }) {
  const label = person?.name || person?.address || '?';
  const initials = label
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  let hash = 0;
  for (const char of label) hash = (hash * 31 + char.charCodeAt(0)) | 0;

  return (
    <span
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: COLORS[Math.abs(hash) % COLORS.length],
      }}
      aria-hidden="true"
    >
      {initials || '?'}
    </span>
  );
}
