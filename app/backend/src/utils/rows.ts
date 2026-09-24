// A statement written to return a row (INSERT ... RETURNING, COUNT, a CTE that selects one) must
// not hand `undefined` on to a mapper: a missing row means the statement changed, not that the
// caller should carry on with an empty object
export function requireRow<T>(rows: T[], statement = 'statement'): T {
  const row = rows[0];
  if (!row) throw new Error(`[db] the ${statement} returned no row`);
  return row;
}
