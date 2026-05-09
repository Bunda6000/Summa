import { useEffect } from 'react';
import useMonitoringStore from '../../monitoring/useMonitoringStore';
import type { HealthData } from '../../monitoring/useMonitoringStore';

// ── Status helpers ────────────────────────────────────────────────────────────

function uptimeStatus(pct: number): 'healthy' | 'degraded' {
  return pct >= 99 ? 'healthy' : 'degraded';
}

function authStatus(rate: number): 'ok' | 'warning' {
  return rate > 5 ? 'warning' : 'ok';
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ label, variant }: { label: string; variant: 'healthy' | 'degraded' | 'warning' | 'ok' }) {
  const colors: Record<string, string> = {
    healthy: 'background:#1a9e76;color:#fff',
    ok: 'background:#1a9e76;color:#fff',
    degraded: 'background:#e54d3a;color:#fff',
    warning: 'background:#f59e0b;color:#fff',
  };
  return (
    <span style={{ ...parseCssText(colors[variant]), padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, display: 'inline-block', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
      {label}
    </span>
  );
}

function parseCssText(css: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const decl of css.split(';')) {
    const [prop, val] = decl.split(':');
    if (prop && val) result[prop.trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = val.trim();
  }
  return result as React.CSSProperties;
}

function MetricCard({ label, value, unit, sub }: { label: string; value: string | number; unit?: string; sub?: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--chip)', border: '1px solid var(--border)', borderRadius: 12, padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--text)', fontFamily: "'Space Grotesk',sans-serif" }}>{value}</span>
        {unit && <span style={{ fontSize: 13, color: 'var(--muted)' }}>{unit}</span>}
      </div>
      {sub && <div>{sub}</div>}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function HealthDashboard() {
  const { health, loading, error, lastCheckedAt, fetchHealth } = useMonitoringStore();

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  if (loading && !health) {
    return (
      <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 40, color: 'var(--muted)', fontSize: 14 }}>
        <div style={{ width: 20, height: 20, border: '2px solid var(--border)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        Loading system health…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" style={{ background: 'rgba(229,77,58,0.1)', border: '1px solid rgba(229,77,58,0.3)', borderRadius: 12, padding: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ color: 'var(--red)', fontSize: 14, flex: 1 }}>{error}</span>
        <button
          onClick={() => fetchHealth()}
          style={{ background: 'var(--chip)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 13, color: 'var(--text)' }}
          aria-label="Retry"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!health) {
    return (
      <div style={{ padding: 40, color: 'var(--muted)', fontSize: 14, textAlign: 'center' }}>
        No data available yet. Click Refresh to load metrics.
      </div>
    );
  }

  return <HealthMetrics health={health} lastCheckedAt={lastCheckedAt} onRefresh={fetchHealth} loading={loading} />;
}

function HealthMetrics({ health, lastCheckedAt, onRefresh, loading }: {
  health: HealthData;
  lastCheckedAt: string | null;
  onRefresh: () => void;
  loading: boolean;
}) {
  const upStatus = uptimeStatus(health.uptime_pct);
  const aStatus = authStatus(health.auth_failure_rate_1h);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge label={upStatus} variant={upStatus} />
          {aStatus === 'warning' && <Badge label="warning" variant="warning" />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {lastCheckedAt && (
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>
              Last checked: {new Date(lastCheckedAt).toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{ background: 'var(--chip)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 14px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 13, color: 'var(--text)', opacity: loading ? 0.6 : 1 }}
            aria-label="Refresh"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Primary metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <MetricCard
          label="Uptime (1 h)"
          value={health.uptime_pct}
          unit="%"
          sub={<Badge label={upStatus} variant={upStatus} />}
        />
        <MetricCard
          label="Auth failure rate (1 h)"
          value={health.auth_failure_rate_1h}
          unit="%"
          sub={aStatus === 'warning' ? <Badge label="warning" variant="warning" /> : undefined}
        />
        <MetricCard
          label="Sync success rate (1 h)"
          value={health.sync_success_rate_1h}
          unit="%"
        />
        <MetricCard
          label="Sync failures (1 h)"
          value={health.sync_failure_count_1h}
        />
      </div>

      {/* Secondary metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
        <MetricCard
          label="Billing failures (24 h)"
          value={health.billing_failure_count_24h}
          sub={health.billing_failure_count_24h > 0 ? <Badge label="warning" variant="warning" /> : undefined}
        />
        <MetricCard
          label="RTDN errors (24 h)"
          value={health.rtdn_error_count_24h}
          sub={health.rtdn_error_count_24h > 0 ? <Badge label="warning" variant="warning" /> : undefined}
        />
        <MetricCard
          label="Total events (24 h)"
          value={health.total_events_24h}
        />
        <MetricCard
          label="Last event"
          value={health.last_event_at
            ? new Date(health.last_event_at).toLocaleTimeString()
            : 'None'}
        />
      </div>
    </div>
  );
}
