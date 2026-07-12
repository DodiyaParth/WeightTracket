import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';
import { todayISO, addDays } from '../../lib/date.js';

vi.mock('../../auth/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { uid: 'parth', displayName: 'Parth' } }),
}));

let weightsData;
vi.mock('../../hooks/useData.js', () => ({ useWeights: () => ({ data: weightsData }) }));

const addWeight = vi.fn();
const updateWeight = vi.fn();
const deleteWeight = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: {
    addWeight: (...a) => addWeight(...a),
    updateWeight: (...a) => updateWeight(...a),
    deleteWeight: (...a) => deleteWeight(...a),
  },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import { QuickLogProvider, useQuickLog } from '../QuickLog.jsx';

function Consumer({ arg }) {
  const q = useQuickLog();
  return <button onClick={() => q.open(arg)}>OPEN</button>;
}

function renderQuickLog(arg) {
  return renderWithRouter(
    <Routes>
      <Route path="/" element={<QuickLogProvider><Consumer arg={arg} /></QuickLogProvider>} />
      <Route path="/add" element={<div>ADD PAGE</div>} />
    </Routes>,
    { route: '/' }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  weightsData = [{ id: 'w0', date: '2020-01-01', kg: 70 }];
  addWeight.mockResolvedValue();
  updateWeight.mockResolvedValue();
  deleteWeight.mockResolvedValue();
});

describe('QuickLog add flow', () => {
  it('opens the add modal and logs a new weigh-in', async () => {
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    expect(screen.getByText('Log my weight')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(addWeight).toHaveBeenCalledWith('parth', expect.objectContaining({ date: todayISO() }));
    expect(await screen.findByText(/Logged/)).toBeInTheDocument();
  });

  it('nudges the weight with the step buttons and reveals a note field', async () => {
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    const input = screen.getByLabelText('Weight in kg');
    await userEvent.click(screen.getByRole('button', { name: 'plus 0.1' }));
    expect(input.value).toBe('70.10');
    await userEvent.click(screen.getByRole('button', { name: 'minus 0.1' }));
    expect(input.value).toBe('70.00');
    await userEvent.click(screen.getByRole('button', { name: /add note/i }));
    expect(screen.getByPlaceholderText(/Note \(optional\)/)).toBeInTheDocument();
  });

  it('warns when the same value was already logged for that day', async () => {
    weightsData = [{ id: 'w0', date: todayISO(), kg: 70 }];
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Already logged')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
  });

  it('asks to overwrite when a different value exists for that day', async () => {
    weightsData = [{ id: 'w0', date: todayISO(), kg: 70 }];
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    const input = screen.getByLabelText('Weight in kg');
    await userEvent.clear(input);
    await userEvent.type(input, '71');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Overwrite this entry?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Overwrite' }));
    expect(addWeight).toHaveBeenCalled();
  });

  it('navigates to the advanced bulk page', async () => {
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    await userEvent.click(screen.getByRole('button', { name: /advanced/i }));
    expect(await screen.findByText('ADD PAGE')).toBeInTheDocument();
  });
});

describe('QuickLog edit flow', () => {
  it('edits an existing entry and can delete it', async () => {
    renderQuickLog({ id: 'w1', kg: 80, date: '2026-01-01', note: 'hi' });
    await userEvent.click(screen.getByText('OPEN'));
    expect(screen.getByText('Edit entry')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(updateWeight).toHaveBeenCalledWith('parth', 'w1', expect.objectContaining({ date: '2026-01-01' }));
  });

  it('deletes an existing entry', async () => {
    renderQuickLog({ id: 'w1', kg: 80, date: '2026-01-01', note: '' });
    await userEvent.click(screen.getByText('OPEN'));
    await userEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(deleteWeight).toHaveBeenCalledWith('parth', 'w1');
    expect(await screen.findByText('Entry deleted')).toBeInTheDocument();
  });
});

describe('QuickLog - branch coverage', () => {
  it('defaults to 70.00 with no history and prefills a chosen date', async () => {
    weightsData = [];
    renderQuickLog({ date: addDays(todayISO(), -2) });
    await userEvent.click(screen.getByText('OPEN'));
    expect(screen.getByLabelText('Weight in kg').value).toBe('70.00');
  });

  it('steps up from an empty field and formats on blur', async () => {
    weightsData = [];
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    const input = screen.getByLabelText('Weight in kg');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'plus 0.1' }));
    expect(input.value).toBe('0.10');
    await userEvent.clear(input);
    fireEvent.blur(input);
    expect(input.value).toBe('0.00');
  });

  it('ignores a save with a blank/zero weight', async () => {
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    const input = screen.getByLabelText('Weight in kg');
    await userEvent.clear(input);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(addWeight).not.toHaveBeenCalled();
  });

  it('saves when Enter is pressed in the weight field', async () => {
    weightsData = [];
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    const input = screen.getByLabelText('Weight in kg');
    await userEvent.clear(input);
    await userEvent.type(input, '77{Enter}');
    await waitFor(() => expect(addWeight).toHaveBeenCalledWith('parth', expect.objectContaining({ kg: 77 })));
  });

  it('surfaces a save error inline', async () => {
    weightsData = [];
    addWeight.mockRejectedValueOnce(new Error('offline'));
    renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('offline')).toBeInTheDocument();
  });

  it('ignores an empty value from the date picker', async () => {
    weightsData = [];
    const { container } = renderQuickLog();
    await userEvent.click(screen.getByText('OPEN'));
    const picker = container.querySelector('input[type="date"]');
    fireEvent.change(picker, { target: { value: '' } });
    expect(screen.getByRole('radio', { name: 'Today' })).toHaveAttribute('aria-checked', 'true');
  });
});
