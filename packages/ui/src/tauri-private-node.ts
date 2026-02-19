/**
 * SDP v1.1 Phase 0 • Tauri
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

export type PrivateNodeStatus = {
  online: boolean;
  peerCount: number;
};

export type NodeStartMode = "easy" | "private";

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

export const getPrivateNodeStatus = async (): Promise<PrivateNodeStatus | null> => {
  return invokeTauri<PrivateNodeStatus>("node_status");
};

export const startPrivateNodeCommand = async (): Promise<PrivateNodeStatus | null> => {
  return invokeTauri<PrivateNodeStatus>("start_private_node");
};

export const startPrivateNodeWithModeCommand = async (mode: NodeStartMode): Promise<PrivateNodeStatus | null> => {
  return invokeTauri<PrivateNodeStatus>("start_private_node_mode", { mode });
};

export const stopPrivateNodeCommand = async (): Promise<PrivateNodeStatus | null> => {
  return invokeTauri<PrivateNodeStatus>("stop_private_node");
};

export const simulatePeerJoinCommand = async (): Promise<PrivateNodeStatus | null> => {
  return invokeTauri<PrivateNodeStatus>("simulate_peer_join");
};
