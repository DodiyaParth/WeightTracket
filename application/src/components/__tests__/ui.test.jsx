import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';
import { Toggle, SegRadio, RoleBadge, ChangeText, RetryCard, Toast } from '../ui.jsx';

describe('Toggle', () => {
  it('reflects the on state via aria-checked and fires onClick', async () => {
    const onClick = vi.fn();
    renderWithRouter(<Toggle on onClick={onClick} label="Dark mode" />);
    const sw = screen.getByRole('switch', { name: 'Dark mode' });
    expect(sw).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(sw);
    expect(onClick).toHaveBeenCalled();
  });

  it('renders an off switch', () => {
    renderWithRouter(<Toggle on={false} label="Off" />);
    expect(screen.getByRole('switch', { name: 'Off' })).toHaveAttribute('aria-checked', 'false');
  });
});

describe('SegRadio', () => {
  const options = [['kg', 'kg'], ['lb', 'lb']];
  it('marks the selected option and calls onChange on click', async () => {
    const onChange = vi.fn();
    renderWithRouter(<SegRadio value="kg" onChange={onChange} options={options} ariaLabel="Units" />);
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(radios[1]);
    expect(onChange).toHaveBeenCalledWith('lb');
  });

  it('supports a disabled state', () => {
    renderWithRouter(<SegRadio value="kg" onChange={() => {}} options={options} ariaLabel="Units" disabled />);
    screen.getAllByRole('radio').forEach((r) => expect(r).toBeDisabled());
  });
});

describe('RoleBadge', () => {
  it.each(['owner', 'editor', 'viewer'])('renders a %s badge', (access) => {
    renderWithRouter(<RoleBadge access={access} />);
    expect(screen.getByText(new RegExp(access === 'viewer' ? 'view' : access, 'i'))).toBeInTheDocument();
  });

  it('falls back to viewer for an unknown access value', () => {
    renderWithRouter(<RoleBadge access="bogus" />);
    expect(screen.getByText(/view/i)).toBeInTheDocument();
  });
});

describe('ChangeText', () => {
  it('renders the glyph and text with an aria label', () => {
    renderWithRouter(<ChangeText change={{ tone: 'down', glyph: '▼', text: '2.0 kg', aria: 'down 2 kg' }} />);
    expect(screen.getByLabelText('down 2 kg')).toBeInTheDocument();
    expect(screen.getByText(/2\.0 kg/)).toBeInTheDocument();
  });
});

describe('RetryCard', () => {
  it('renders the retry button and fires onRetry', async () => {
    const onRetry = vi.fn();
    renderWithRouter(<RetryCard onRetry={onRetry} />);
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalled();
  });

  it('omits the button when no onRetry is given and uses custom copy', () => {
    renderWithRouter(<RetryCard title="Nope" message="Bad" />);
    expect(screen.getByText('Nope')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('Toast', () => {
  it('renders its children', () => {
    renderWithRouter(<Toast>Saved</Toast>);
    expect(screen.getByText('Saved')).toBeInTheDocument();
  });
});
