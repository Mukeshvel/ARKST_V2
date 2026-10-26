export type CompletionStatus = 'pending' | 'reported' | 'verified';

/** A report is not completion when staff verification is required. */
export function isComplete(
  status: CompletionStatus,
  verificationRequired: boolean,
): boolean {
  return (
    status === 'verified' || (status === 'reported' && !verificationRequired)
  );
}

export interface ActivityWindow {
  opensAt: Date;
  dueAt: Date;
}

export function validateWindow(window: ActivityWindow): void {
  if (
    !Number.isFinite(window.opensAt.getTime()) ||
    !Number.isFinite(window.dueAt.getTime()) ||
    window.opensAt >= window.dueAt
  ) {
    throw new Error(
      'Activity window requires valid instants with opening before deadline',
    );
  }
}

/** Provisional boundary: opening inclusive, deadline exclusive. No recurrence assumptions. */
export function windowState(
  window: ActivityWindow,
  now: Date,
): 'upcoming' | 'open' | 'closed' {
  validateWindow(window);
  if (!Number.isFinite(now.getTime()))
    throw new Error('Current time must be valid');
  if (now < window.opensAt) return 'upcoming';
  return now < window.dueAt ? 'open' : 'closed';
}
