import { useState } from 'react';
import { runMigration } from '../../migration/migrateLocalData';
import type { AppData } from '../../types';

type PanelState =
  | { status: 'prompt' }
  | { status: 'migrating' }
  | { status: 'success'; winner: AppData }
  | { status: 'error' };

interface Props {
  userId: string;
  legacyData: AppData;
  onComplete: (winner: AppData) => void;
  onSkip: () => void;
}

export default function MigrationPanel({ userId, legacyData, onComplete, onSkip }: Props) {
  const [panelState, setPanelState] = useState<PanelState>({ status: 'prompt' });

  const migrate = async () => {
    setPanelState({ status: 'migrating' });
    try {
      const result = await runMigration(userId, legacyData);
      setPanelState({ status: 'success', winner: result });
    } catch {
      setPanelState({ status: 'error' });
    }
  };

  if (panelState.status === 'prompt') return (
    <div>
      <h2>Import Your Data</h2>
      <p>You have offline data from before sign-in. Import it into your account?</p>
      <button onClick={migrate} disabled={panelState.status === 'migrating'}>Migrate my data</button>
      <button onClick={onSkip}>Not now</button>
    </div>
  );

  if (panelState.status === 'migrating') return (
    <div>
      <div role="status" aria-label="Loading" />
      <p>Migrating your data...</p>
    </div>
  );

  if (panelState.status === 'success') return (
    <div>
      <p>All done! Your offline data has been imported.</p>
      <button onClick={() => onComplete(panelState.winner)}>Continue to app</button>
    </div>
  );

  return (
    <div>
      <p>Something went wrong. Your local data is safe.</p>
      <button onClick={migrate} disabled={panelState.status === 'migrating'}>Retry</button>
      <button onClick={onSkip}>Skip for now</button>
    </div>
  );
}
