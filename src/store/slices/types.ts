// ═══════════════════════════════════════════════════════════
// Shared Slice Types — Zustand Slices Pattern
// ═══════════════════════════════════════════════════════════

import type { StoreApi, UseBoundStore } from "zustand";

/**
 * Slice factory function signature.
 * Each slice receives set/get and returns combined state + actions.
 */
export type Slice<S extends object, A extends object = object> = (
  set: (partial: Partial<S> | ((state: S & A) => Partial<S>)) => void,
  get: () => S & A
) => S & A;

/**
 * Combined store type that all slices contribute to.
 */
export type CombinedState<Slices extends object> = Slices;

/**
 * Bound store type with selectors.
 */
export type BoundStore<T> = UseBoundStore<StoreApi<T>>;