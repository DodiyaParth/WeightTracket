import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, within, waitFor } from '@testing-library/react';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';
import { todayISO } from '../../lib/date.js';

vi.mock('../../components/Layout.jsx', () => ({
  default: ({ title, children }) => <div><h1>{title}</h1>{children}</div>,
}));

let quick;
let weightsData;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: { uid: 'parth' } }) }));
vi.mock('../../components/QuickLog.jsx', () => ({ useQuickLog: () => quick }));
vi.mock('../../hooks/useData.js', () => ({ useWeights: () => ({ data: weightsData }) }));

const addWeight = vi.fn();
const addWeights = vi.fn();
const deleteWeight = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: {
    addWeight: (...a) => addWeight(...a),
    addWeights: (...a) => addWeights(...a),
    deleteWeight: (...a) => deleteWeight(...a),
  },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import AddWeight from '../AddWeight.jsx';

const weightInputs = (container) => container.querySelectorAll('input[aria-invalid]');

beforeEach(() => {
  vi.clearAllMocks();
  quick = { open: vi.fn() };
  weightsData = [];
  addWeight.mockResolvedValue();
  addWeights.mockImplementation((_uid, arr) => Promise.resolve(arr.length));
  deleteWeight.mockResolvedValue();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('AddWeight shell', () => {
  it('renders tabs and switches between them', async () => {
    renderWithRouter(<AddWeight />);
    expect(screen.getByText('Add a weigh-in')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Bulk backfill' }));
    expect(screen.getByText('Backfill past entries')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'CSV import' }));
    expect(screen.getByText('Import from CSV')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Single entry' }));
    expect(screen.getByText('Add a weigh-in')).toBeInTheDocument();
  });

  it('shows recent entries with edit/delete and an empty state', async () => {
    weightsData = [{ id: 'w1', date: todayISO(), kg: 80, note: 'am' }];
    renderWithRouter(<AddWeight />);
    await userEvent.click(screen.getByRole('button', { name: /^Edit entry on/ }));
    expect(quick.open).toHaveBeenCalledWith(weightsData[0]);

    await userEvent.click(screen.getByRole('button', { name: /^Delete entry on/ }));
    expect(screen.getByText('Delete this entry?')).toBeInTheDocument();
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(deleteWeight).toHaveBeenCalledWith('parth', 'w1');
  });

  it('shows an empty recents message', () => {
    renderWithRouter(<AddWeight />);
    expect(screen.getByText(/No entries yet/)).toBeInTheDocument();
  });
});

describe('AddWeight - Single', () => {
  it('saves a valid entry', async () => {
    renderWithRouter(<AddWeight />);
    await userEvent.type(screen.getByPlaceholderText('83.2'), '75');
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));
    expect(addWeight).toHaveBeenCalledWith('parth', expect.objectContaining({ kg: 75, date: todayISO() }));
    expect(await screen.findByText(/Logged/)).toBeInTheDocument();
  });

  it('warns when the same weight is already logged for the day', async () => {
    weightsData = [{ id: 'e1', date: todayISO(), kg: 80 }];
    renderWithRouter(<AddWeight />);
    await userEvent.type(screen.getByPlaceholderText('83.2'), '80');
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));
    expect(screen.getByText('Already logged')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
  });

  it('offers to overwrite a conflicting entry', async () => {
    weightsData = [{ id: 'e1', date: todayISO(), kg: 80 }];
    renderWithRouter(<AddWeight />);
    await userEvent.type(screen.getByPlaceholderText('83.2'), '81');
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));
    expect(screen.getByText('Overwrite this entry?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Overwrite' }));
    expect(addWeight).toHaveBeenCalledWith('parth', expect.objectContaining({ kg: 81 }));
  });

  it('ignores empty/invalid input', async () => {
    renderWithRouter(<AddWeight />);
    await userEvent.click(screen.getByRole('button', { name: /save entry/i }));
    expect(addWeight).not.toHaveBeenCalled();
  });
});

describe('AddWeight - Bulk', () => {
  async function goBulk() {
    const view = renderWithRouter(<AddWeight />);
    await userEvent.click(screen.getByRole('button', { name: 'Bulk backfill' }));
    return view;
  }

  it('saves filled rows', async () => {
    const { container } = await goBulk();
    const inputs = weightInputs(container);
    await userEvent.type(inputs[0], '72');
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 entry/ }));
    expect(addWeights).toHaveBeenCalledWith('parth', [expect.objectContaining({ kg: 72 })]);
    expect(await screen.findByText(/Saved 1 entry/)).toBeInTheDocument();
  });

  it('flags a non-numeric weight', async () => {
    const { container } = await goBulk();
    await userEvent.type(weightInputs(container)[0], 'abc');
    expect(screen.getByText('Not a number')).toBeInTheDocument();
  });

  it('adds a row', async () => {
    const { container } = await goBulk();
    const before = weightInputs(container).length;
    await userEvent.click(screen.getByRole('button', { name: /add row/i }));
    expect(weightInputs(container).length).toBe(before + 1);
  });

  it('surfaces the batch collision dialog and overwrites', async () => {
    weightsData = [{ id: 'e1', date: todayISO(), kg: 70 }];
    const { container } = await goBulk();
    // Today's row was prefilled to the existing 70 — change it to force a conflict.
    const first = weightInputs(container)[0];
    await userEvent.clear(first);
    await userEvent.type(first, '71');
    await userEvent.click(screen.getByRole('button', { name: /^Save 1 entry/ }));
    expect(await screen.findByText('Some dates already have an entry')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /^Overwrite/ }));
    await waitFor(() => expect(addWeights).toHaveBeenCalledWith('parth', [expect.objectContaining({ kg: 71 })]));
  });
});

describe('AddWeight - CSV', () => {
  async function goCsv() {
    const view = renderWithRouter(<AddWeight />);
    await userEvent.click(screen.getByRole('button', { name: 'CSV import' }));
    return view;
  }

  it('downloads the template', async () => {
    await goCsv();
    await userEvent.click(screen.getByRole('button', { name: /download template/i }));
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it('parses an uploaded file and imports the entries', async () => {
    const { container } = await goCsv();
    const csv = 'date,weight_kg\n2026-06-30,83.3\n2026-06-29,83.6\n';
    const file = new File([csv], 'history.csv', { type: 'text/csv' });
    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('Review import')).toBeInTheDocument();
    expect(screen.getByText('history.csv')).toBeInTheDocument();

    const importBtn = await screen.findByRole('button', { name: /^Import \d+ entries/ });
    await userEvent.click(importBtn);
    await waitFor(() => expect(addWeights).toHaveBeenCalled());
    expect(await screen.findByText(/Imported/)).toBeInTheDocument();
  });
});
