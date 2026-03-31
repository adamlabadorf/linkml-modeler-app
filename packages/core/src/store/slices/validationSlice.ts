import type { StateCreator } from 'zustand';
import type { LinkMLSchema } from '../../model/index.js';
import { validateSchemaFull, type ValidationIssue, type JumpTarget } from '../../validation/index.js';

export interface ValidationSlice {
  // State
  validationIssues: ValidationIssue[];
  lastValidatedAt: number | null; // timestamp

  // Actions
  runValidation(schema: LinkMLSchema): void;
  clearValidation(): void;
  /**
   * Returns a JumpTarget for a given issue (passthrough helper for UI).
   * The actual navigation is handled by EditorSlice consumers.
   */
  getJumpTarget(issueId: string): JumpTarget | null;
}

export const createValidationSlice: StateCreator<ValidationSlice, [], [], ValidationSlice> = (set, get) => ({
  validationIssues: [],
  lastValidatedAt: null,

  runValidation(schema) {
    const issues = validateSchemaFull(schema);
    set({ validationIssues: issues, lastValidatedAt: Date.now() });
  },

  clearValidation() {
    set({ validationIssues: [], lastValidatedAt: null });
  },

  getJumpTarget(issueId) {
    const issue = get().validationIssues.find((i) => i.id === issueId);
    return issue?.jump ?? null;
  },
});
