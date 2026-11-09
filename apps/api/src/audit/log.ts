export type AuditEventInput = {
  action: string;
  entityType: string;
  entityId?: string;
  reason?: string;
  workspaceId?: string;
  actorUserId?: string;
  policyVersion?: string;
  modelVersion?: string;
  promptVersion?: string;
  meta?: Record<string, unknown>;
};

/** Redacted structured audit line for logs (no tokens, bodies, or secrets). */
export function formatAuditLog(event: AuditEventInput): Record<string, unknown> {
  return {
    kind: 'audit',
    action: event.action,
    entityType: event.entityType,
    entityId: event.entityId ?? null,
    reason: event.reason ?? null,
    workspaceId: event.workspaceId ?? null,
    actorUserId: event.actorUserId ?? null,
    policyVersion: event.policyVersion ?? null,
    modelVersion: event.modelVersion ?? null,
    promptVersion: event.promptVersion ?? null,
    meta: event.meta ?? {},
    at: new Date().toISOString(),
  };
}
