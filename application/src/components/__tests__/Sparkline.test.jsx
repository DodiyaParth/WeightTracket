import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Sparkline from '../Sparkline.jsx';

describe('Sparkline', () => {
  it('renders an empty svg (no path) when there are fewer than two points', () => {
    const { container } = render(<Sparkline data={[80]} />);
    expect(container.querySelector('svg')).toBeTruthy();
    expect(container.querySelector('path')).toBeFalsy();
  });

  it('renders an empty svg when data is missing entirely', () => {
    const { container } = render(<Sparkline data={null} />);
    expect(container.querySelector('path')).toBeFalsy();
  });

  it('draws a path for two or more points', () => {
    const { container } = render(<Sparkline data={[80, 79, 81, 78]} />);
    const path = container.querySelector('path');
    expect(path).toBeTruthy();
    expect(path.getAttribute('d')).toMatch(/^M /);
  });

  it('handles a flat series without dividing by zero', () => {
    const { container } = render(<Sparkline data={[70, 70, 70]} />);
    expect(container.querySelector('path').getAttribute('d')).not.toContain('NaN');
  });
});
