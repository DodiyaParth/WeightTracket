// Small helpers for turning a Firebase user into display-friendly bits.

export function initialsOf(name?: string | null, email?: string | null): string {
  const n = (name || '').trim();
  if (n) {
    const parts = n.split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return '?';
}

export function firstNameOf(name?: string | null, email?: string | null): string {
  const n = (name || '').trim();
  if (n) return n.split(/\s+/)[0];
  if (email) return email.split('@')[0];
  return 'there';
}
