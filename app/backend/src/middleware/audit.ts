import { NextFunction, Request, Response } from 'express';
import { recordEvent, requestSource } from '../services/audit.service';
import { AuditAction, AuditAnnotation, AuditDetails, NewAuditLog } from '../types/auditLog.types';

type DetailsFn = (req: Request) => AuditDetails | undefined;

interface Rule {
  method: string;
  pattern: RegExp;
  event: string | null;
  details?: DetailsFn;
}

const METHOD_ACTIONS: Record<string, AuditAction> = {
  GET: 'READ', POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE',
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
  req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {};

function copy(source: Record<string, unknown>, keys: string[]): AuditDetails | undefined {
  const details: AuditDetails = {};
  for (const key of keys) {
    const val = safeValue(source[key]);
    if (val !== undefined) details[key] = val;
  }
  return Object.keys(details).length ? details : undefined;
}

const pick = (...keys: string[]): DetailsFn => (req) => copy(bodyOf(req), keys);

const fromQuery = (...keys: string[]): DetailsFn => (req) => copy(req.query, keys);

// Names the fields an update sent, never their values: one of them may be a password
const changed = (...keys: string[]): DetailsFn => (req) => {
  const body = bodyOf(req);
  const fields = keys.filter((key) => body[key] !== undefined);
  return fields.length ? { changed: fields } : undefined;
};

const itemCount = (field?: string): DetailsFn => (req) => {
  const items = field ? bodyOf(req)[field] : req.body;
  return Array.isArray(items) ? { items: items.length } : undefined;
};

const USER_FIELDS = ['firstName', 'lastName', 'username', 'password'];
const ADDRESS_FIELDS = ['fullName', 'phone', 'address', 'city', 'label', 'isDefault'];
const PRODUCT_FIELDS = [
  'name', 'price', 'category', 'image', 'description', 'previewImg', 'types', 'reviews',
  'overallRating', 'stock', 'isActive', 'shopId', 'shopName',
];

const rule = (method: string, route: string, event: string | null, details?: DetailsFn): Rule => ({
  method,
  pattern: new RegExp(`^${route.replace(/:\w+/g, '[^/]+')}/?$`, 'i'),
  event,
  details,
});

const RULES: Rule[] = [
  rule('GET',    '/auth/me',                       null),

  rule('GET',    '/users',                         'user.list_viewed'),
  rule('POST',   '/users',                         'user.created', pick('username')),
  rule('GET',    '/users/:id',                     'user.viewed'),
  rule('PUT',    '/users/:id',                     'user.updated', changed(...USER_FIELDS)),
  rule('DELETE', '/users/:id',                     'user.deleted'),

  rule('GET',    '/products',                      'product.list_viewed', fromQuery('category', 'search')),
  rule('GET',    '/products/popular',              'product.popular_viewed'),
  rule('GET',    '/products/categories',           'product.categories_viewed'),
  rule('GET',    '/products/:id',                  'product.viewed'),
  rule('POST',   '/products',                      'product.created', pick('name')),
  rule('POST',   '/products/bulk',                 'product.bulk_created', itemCount()),
  rule('PUT',    '/products/:id',                  'product.updated', changed(...PRODUCT_FIELDS)),
  rule('DELETE', '/products/:id',                  'product.deleted'),

  rule('GET',    '/orders',                        'order.list_viewed', fromQuery('status')),
  rule('GET',    '/orders/user/:userId/current',   'order.current_viewed'),
  rule('GET',    '/orders/user/:userId/completed', 'order.completed_viewed'),
  rule('GET',    '/orders/:id/products',           'order.products_viewed'),
  rule('POST',   '/orders/:id/products',           'order.product_added', pick('productId', 'quantity')),
  rule('GET',    '/orders/:id',                    'order.viewed'),
  rule('POST',   '/orders',                        'order.created', pick('status')),
  rule('PUT',    '/orders/:id',                    'order.updated', pick('status')),
  rule('DELETE', '/orders/:id',                    'order.deleted'),

  rule('GET',    '/cart',                          'cart.viewed'),
  rule('POST',   '/cart',                          'cart.item_added', pick('productId', 'quantity')),
  rule('POST',   '/cart/checkout',                 'cart.checked_out', itemCount('items')),
  rule('PUT',    '/cart/:id',                      'cart.item_updated', pick('quantity')),
  rule('DELETE', '/cart/:id',                      'cart.item_removed'),
  rule('DELETE', '/cart',                          'cart.cleared'),

  rule('GET',    '/addresses',                     'address.list_viewed'),
  rule('GET',    '/addresses/:id',                 'address.viewed'),
  rule('POST',   '/addresses',                     'address.created', pick('label', 'isDefault')),
  rule('PUT',    '/addresses/:id',                 'address.updated', changed(...ADDRESS_FIELDS)),
  rule('DELETE', '/addresses/:id',                 'address.deleted'),

  rule('GET',    '/admin/users',                   'admin.user_list_viewed'),
  rule('POST',   '/admin/users',                   'admin.user_created', pick('username', 'role')),
  rule('GET',    '/admin/users/:id',               'admin.user_viewed'),
  rule('PUT',    '/admin/users/:id',               'admin.user_updated', changed(...USER_FIELDS)),
  rule('PUT',    '/admin/users/:id/role',          'admin.user_role_changed', pick('role')),
  rule('DELETE', '/admin/users/:id',               'admin.user_deleted'),
  rule('GET',    '/admin/orders',                  'admin.order_list_viewed', fromQuery('status', 'userId')),
  rule('POST',   '/admin/orders',                  'admin.order_created', pick('userId', 'status')),
  rule('GET',    '/admin/orders/:id',              'admin.order_viewed'),
  rule('PUT',    '/admin/orders/:id',              'admin.order_updated', pick('status')),
  rule('DELETE', '/admin/orders/:id',              'admin.order_deleted'),
  rule('GET',    '/admin/orders/:id/products',     'admin.order_products_viewed'),
  rule('POST',   '/admin/orders/:id/products',     'admin.order_product_added', pick('productId', 'quantity')),
  rule('GET',    '/admin/carts',                   'admin.cart_list_viewed', fromQuery('userId')),
  rule('GET',    '/admin/carts/:userId',           'admin.cart_viewed'),
  rule('POST',   '/admin/carts/:userId',           'admin.cart_item_added', pick('productId', 'quantity')),
  rule('DELETE', '/admin/carts/:userId',           'admin.cart_cleared'),
  rule('GET',    '/admin/cart-items/:id',          'admin.cart_item_viewed'),
  rule('PUT',    '/admin/cart-items/:id',          'admin.cart_item_updated', pick('quantity')),
  rule('DELETE', '/admin/cart-items/:id',          'admin.cart_item_removed'),
  rule('GET',    '/admin/addresses',               'admin.address_list_viewed', fromQuery('userId')),
  rule('POST',   '/admin/addresses',               'admin.address_created', pick('userId', 'label', 'isDefault')),
  rule('GET',    '/admin/addresses/:id',           'admin.address_viewed'),
  rule('PUT',    '/admin/addresses/:id',           'admin.address_updated', changed(...ADDRESS_FIELDS)),
  rule('DELETE', '/admin/addresses/:id',           'admin.address_deleted'),
  rule('GET',    '/admin/audit-logs',              null),

  rule('POST',   '/page-views',                    'page.view_rejected'),
];

const findRule = (method: string, path: string): Rule | undefined =>
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

function fromRoute(req: Request, path: string): NewAuditLog | null {
  const action = METHOD_ACTIONS[req.method];
  if (!req.user || !action) return null;

  const matched = findRule(req.method, path);
  if (matched?.event === null) return null;

  return {
    userId: req.user.userId,
    userRole: req.user.role,
    action,
    event: matched?.event ?? UNNAMED_EVENT,
    details: matched?.details?.(req),
  };
}

export const recordActivity = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;

  res.on('finish', () => {
    const annotation: AuditAnnotation | undefined = res.locals.audit;
    const entry = annotation ? fromAnnotation(req, annotation) : fromRoute(req, path);
    if (entry) recordEvent({ ...requestSource(req), statusCode: res.statusCode, ...entry });
  });
  next();
};
