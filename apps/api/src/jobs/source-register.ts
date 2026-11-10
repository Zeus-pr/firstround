export type SourceRegisterRow = {
  sourceKey: string;
  enabled: boolean;
  killSwitch: boolean;
  legalStatus: string;
};

const PILOT_OK = new Set(['pilot_operator_accepted', 'approved', 'counsel_approved']);

/**
 * A source may start ingest only when registered, enabled, not kill-switched,
 * and marked pilot/counsel accepted.
 */
export function assertSourceRunnable(row: SourceRegisterRow | null | undefined): void {
  if (!row) {
    throw new Error('Source has no register row and cannot be enabled');
  }
  if (row.killSwitch) {
    throw new Error(`Source ${row.sourceKey} is kill-switched`);
  }
  if (!row.enabled) {
    throw new Error(`Source ${row.sourceKey} is disabled`);
  }
  if (!PILOT_OK.has(row.legalStatus)) {
    throw new Error(`Source ${row.sourceKey} legal status is ${row.legalStatus}`);
  }
}

export function isSourceRunnable(row: SourceRegisterRow | null | undefined): boolean {
  try {
    assertSourceRunnable(row);
    return true;
  } catch {
    return false;
  }
}
