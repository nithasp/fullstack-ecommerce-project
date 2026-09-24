import { NextFunction, Request, Response } from 'express';
import { auditService } from '../services';
import {
  AuditAction,
  AuditAnnotation,
  AuditDetails,
  AuditDetailsFn,
  AuditRule,
  NewAuditLog,
} from '../types/auditLog.types';
import { requestSource } from '../utils/request';

const METHOD_ACTIONS: Record<string, AuditAction> = {
  GET: 'READ',
  POST: 'CREATE',
  PUT: 'UPDATE',
  PATCH: 'UPDATE',
  DELETE: 'DELETE',
};

const UNNAMED_EVENT = 'api.request';

const MAX_DETAIL_LENGTH = 100;

// A row keeps small, non-secret facts only: ids, quantities, statuses. Never a password,
// a token or a whole request body.

function safeValue(val: unknown): string | number | boolean | undefined {
  if (typeof val === 'number') return Number.isFinite(val) ? val : undefined;
  if (typeof val === 'boolean') return val;
  if (typeof val === 'string' && val.trim()) return val.trim().slice(0, MAX_DETAIL_LENGTH);
  return undefined;
}

const bodyOf = (req: Request): Record<string, unknown> =>
  req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? (req.body as Record<string, unknown>)
    : {};

function copy(source: Record<string, unknown>, keys: string[]): AuditDetails | undefined {
  const details: AuditDetails = {};
  for (const key of keys) {
    const val = safeValue(source[key]);
    if (val !== undefined) details[key] = val;
  }
  return Object.keys(details).length ? details : undefined;
}

const pick =
  (...keys: string[]): AuditDetailsFn =>
  (req) =>
    copy(bodyOf(req), keys);

const fromQuery =
  (...keys: string[]): AuditDetailsFn =>
  (req) =>
    copy(req.query as Record<string, unknown>, keys);

// Names the fields an update sent, never their values: one of them may be a password
const changed =
  (...keys: string[]): AuditDetailsFn =>
  (req) => {
    const body = bodyOf(req);
    const fields = keys.filter((key) => body[key] !== undefined);
    return fields.length ? { changed: fields } : undefined;
  };

const itemCount =
  (field?: string): AuditDetailsFn =>
  (req) => {
    const items: unknown = field ? bodyOf(req)[field] : req.body;
    return Array.isArray(items) ? { items: items.length } : undefined;
  };

const USER_FIELDS = ['firstName', 'lastName', 'username'];
const ADDRESS_FIELDS = ['fullName', 'phone', 'address', 'city', 'label', 'isDefault'];
const PRODUCT_FIELDS = [
  'name',
  'price',
  'category',
  'image',
  'description',
  'previewImg',
  'types',
  'reviews',
  'overallRating',
  'stock',
  'isActive',
  'shopId',
  'shopName',
];

const rule = (method: string, route: string, event: string | null, details?: AuditDetailsFn): AuditRule => ({
  method,
  pattern: new RegExp(`^${route.replace(/:\w+/g, '[^/]+')}/?$`, 'i'),
  event,
  details,
});

