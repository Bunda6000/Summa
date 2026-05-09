import { supabase } from '../lib/supabase';

export type EventType =
  | 'auth_failure'
  | 'auth_lockout'
  | 'billing_failure'
  | 'rtdn_error'
  | 'sync_failure'
  | 'health_check';

export type Severity = 'info' | 'warn' | 'error' | 'critical';

export interface MonitoringEvent {
  event_type: EventType;
  severity: Severity;
  message: string;
  metadata?: Record<string, unknown>;
  user_id?: string;
}

const SENSITIVE_KEYS = ['password', 'token', 'secret', 'key', 'authorization', 'bearer'];

export function sanitizeMetadata(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.some(s => k.toLowerCase().includes(s))) {
      result[k] = '[REDACTED]';
    } else if (v && typeof v === 'object' && !Array.isArray(v)) {
      result[k] = sanitizeMetadata(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

export function logEvent(event: MonitoringEvent): void {
  const sanitized: MonitoringEvent = event.metadata
    ? { ...event, metadata: sanitizeMetadata(event.metadata) }
    : event;

  // Fire-and-forget — never block the calling code or throw.
  // Optional chaining guards against incomplete mocks in tests and any edge
  // case where the Supabase client isn't fully initialised yet.
  supabase.functions
    ?.invoke('log-event', { body: sanitized })
    ?.catch(() => {});
}
