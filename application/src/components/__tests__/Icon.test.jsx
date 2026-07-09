import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Icon, { Logo, Avatar, AvatarStack, GoogleG } from '../Icon.jsx';

describe('Icon', () => {
  it('renders path segments for a known name', () => {
    const { container } = render(<Icon name="home" />);
    expect(container.querySelectorAll('path').length).toBeGreaterThan(0);
  });

  it('renders circles for names that need them', () => {
    const { container } = render(<Icon name="user" />);
    expect(container.querySelectorAll('circle').length).toBeGreaterThan(0);
  });

  it('renders an empty svg for an unknown name', () => {
    const { container } = render(<Icon name="does-not-exist" />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelectorAll('path').length).toBe(0);
    expect(container.querySelectorAll('circle').length).toBe(0);
  });
});

describe('Logo / Avatar / AvatarStack / GoogleG', () => {
  it('renders the logo', () => {
    const { container } = render(<Logo size={40} />);
    expect(container.querySelector('.logo')).toBeTruthy();
  });

  it('renders an avatar, with and without a ring', () => {
    const { container, rerender } = render(<Avatar color="#fff">PD</Avatar>);
    expect(container.querySelector('.avatar')).toBeTruthy();
    expect(container.querySelector('.avatar.ring')).toBeFalsy();
    rerender(<Avatar ring>PD</Avatar>);
    expect(container.querySelector('.avatar.ring')).toBeTruthy();
  });

  it('shows a +N chip when there are more members than max', () => {
    const members = [
      { initial: 'A', color: '#1' }, { initial: 'B', color: '#2' },
      { initial: 'C', color: '#3' }, { initial: 'D', color: '#4' }, { initial: 'E', color: '#5' },
    ];
    const { getByText } = render(<AvatarStack members={members} max={3} />);
    expect(getByText('+2')).toBeInTheDocument();
  });

  it('shows no chip when members fit within max', () => {
    const members = [{ initial: 'A', color: '#1' }, { initial: 'B', color: '#2' }];
    const { container } = render(<AvatarStack members={members} max={3} />);
    expect(container.textContent).not.toContain('+');
  });

  it('renders the Google G', () => {
    const { container } = render(<GoogleG />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
