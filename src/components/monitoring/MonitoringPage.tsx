import HealthDashboard from './HealthDashboard';

export default function MonitoringPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      fontFamily: "'DM Sans', sans-serif",
      padding: '40px 24px',
      maxWidth: 900,
      margin: '0 auto',
    }}>
      <header style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, fontFamily: "'Space Grotesk', sans-serif" }}>
          System Health
        </h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 6 }}>
          Real-time monitoring — auth, billing, sync
        </p>
      </header>

      <HealthDashboard />
    </div>
  );
}
