import { describe, it, expect } from 'vitest';
import { renderWithRouter, screen } from '../../test/test-utils.jsx';
import NotFound from '../NotFound.jsx';

describe('<NotFound>', () => {
  it('shows a 404 message and a link back to dashboards', () => {
    renderWithRouter(<NotFound />, { route: '/does-not-exist' });
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /back to dashboards/i })).toHaveAttribute('href', '/');
  });
});
