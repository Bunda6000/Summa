import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../migration/migrateLocalData', () => ({
  runMigration: vi.fn(),
}));

import { runMigration } from '../../../migration/migrateLocalData';
import MigrationPanel from '../MigrationPanel';
import type { AppData } from '../../../types';

const mockRun = vi.mocked(runMigration);

const baseData: AppData = {
  categories: [],
  expenses: {},
  loanTypes: [],
  loanPaid: {},
  fixedIncomes: [],
  variableIncomes: [],
};

const defaultProps = {
  userId: 'uid-1',
  legacyData: baseData,
  onComplete: vi.fn(),
  onSkip: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('MigrationPanel', () => {
  it('renders the prompt state initially', () => {
    render(<MigrationPanel {...defaultProps} />);
    expect(screen.getByText(/offline data/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /migrate my data/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /not now/i })).toBeInTheDocument();
  });

  it('transitions to migrating state when Migrate is clicked', async () => {
    mockRun.mockReturnValue(new Promise(() => {})); // never resolves
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    expect(screen.getByText(/migrating/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /migrate my data/i })).not.toBeInTheDocument();
  });

  it('transitions to success state after migration completes', async () => {
    mockRun.mockResolvedValue(baseData);
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => expect(screen.getByText(/all done/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  it('calls onComplete with the winner when Continue is clicked', async () => {
    const winner = { ...baseData, _updatedAt: 123 };
    mockRun.mockResolvedValue(winner);
    const onComplete = vi.fn();
    render(<MigrationPanel {...defaultProps} onComplete={onComplete} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => screen.getByRole('button', { name: /continue/i }));
    await userEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onComplete).toHaveBeenCalledWith(winner);
  });

  it('transitions to error state when migration throws', async () => {
    mockRun.mockRejectedValue(new Error('network error'));
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => expect(screen.getByText(/something went wrong/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /skip for now/i })).toBeInTheDocument();
  });

  it('retries migration when Retry is clicked', async () => {
    mockRun.mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce(baseData);
    render(<MigrationPanel {...defaultProps} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => screen.getByRole('button', { name: /retry/i }));
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/all done/i)).toBeInTheDocument());
    expect(mockRun).toHaveBeenCalledTimes(2);
  });

  it('calls onSkip when Not now is clicked without running migration', async () => {
    const onSkip = vi.fn();
    render(<MigrationPanel {...defaultProps} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onSkip).toHaveBeenCalled();
    expect(mockRun).not.toHaveBeenCalled();
  });

  it('calls onSkip when Skip for now is clicked in error state', async () => {
    mockRun.mockRejectedValue(new Error('fail'));
    const onSkip = vi.fn();
    render(<MigrationPanel {...defaultProps} onSkip={onSkip} />);
    await userEvent.click(screen.getByRole('button', { name: /migrate my data/i }));
    await waitFor(() => screen.getByRole('button', { name: /skip for now/i }));
    await userEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    expect(onSkip).toHaveBeenCalled();
  });
});
