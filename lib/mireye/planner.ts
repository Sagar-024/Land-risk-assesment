import {
  CONDITIONAL_BRANCHES,
  type BaselineResult,
  type ConditionalBranch,
} from "./fields";

export function decideBranches(
  baseline: BaselineResult,
): readonly ConditionalBranch[] {
  return CONDITIONAL_BRANCHES.filter((b) => b.trigger(baseline));
}

export function getAllTriggeredFields(
  baseline: BaselineResult,
): readonly string[] {
  const triggered = decideBranches(baseline);
  const fields = new Set<string>();
  for (const branch of triggered) {
    for (const field of branch.fields) {
      fields.add(field);
    }
  }
  return Array.from(fields);
}
