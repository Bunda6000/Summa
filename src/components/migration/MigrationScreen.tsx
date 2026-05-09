import MigrationPanel from './MigrationPanel';
import type { AppData } from '../../types';

interface Props {
  userId: string;
  legacyData: AppData;
  onComplete: (winner: AppData) => void;
  onSkip: () => void;
}

export default function MigrationScreen({ userId, legacyData, onComplete, onSkip }: Props) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg, #0A0A10)',
      padding: 24,
    }}>
      <div style={{
        maxWidth: 400,
        width: '100%',
        background: 'var(--surface, #16161E)',
        border: '1px solid var(--border, rgba(255,255,255,0.08))',
        borderRadius: 16,
        padding: 32,
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
      }}>
        <MigrationPanel
          userId={userId}
          legacyData={legacyData}
          onComplete={onComplete}
          onSkip={onSkip}
        />
      </div>
    </div>
  );
}
