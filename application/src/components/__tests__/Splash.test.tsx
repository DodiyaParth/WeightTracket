import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Splash from '../Splash.jsx';

describe('Splash', () => {
  it('renders the default label', () => {
    render(<Splash />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders a custom label', () => {
    render(<Splash label="Signing in…" />);
    expect(screen.getByText('Signing in…')).toBeInTheDocument();
  });
});
