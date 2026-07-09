import { describe, it, expect, vi } from 'vitest';
import React, { useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal, { Confirm, useDialogA11y } from '../Modal.jsx';

describe('Modal', () => {
  it('renders title, sub, children and footer', () => {
    render(
      <Modal title="Edit" sub="details" onClose={() => {}} footer={<button>Save</button>}>
        <p>body content</p>
      </Modal>
    );
    expect(screen.getByText('Edit')).toBeInTheDocument();
    expect(screen.getByText('details')).toBeInTheDocument();
    expect(screen.getByText('body content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('closes via the X button and the backdrop', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal title="T" onClose={onClose}><p>x</p></Modal>);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(container.querySelector('.modal-scrim'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when clicking inside the dialog', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}><p>inside</p></Modal>);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}><p>x</p></Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('ignores keys other than Tab/Escape', () => {
    const onClose = vi.fn();
    render(<Modal title="T" onClose={onClose}><p>x</p></Modal>);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'a' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('while busy, the backdrop and Escape cannot dismiss it and Close is disabled', () => {
    const onClose = vi.fn();
    const { container } = render(<Modal title="T" busy onClose={onClose}><p>x</p></Modal>);
    fireEvent.click(container.querySelector('.modal-scrim'));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Close' })).toBeDisabled();
  });

  it('traps Tab focus at both ends', () => {
    render(
      <Modal title="T" onClose={() => {}}>
        <button>one</button>
        <button>two</button>
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    const focusables = dialog.querySelectorAll('button');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    last.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    first.focus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});

describe('useDialogA11y skipInitialFocus', () => {
  function Harness({ onClose }) {
    const ref = useRef(null);
    useDialogA11y(ref, onClose, { skipInitialFocus: true });
    return <div ref={ref}><button>inner</button></div>;
  }

  it('does not steal initial focus but still handles Escape', () => {
    const onClose = vi.fn();
    const { container } = render(<Harness onClose={onClose} />);
    // initial focus was not forced onto the inner button
    expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'inner' }));
    fireEvent.keyDown(container.firstChild, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Confirm', () => {
  it('renders and wires cancel/confirm', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<Confirm title="Delete?" message="This cannot be undone" onCancel={onCancel} onConfirm={onConfirm} />);
    expect(screen.getByText('Delete?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onCancel).toHaveBeenCalled();
    expect(onConfirm).toHaveBeenCalled();
  });

  it('shows a busy label, disables actions, renders an error and danger styling', () => {
    render(
      <Confirm title="Delete?" message="msg" danger busy error="Failed" confirmLabel="Delete"
        onCancel={() => {}} onConfirm={() => {}} />
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  });
});
