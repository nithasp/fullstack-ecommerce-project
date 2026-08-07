import { AppError } from './response';

export function parseId(val: string, label: string): number {
  const id = parseInt(val);
  if (isNaN(id) || id <= 0) throw new AppError(`${label} must be a valid positive integer`, 400);
  return id;
}

export function requireString(val: unknown, label: string): string {
  if (!val || typeof val !== 'string' || !val.trim())
    throw new AppError(`${label} is required and must be a non-empty string`, 400);
  return val.trim();
}

export function optionalString(val: unknown, label: string): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val !== 'string' || !val.trim())
    throw new AppError(`${label} must be a non-empty string`, 400);
  return val.trim();
}

export function requirePositiveInt(val: unknown, label: string): number {
  if (val === undefined || val === null || isNaN(Number(val)))
    throw new AppError(`${label} is required and must be a valid number`, 400);
  const num = Number(val);
  if (num <= 0 || !Number.isInteger(num))
    throw new AppError(`${label} must be a positive integer`, 400);
  return num;
}

export function requireNonNegativeNumber(val: unknown, label: string): number {
  if (val === undefined || val === null || val === '' || typeof val === 'boolean' || isNaN(Number(val)))
    throw new AppError(`${label} is required and must be a valid number`, 400);
  const num = Number(val);
  if (num < 0) throw new AppError(`${label} must be a non-negative number`, 400);
  return num;
}

export function optionalNonNegativeNumber(val: unknown, label: string): number | undefined {
  if (val === undefined) return undefined;
  if (val === null || val === '' || typeof val === 'boolean' || isNaN(Number(val)))
    throw new AppError(`${label} must be a valid number`, 400);
  const num = Number(val);
  if (num < 0) throw new AppError(`${label} must be a non-negative number`, 400);
  return num;
}

export function optionalNonNegativeInt(val: unknown, label: string): number | undefined {
  const num = optionalNonNegativeNumber(val, label);
  if (num === undefined) return undefined;
  if (!Number.isInteger(num)) throw new AppError(`${label} must be a non-negative integer`, 400);
  return num;
}
