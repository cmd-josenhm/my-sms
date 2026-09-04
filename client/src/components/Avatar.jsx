export default function Avatar({ user, size = 48, showStatus = false, className = '' }) {
  const name = user?.displayName || '';
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';
  return (
    <span
      className={`avatar ${className}`}
      style={{
        width: size,
        height: size,
        background: user?.avatarColor || '#64748b',
        fontSize: Math.round(size * 0.36),
      }}
      title={name || undefined}
    >
      <span className="avatar-initials">{initials}</span>
      {showStatus && Boolean(user?.online) && <span className="avatar-status" aria-label="en ligne" />}
    </span>
  );
}
