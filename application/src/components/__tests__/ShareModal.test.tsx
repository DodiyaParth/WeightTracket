import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, within } from '@testing-library/react';
import { Routes, Route } from 'react-router-dom';
import { renderWithRouter, userEvent } from '../../test/test-utils.jsx';

let authUser;
vi.mock('../../auth/AuthContext.jsx', () => ({ useAuth: () => ({ user: authUser }) }));

let outgoingData;
vi.mock('../../hooks/useData.js', () => ({ useAsync: () => ({ data: outgoingData }) }));

const createInvite = vi.fn();
const updateMemberRole = vi.fn();
const removeMember = vi.fn();
const cancelInvite = vi.fn();
const setPublicLink = vi.fn();
vi.mock('../../data/repo.js', () => ({
  repo: {
    createInvite: (...a) => createInvite(...a),
    updateMemberRole: (...a) => updateMemberRole(...a),
    removeMember: (...a) => removeMember(...a),
    cancelInvite: (...a) => cancelInvite(...a),
    setPublicLink: (...a) => setPublicLink(...a),
  },
  bus: { subscribe: () => () => {}, emit: () => {} },
}));

import ShareModal from '../ShareModal.jsx';

const profiles = {
  parth: { uid: 'parth', name: 'Parth', email: 'p@x.com' },
  priya: { uid: 'priya', name: 'Priya', email: 'pr@x.com' },
};
const ownedDashboard = (over = {}) => ({
  id: 'd1', name: 'Parth & Priya', ownerUid: 'parth',
  members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'editor', joinedAt: 2 } },
  trackedUids: ['parth', 'priya'],
  public: { enabled: false, token: null },
  ...over,
});

