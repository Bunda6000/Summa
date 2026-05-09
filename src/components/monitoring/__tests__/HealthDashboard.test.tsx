import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../lib/supabase', () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn(),
  },
}));

vi.mock('../../../monitoring/useMonitoringStore');

import useMonitoringStore from '../../../monitoring/useMonitoringStore';
import HealthDashboard from '../HealthDashboard';

const mockHealth = {
  uptime_pct: 99.8,
  auth_failure_rate_1h: 2.5,
  billing_failure_count_24h: 1,
  rtdn_error_count_24h: 0,
  sync_success_rate_1h: 97.3,
  sync_failure_count_1h: 2,
  total_events_24h: 148,
  last_event_at: '2026-05-09T10:00:00Z',
};

function mockStore(overrides?: Partial<ReturnType<typeof useMonitoringStore>>) {
  (useMonitoringStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
    health: null,
    loading: false,
    error: null,
    lastCheckedAt: null,
    fetchHealth: vi.fn(),
    clearError: vi.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStore();
});

// ─── Loading state ────────────────────────────────────────────────────────────

describe('HealthDashboard — loading state', () => {
  it('shows a loading indicator while fetching', () => {
    mockStore({ loading: true });
    render(<HealthDashboard />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('calls fetchHealth on mount', () => {
    const fetchHealth = vi.fn();
    mockStore({ fetchHealth });
    render(<HealthDashboard />);
    expect(fetchHealth).toHaveBeenCalledOnce();
  });
});

// ─── Error state ──────────────────────────────────────────────────────────────

describe('HealthDashboard — error state', () => {
  it('shows an error alert when fetch fails', () => {
    mockStore({ error: 'Failed to load health data' });
    render(<HealthDashboard />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/failed to load health data/i)).toBeInTheDocument();
  });

  it('shows a retry button in the error state', () => {
    mockStore({ error: 'Network error' });
    render(<HealthDashboard />);
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('calls fetchHealth when retry is clicked', async () => {
    const fetchHealth = vi.fn();
    mockStore({ error: 'Network error', fetchHealth });
    render(<HealthDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(fetchHealth).toHaveBeenCalledTimes(2); // once on mount, once on click
  });
});

// ─── Empty state ──────────────────────────────────────────────────────────────

describe('HealthDashboard — empty state', () => {
  it('shows a no-data message when health is null and not loading', () => {
    mockStore({ health: null, loading: false, error: null });
    render(<HealthDashboard />);
    expect(screen.getByText(/no data/i)).toBeInTheDocument();
  });
});

// ─── Health metrics display ───────────────────────────────────────────────────

describe('HealthDashboard — metrics', () => {
  beforeEach(() => {
    mockStore({ health: mockHealth as never, loading: false });
  });

  it('renders the API uptime percentage', () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/99\.8/)).toBeInTheDocument();
  });

  it('renders an uptime label', () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/uptime/i)).toBeInTheDocument();
  });

  it('renders the auth failure rate', () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/auth/i)).toBeInTheDocument();
    expect(screen.getByText(/2\.5/)).toBeInTheDocument();
  });

  it('renders billing failure count', () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/billing/i)).toBeInTheDocument();
  });

  it('renders sync success rate', () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/sync success rate/i)).toBeInTheDocument();
    expect(screen.getByText(/97\.3/)).toBeInTheDocument();
  });

  it('renders total events in the last 24 hours', () => {
    render(<HealthDashboard />);
    expect(screen.getByText(/148/)).toBeInTheDocument();
  });

  it('renders the last checked timestamp', () => {
    mockStore({ health: mockHealth as never, lastCheckedAt: '2026-05-09T10:05:00Z' });
    render(<HealthDashboard />);
    expect(screen.getByText(/last checked|last updated/i)).toBeInTheDocument();
  });
});

// ─── Refresh button ───────────────────────────────────────────────────────────

describe('HealthDashboard — refresh', () => {
  it('renders a refresh button', () => {
    mockStore({ health: mockHealth as never });
    render(<HealthDashboard />);
    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('calls fetchHealth when the refresh button is clicked', async () => {
    const fetchHealth = vi.fn();
    mockStore({ health: mockHealth as never, fetchHealth });
    render(<HealthDashboard />);
    await userEvent.click(screen.getByRole('button', { name: /refresh/i }));
    expect(fetchHealth).toHaveBeenCalledTimes(2); // mount + click
  });
});

// ─── Status indicators ────────────────────────────────────────────────────────

describe('HealthDashboard — status badges', () => {
  it('shows a healthy badge when uptime is above 99%', () => {
    mockStore({ health: { ...mockHealth, uptime_pct: 99.9 } as never });
    render(<HealthDashboard />);
    expect(screen.getAllByText(/healthy/i).length).toBeGreaterThan(0);
  });

  it('shows a degraded badge when uptime is below 99%', () => {
    mockStore({ health: { ...mockHealth, uptime_pct: 97.5 } as never });
    render(<HealthDashboard />);
    expect(screen.getAllByText(/degraded/i).length).toBeGreaterThan(0);
  });

  it('shows a warning badge when auth failure rate exceeds 5%', () => {
    mockStore({ health: { ...mockHealth, auth_failure_rate_1h: 6.0 } as never });
    render(<HealthDashboard />);
    expect(screen.getAllByText(/warning/i).length).toBeGreaterThan(0);
  });
});
