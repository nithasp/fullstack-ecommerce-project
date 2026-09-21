import { AppError } from './response';
import { Pagination } from '../types/pagination.types';
import { USER_ROLES, UserRole } from '../types/user.types';
import { ORDER_STATUSES, OrderStatus } from '../types/order.types';
import { ADDRESS_LABELS, AddressForm, AddressLabel } from '../types/address.types';
import { UpsertCartItemPayload } from '../types/cart.types';
import { ProductFilters } from '../types/product.types';

export const PAGINATION_DEFAULT_LIMIT = 50;
export const PAGINATION_MAX_LIMIT = 100;
export const MIN_PASSWORD_LENGTH = 8;
const MAX_QUERY_STRING_LENGTH = 100;

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

// Every route that sets a password goes through here, so the length rule can't be skipped.
// The value is returned exactly as typed, never trimmed: the string hashed is the string the user signs in with.
export function requirePassword(val: unknown, label = 'password'): string {
  if (typeof val !== 'string' || !val.trim())
    throw new AppError(`${label} is required and must be a non-empty string`, 400);
  if (val.length < MIN_PASSWORD_LENGTH)
    throw new AppError(`${label} must be at least ${MIN_PASSWORD_LENGTH} characters`, 400);
  return val;
}

export function optionalPassword(val: unknown, label = 'password'): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val !== 'string' || !val.trim())
    throw new AppError(`${label} must be a non-empty string`, 400);
  return requirePassword(val, label);
}

export function requireRole(val: unknown, label = 'role'): UserRole {
  if (typeof val !== 'string' || !USER_ROLES.includes(val as UserRole))
    throw new AppError(`${label} must be one of: ${USER_ROLES.join(', ')}`, 400);
  return val as UserRole;
}

export function optionalRole(val: unknown, label = 'role'): UserRole | undefined {
  return val === undefined ? undefined : requireRole(val, label);
}

export function parseOrderStatus(val: unknown, label = 'status'): OrderStatus {
  if (typeof val !== 'string' || !ORDER_STATUSES.includes(val as OrderStatus))
    throw new AppError(`${label} must be either 'active' or 'complete'`, 400);
  return val as OrderStatus;
}

export function parseCartItemPayload(body: Record<string, unknown>): UpsertCartItemPayload {
  return {
    productId:    requirePositiveInt(body.productId, 'productId'),
    quantity:     requirePositiveInt(body.quantity ?? 1, 'quantity'),
    typeId:       typeof body.typeId === 'string' ? body.typeId : null,
    selectedType: body.selectedType && typeof body.selectedType === 'object' ? body.selectedType as Record<string, unknown> : null,
    shopId:       typeof body.shopId === 'string' ? body.shopId : null,
    shopName:     typeof body.shopName === 'string' ? body.shopName : null,
  };
}

// Unknown or missing labels fall back to 'home'
export function parseAddressLabel(val: unknown): AddressLabel {
  return ADDRESS_LABELS.includes(val as AddressLabel) ? val as AddressLabel : 'home';
}

const parsePhone = (val: unknown): string | undefined =>
  typeof val === 'string' && val.trim() ? val.trim() : undefined;

const parseIsDefault = (val: unknown): boolean => val === true || val === 'true';

export function parseNewAddress(body: Record<string, unknown>): AddressForm {
  return {
    fullName:  requireString(body.fullName, 'fullName'),
    address:   requireString(body.address,  'address'),
    city:      requireString(body.city,     'city'),
    phone:     parsePhone(body.phone),
    label:     parseAddressLabel(body.label),
    isDefault: parseIsDefault(body.isDefault),
  };
}

// Only the fields present in the body; a blank phone clears the stored one
export function parseAddressUpdate(body: Record<string, unknown>): Partial<AddressForm> {
  const form: Partial<AddressForm> = {};
  if (body.fullName  !== undefined) form.fullName  = requireString(body.fullName, 'fullName');
  if (body.address   !== undefined) form.address   = requireString(body.address,  'address');
  if (body.city      !== undefined) form.city      = requireString(body.city,     'city');
  if (body.phone     !== undefined) form.phone     = parsePhone(body.phone) ?? null;
  if (body.label     !== undefined) form.label     = parseAddressLabel(body.label);
  if (body.isDefault !== undefined) form.isDefault = parseIsDefault(body.isDefault);
  return form;
}

// A single optional query-string value; blank counts as absent
function optionalQueryString(val: unknown, label: string): string | undefined {
  if (val === undefined) return undefined;
  if (typeof val !== 'string') throw new AppError(`${label} must be a single value`, 400);
  if (val.length > MAX_QUERY_STRING_LENGTH)
    throw new AppError(`${label} must be at most ${MAX_QUERY_STRING_LENGTH} characters`, 400);
  return val.trim() || undefined;
}

export function parseProductFilters(query: Record<string, unknown>): ProductFilters {
  return {
    category: optionalQueryString(query.category, 'category'),
    search:   optionalQueryString(query.search,   'search'),
  };
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
