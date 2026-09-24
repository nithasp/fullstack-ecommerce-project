export function requireRow<T>(rows: T[], statement = 'statement'): T {
  const row = rows[0];
  if (!row) throw new Error(`[db] the ${statement} returned no row`);
  return row;
}