function renderShare(dashboard = ownedDashboard(), onClose = vi.fn()) {
  renderWithRouter(
    <Routes>
      <Route path="/" element={<ShareModal dashboard={dashboard} profiles={profiles} onClose={onClose} />} />
      <Route path="/s/:token" element={<div>PUBLIC PREVIEW</div>} />
    </Routes>,
    { route: '/' }
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  authUser = { uid: 'parth', displayName: 'Parth' };
  outgoingData = [];
  createInvite.mockResolvedValue({});
  updateMemberRole.mockResolvedValue();
  removeMember.mockResolvedValue();
  cancelInvite.mockResolvedValue();
  setPublicLink.mockResolvedValue({ enabled: true, token: 't' });
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('ShareModal (owner)', () => {
  it('renders members, invite form and the off link section', () => {
    renderShare();
    expect(screen.getByText('Share “Parth & Priya”')).toBeInTheDocument();
    expect(screen.getByText('Parth')).toBeInTheDocument();
    expect(screen.getByText('Priya')).toBeInTheDocument();
    expect(screen.getByText('Link sharing is off')).toBeInTheDocument();
  });

  it('sends an invite and clears the field', async () => {
    renderShare();
    const email = screen.getByPlaceholderText('name@email.com');
    await userEvent.type(email, 'friend@x.com');
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(createInvite).toHaveBeenCalledWith('d1', expect.objectContaining({ toEmail: 'friend@x.com' }));
    expect(email).toHaveValue('');
  });

  it('changes a member role after confirming', async () => {
    renderShare();
    const priyaGroup = screen.getByRole('radiogroup', { name: /Priya’s access level/ });
    await userEvent.click(within(priyaGroup).getByRole('radio', { name: 'Read only' }));
    expect(screen.getByText('Change access?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(updateMemberRole).toHaveBeenCalledWith('d1', 'priya', 'viewer');
  });

  it('removes a member after confirming', async () => {
    renderShare();
    await userEvent.click(screen.getByRole('button', { name: 'Remove Priya' }));
    expect(screen.getByText('Remove this member?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(removeMember).toHaveBeenCalledWith('d1', 'priya');
  });

  it('cancels a pending invite after confirming', async () => {
    outgoingData = [{ id: 'inv1', toEmail: 'x@y.com', status: 'pending', fromInitial: 'A' }];
    renderShare();
    expect(screen.getByText('x@y.com')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Cancel this invite?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel invite' }));
    expect(cancelInvite).toHaveBeenCalledWith('inv1');
  });

  it('enables the public link', async () => {
    renderShare();
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(setPublicLink).toHaveBeenCalledWith('d1', true);
  });
});

describe('ShareModal (public link on)', () => {
  const dash = ownedDashboard({ public: { enabled: true, token: 'tok123' } });

  it('copies the link and opens the preview', async () => {
    renderShare(dash);
    await userEvent.click(screen.getByRole('button', { name: /copy/i }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(await screen.findByText('Copied!')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /open read-only preview/i }));
    expect(await screen.findByText('PUBLIC PREVIEW')).toBeInTheDocument();
  });

  it('disables the link after confirming', async () => {
    renderShare(dash);
    await userEvent.click(screen.getByRole('switch', { name: /read-only link/i }));
    expect(screen.getByText('Disable public link?')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Disable link' }));
    expect(setPublicLink).toHaveBeenCalledWith('d1', false);
  });
});

describe('ShareModal (non-owner)', () => {
  it('shows read-only role badges without edit controls', () => {
    renderShare(ownedDashboard({ ownerUid: 'someone-else' }));
    expect(screen.queryByRole('radiogroup', { name: /Priya’s access level/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Priya' })).not.toBeInTheDocument();
  });
});

describe('ShareModal - branch coverage', () => {
  it('ignores an empty invite, uses a default name, and surfaces invite errors', async () => {
    authUser = { uid: 'parth' }; // no displayName → "A teammate"
    renderShare();
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(createInvite).not.toHaveBeenCalled();

    createInvite.mockRejectedValueOnce(new Error('invite blew up'));
    await userEvent.type(screen.getByPlaceholderText('name@email.com'), 'x@y.com');
    await userEvent.click(screen.getByRole('button', { name: 'Invite' }));
    expect(createInvite).toHaveBeenCalledWith('d1', expect.objectContaining({ fromName: 'A teammate' }));
    expect(await screen.findByText('invite blew up')).toBeInTheDocument();
  });

  it('shows a row error when a role change fails', async () => {
    updateMemberRole.mockRejectedValueOnce(new Error('x'));
    renderShare();
    const priyaGroup = screen.getByRole('radiogroup', { name: /Priya’s access level/ });
    await userEvent.click(within(priyaGroup).getByRole('radio', { name: 'Read only' }));
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect((await screen.findAllByText(/Couldn.t update that member.s role/)).length).toBeGreaterThan(0);
  });

  it('surfaces an error when enabling the link fails', async () => {
    outgoingData = undefined; // exercise the `outgoing || []` fallback
    setPublicLink.mockRejectedValueOnce(new Error('link nope'));
    renderShare();
    await userEvent.click(screen.getByRole('button', { name: 'Enable' }));
    expect(await screen.findByText('link nope')).toBeInTheDocument();
  });

  it('renders a pending invite with no initial and ignores non-pending ones', () => {
    outgoingData = [
      { id: 'i1', toEmail: 'a@b.com', status: 'pending' }, // no fromInitial → ✉ fallback
      { id: 'i2', toEmail: 'done@b.com', status: 'accepted' }, // filtered out
    ];
    renderShare();
    expect(screen.getByText('a@b.com')).toBeInTheDocument();
    expect(screen.queryByText('done@b.com')).not.toBeInTheDocument();
    expect(screen.getByText('✉')).toBeInTheDocument();
  });

  it('confirms a viewer→editor promotion with the right copy', async () => {
    renderShare(ownedDashboard({
      members: { parth: { uid: 'parth', role: 'owner', joinedAt: 1 }, priya: { uid: 'priya', role: 'viewer', joinedAt: 2 } },
    }));
    const priyaGroup = screen.getByRole('radiogroup', { name: /Priya’s access level/ });
    await userEvent.click(within(priyaGroup).getByRole('radio', { name: 'Can edit' }));
    expect(screen.getByText(/from Read only to Can edit/)).toBeInTheDocument();
  });
});
