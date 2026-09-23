// Cuts a value to its column's width. Much of an audit or page-view row is request data (a path,
// a user agent, a username someone typed), and an oversized value should shorten the row, not lose it.
export const clip = (value: string | null | undefined, max: number): string | null =>
  value ? value.slice(0, max) : null;
