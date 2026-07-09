import React, { useState } from 'react';
import { Avatar } from './Icon.jsx';
import { initialsOf } from '../lib/user.js';

// Renders the user's Google profile photo when available, falling back to
// initials (also if the image fails to load).
export default function UserAvatar({ user, size = 40, color = 'var(--accent)' }) {
  const [broken, setBroken] = useState(false);

  if (user?.photoURL && !broken) {
    return (
      <span className="avatar" style={{ width: size, height: size, background: color, overflow: 'hidden' }}>
        <img
          src={user.photoURL}
          alt={user.displayName || 'You'}
          referrerPolicy="no-referrer"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }
  return (
    <Avatar size={size} color={color}>
      {initialsOf(user?.displayName, user?.email)}
    </Avatar>
  );
}
