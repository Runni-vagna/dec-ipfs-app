/**
 * SDP v1.1 Phase 0 • Tauri
 * Model-agnostic implementation
 * Security reference: docs/threat-model.md §Baseline Controls
 * Immutability: CIDs are permanent
 */

export type OnboardingMode = "easy" | "private-node";

export const defaultOnboardingMode: OnboardingMode = "easy";
