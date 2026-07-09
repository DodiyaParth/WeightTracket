import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/motivation.js', () => ({
  getMessage: () => ({ label: 'On track', emoji: '🔥', title: 'Nice work', body: 'Keep going.' }),
}));
vi.mock('../../lib/format.js', () => ({
  formatChange: (n) => ({ tone: 'down', glyph: '▼', text: `${Math.abs(n)} kg`, aria: `down ${Math.abs(n)} kg` }),
}));

import MotivationCard from '../MotivationCard.jsx';

const person = { name: 'Parth' };

describe('MotivationCard', () => {
  it('renders the person, message, and the next-milestone hint at low progress', () => {
    render(<MotivationCard person={person} state={{}} milestone5={2} milestone10={4} progress={0} />);
    expect(screen.getByText('For Parth')).toBeInTheDocument();
    expect(screen.getByText('Nice work')).toBeInTheDocument();
    expect(screen.getByText(/Next milestone: 5%/)).toBeInTheDocument();
  });

  it('marks the 5% milestone done and points to 10% next at mid progress', () => {
    render(<MotivationCard person={person} state={{}} milestone5={2} milestone10={4} progress={0.6} />);
    expect(screen.getByText(/Next milestone: 10%/)).toBeInTheDocument();
  });

  it('marks both milestones done at full progress', () => {
    const { container } = render(
      <MotivationCard person={person} state={{}} milestone5={2} milestone10={4} progress={1} />
    );
    expect(container.querySelectorAll('.milestone.done').length).toBe(2);
  });
});