const RULES: AuditRule[] = [
  rule('PATCH', '/users/:id', 'user.updated', changed(...USER_FIELDS)),
  rule('PUT', '/users/:id/password', 'user.password_changed'),
  rule('DELETE', '/users/:id', 'user.closed'),

  rule('POST', '/cart', 'cart.item_added', pick('productId', 'quantity', 'typeId')),
  rule('POST', '/cart/checkout', 'cart.checked_out', itemCount('cartItemIds')),
  rule('PATCH', '/cart/:id', 'cart.item_updated', pick('quantity')),
  rule('DELETE', '/cart/:id', 'cart.item_removed'),
  rule('DELETE', '/cart', 'cart.cleared'),

  rule('POST', '/addresses', 'address.created', pick('label', 'isDefault')),
  rule('PATCH', '/addresses/:id', 'address.updated', changed(...ADDRESS_FIELDS)),
  rule('DELETE', '/addresses/:id', 'address.deleted'),

  rule('POST', '/page-views', null),

  rule('GET', '/admin/users', 'admin.user_list_viewed'),
  rule('POST', '/admin/users', 'admin.user_created', pick('username', 'role')),
  rule('GET', '/admin/users/:id', 'admin.user_viewed'),
  rule('PATCH', '/admin/users/:id', 'admin.user_updated', changed(...USER_FIELDS)),
  rule('PUT', '/admin/users/:id/role', 'admin.user_role_changed', pick('role')),
  rule('PUT', '/admin/users/:id/password', 'admin.user_password_reset'),
  rule('DELETE', '/admin/users/:id', 'admin.user_closed'),

  rule('GET', '/admin/products', 'admin.product_list_viewed', fromQuery('category', 'search')),
  rule('POST', '/admin/products/bulk', 'product.bulk_created', itemCount()),
  rule('POST', '/admin/products', 'product.created', pick('name')),
  rule('GET', '/admin/products/:id', 'admin.product_viewed'),
  rule('PATCH', '/admin/products/:id', 'product.updated', changed(...PRODUCT_FIELDS)),
  rule('DELETE', '/admin/products/:id', 'product.archived'),

  rule('GET', '/admin/orders', 'admin.order_list_viewed', fromQuery('status', 'userId')),
  rule('POST', '/admin/orders', 'admin.order_created', pick('userId', 'status')),
  rule('GET', '/admin/orders/:id/products', 'admin.order_products_viewed'),
  rule('POST', '/admin/orders/:id/products', 'admin.order_product_added', pick('productId', 'quantity')),
  rule('GET', '/admin/orders/:id', 'admin.order_viewed'),
  rule('PATCH', '/admin/orders/:id', 'admin.order_updated', pick('status')),
  rule('DELETE', '/admin/orders/:id', 'admin.order_deleted'),

  rule('GET', '/admin/carts', 'admin.cart_list_viewed', fromQuery('userId')),
  rule('GET', '/admin/carts/:userId', 'admin.cart_viewed'),
  rule('POST', '/admin/carts/:userId', 'admin.cart_item_added', pick('productId', 'quantity')),
  rule('DELETE', '/admin/carts/:userId', 'admin.cart_cleared'),
  rule('GET', '/admin/cart-items/:id', 'admin.cart_item_viewed'),
  rule('PATCH', '/admin/cart-items/:id', 'admin.cart_item_updated', pick('quantity')),
  rule('DELETE', '/admin/cart-items/:id', 'admin.cart_item_removed'),

  rule('GET', '/admin/addresses', 'admin.address_list_viewed', fromQuery('userId')),
  rule('POST', '/admin/addresses', 'admin.address_created', pick('userId', 'label', 'isDefault')),
  rule('GET', '/admin/addresses/:id', 'admin.address_viewed'),
  rule('PATCH', '/admin/addresses/:id', 'admin.address_updated', changed(...ADDRESS_FIELDS)),
  rule('DELETE', '/admin/addresses/:id', 'admin.address_deleted'),

  rule('GET', '/admin/audit-logs', 'admin.audit_log_viewed'),
  rule('GET', '/admin/page-views', 'admin.page_views_viewed'),
];

const findRule = (method: string, path: string): AuditRule | undefined =>
  RULES.find((r) => r.method === method && r.pattern.test(path));

export const auditAs = (res: Response, annotation: AuditAnnotation): void => {
  res.locals.audit = annotation;
};

function fromAnnotation(req: Request, annotation: AuditAnnotation): NewAuditLog {
  return {
    ...annotation,
    userId: annotation.userId ?? req.user?.userId ?? null,
    userRole: annotation.userRole ?? req.user?.role ?? null,
  };
}

// A read the table does not name is left out: the catalog would otherwise write a row every time
// someone opens it. A write without a rule is still recorded, so nothing slips past unlogged.
function fromRoute(req: Request, path: string): NewAuditLog | null {
  const action = METHOD_ACTIONS[req.method];
  if (!req.user || !action) return null;

  const matched = findRule(req.method, path);
  if (matched?.event === null) return null;
  if (!matched && action === 'READ') return null;

  return {
    userId: req.user.userId,
    userRole: req.user.role,
    action,
    event: matched?.event ?? UNNAMED_EVENT,
    details: matched?.details?.(req),
  };
}

export const recordActivity = (req: Request, res: Response, next: NextFunction): void => {
  const path = req.path;

  res.on('finish', () => {
    const annotation = res.locals.audit as AuditAnnotation | undefined;
    const entry = annotation ? fromAnnotation(req, annotation) : fromRoute(req, path);
    if (entry) auditService.recordEvent({ ...requestSource(req), statusCode: res.statusCode, ...entry });
  });
  next();
};
