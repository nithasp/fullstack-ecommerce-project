import { AppError } from './response';
import { Pagination } from '../types/pagination.types';
import { USER_ROLES, UserRole } from '../types/user.types';

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 100;

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

export function requireRole(val: unknown, label = 'role'): UserRole {
  if (typeof val !== 'string' || !USER_ROLES.includes(val as UserRole))
    throw new AppError(`${label} must be one of: ${USER_ROLES.join(', ')}`, 400);
  return val as UserRole;
}

export function optionalRole(val: unknown, label = 'role'): UserRole | undefined {
  return val === undefined ? undefined : requireRole(val, label);
}

// Bounded page size so a single list request can't pull the whole table (OWASP API4)
export function parsePagination(query: Record<string, unknown>): Pagination {
  const rawLimit = query.limit;
  const rawOffset = query.offset;

  let limit = PAGINATION_DEFAULT_LIMIT;
  if (rawLimit !== undefined) {
    limit = Number(rawLimit);
    if (!Number.isInteger(limit) || limit < 1 || limit > PAGINATION_MAX_LIMIT)
      throw new AppError(`limit must be an integer between 1 and ${PAGINATION_MAX_LIMIT}`, 400);
  }

  let offset = 0;
  if (rawOffset !== undefined) {
    offset = Number(rawOffset);
    if (!Number.isInteger(offset) || offset < 0)
      throw new AppError('offset must be a non-negative integer', 400);
  }

  return { limit, offset };
}
