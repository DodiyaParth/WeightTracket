import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '../../test/test-utils.jsx';
import UserAvatar from '../UserAvatar.jsx';

describe('<UserAvatar>', () => {
  it('renders the profile photo when one is available', () => {
    render(
      <UserAvatar user={{ photoURL: 'https://example.com/p.jpg', displayName: 'Parth Dodiya' }} />
    );
    const img = screen.getByRole('img', { name: 'Parth Dodiya' });
    expect(img).toHaveAttribute('src', 'https://example.com/p.jpg');
  });

  it('falls back to initials when the image fails to load', () => {
    render(
      <UserAvatar user={{ photoURL: 'https://example.com/broken.jpg', displayName: 'Parth Dodiya' }} />
    );
    fireEvent.error(screen.getByRole('img'));
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('PD')).toBeInTheDocument();
  });

  it('renders initials from the email when there is no photo', () => {
    render(<UserAvatar user={{ email: 'sam@example.com' }} />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText('SA')).toBeInTheDocument();
  });
});
