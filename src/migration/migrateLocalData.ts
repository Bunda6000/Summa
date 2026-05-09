import { loadStore, saveStore, removeStore } from '../storage';
import { supabase } from '../lib/supabase';
import type { AppData } from '../types';

const LEGACY_KEY = 'budget-app-v2';

export async function detectLegacyData(): Promise<AppData | null> {
  return loadStore<AppData | null>(LEGACY_KEY, null);
}

export async function runMigration(userId: string, legacyData: AppData): Promise<AppData> {
  const { data: cloudRow } = await supabase
    .from('user_data')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();

  const localTs = legacyData._updatedAt ?? 0;
  const cloudTs = cloudRow?.updated_at ? Date.parse(cloudRow.updated_at) : 0;
  const winner: AppData = localTs >= cloudTs ? legacyData : (cloudRow!.data as AppData);

  const { error } = await supabase.from('user_data').upsert({ user_id: userId, data: winner });
  if (error) throw new Error(error.message);

  await saveStore(`budget-app-v2-${userId}`, winner);
  await removeStore(LEGACY_KEY);

  return winner;
}
