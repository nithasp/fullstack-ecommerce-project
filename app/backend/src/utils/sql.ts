/**
 * Build `column = $n` assignments for a partial UPDATE from a column→value map.
 * Keys with `undefined` values are skipped; `null` values are kept (they set
 * the column to SQL NULL). Additional WHERE parameters can be pushed onto
 * `values` afterwards — placeholders continue from `values.length + 1`.
 */
export function buildSetAssignments(columns: Record<string, unknown>): {
  assignments: string[];
  values: unknown[];
} {
  const assignments: string[] = [];
  const values: unknown[] = [];

  for (const [column, value] of Object.entries(columns)) {
    if (value === undefined) continue;
    values.push(value);
    assignments.push(`${column} = $${values.length}`);
  }

  return { assignments, values };
}
