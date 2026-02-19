/**
 * SDP v1.1 Phase 1 • Tauri
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §UCAN Scaffold Status (Phase 1)
 * Immutability: CIDs are permanent
 */

export type SecurityStatePayload = {
  identityJson: string | null;
  delegationJson: string | null;
  revocationQueueJson: string | null;
  auditLogJson: string | null;
};

export type FlushRevocationResult = {
  flushedIds: string[];
  failedIds: string[];
};

const hasTauriRuntime = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }
  return "__TAURI_INTERNALS__" in window;
};

const invokeTauri = async <T>(command: string, payload?: Record<string, unknown>): Promise<T | null> => {
  if (!hasTauriRuntime()) {
    return null;
  }
  const { core } = await import("@tauri-apps/api");
  return core.invoke<T>(command, payload);
};

export const loadSecurityStateCommand = async (): Promise<SecurityStatePayload | null> => {
  return invokeTauri<SecurityStatePayload>("get_security_state");
};

export const saveSecurityStateCommand = async (payload: SecurityStatePayload): Promise<void> => {
  await invokeTauri<void>("set_security_state", {
    identityJson: payload.identityJson,
    delegationJson: payload.delegationJson,
    revocationQueueJson: payload.revocationQueueJson,
    auditLogJson: payload.auditLogJson
  });
};

export const flushRevocationQueueCommand = async (
  revocationIds: string[]
): Promise<FlushRevocationResult | null> => {
  return invokeTauri<FlushRevocationResult>("flush_revocation_queue", {
    revocationIds
  });
};
