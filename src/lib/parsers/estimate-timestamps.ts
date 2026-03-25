import type { RawExecution } from '@/types';

/**
 * Estimate execution timestamps for brokers that only export dates (no times).
 *
 * Groups executions by calendar date and spaces them 30 minutes apart starting
 * at 9:30 AM ET (market open). Preserves the original row order within each day
 * as it reflects the actual execution sequence.
 *
 * This is called AFTER building the executions array but BEFORE grouping into
 * trades, so that hold-time and pattern-detection logic sees non-zero gaps.
 */
export function estimateTimestamps(executions: RawExecution[]): void {
  // Group by date (YYYY-MM-DD)
  const byDate = new Map<string, RawExecution[]>();
  for (const exec of executions) {
    const dateKey = exec.dateTime.toISOString().split('T')[0];
    const group = byDate.get(dateKey) || [];
    group.push(exec);
    byDate.set(dateKey, group);
  }

  for (const [dateKey, dayExecs] of byDate) {
    // Space 30 min apart starting at 9:30 AM
    for (let i = 0; i < dayExecs.length; i++) {
      const minutesOffset = i * 30;
      const hours = 9 + Math.floor((30 + minutesOffset) / 60);
      const minutes = (30 + minutesOffset) % 60;
      const newTime = new Date(`${dateKey}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
      dayExecs[i].dateTime = newTime;
    }
  }
}
