import { useState } from 'react';
import { runMigration } from '../../migration/migrateLocalData';
import type { AppData } from '../../types';

type PanelState = 'prompt' | 'migrating' | 'success' | 'error';

interface Props {
  userId: string;
  legacyData: AppData;
  onComplete: (winner: AppData) => void;
  onSkip: () => void;
}

export default function MigrationPanel({ userId, legacyData, onComplete, onSkip }: Props) {
  const [state, setState] = useState<PanelState>('prompt');
  const [winner, setWinner] = useState<AppData | null>(null);

  const migrate = async () => {
    setState('migrating');
    try {
      const result = await runMigration(userId, legacyData);
      setWinner(result);
      setState('success');
    } catch {
      setState('error');
    }
  };

  if (state === 'prompt') return (
    <div>
      <h2>Import Your Data</h2>
      <p>You have offline data from before sign-in. Import it into your account?</p>
      <button onClick={migrate}>Migrate my data</button>
      <button onClick={onSkip}>Not now</button>
    </div>
  );

  if (state === 'migrating') return (
    <div>
      <div aria-label="Loading" />
      <p>Migrating your data...</p>
    </div>
  );

  if (state === 'success') return (
    <div>
      <p>All done! Your offline data has been imported.</p>
      <button onClick={() => onComplete(winner!)}>Continue to app</button>
    </div>
  );

  return (
    <div>
      <p>Something went wrong. Your local data is safe.</p>
      <button onClick={migrate}>Retry</button>
      <button onClick={onSkip}>Skip for now</button>
    </div>
  );
}
