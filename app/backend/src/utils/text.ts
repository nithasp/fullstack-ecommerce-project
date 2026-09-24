export const clip = (value: string | null | undefined, max: number): string | null =>
  value ? value.slice(0, max) : null;
