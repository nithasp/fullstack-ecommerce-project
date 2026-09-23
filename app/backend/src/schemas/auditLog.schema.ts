import { z } from 'zod';
import { AUDIT_ACTIONS, AUDIT_RESULTS, AuditAction } from '../types/auditLog.types';
import { positiveInt, searchText } from './common.schema';

const actionList = `must be one or more of: ${AUDIT_ACTIONS.join(', ')}`;

const actionsSchema = z
  .preprocess(
    (value) =>
      typeof value === 'string'
        ? [
            ...new Set(
              value
                .split(',')
                .map((action) => action.trim().toUpperCase())
                .filter(Boolean),
            ),
          ]
        : value,
    z.array(z.string(), actionList),
  )
  .refine(
    (actions) =>
      actions.length > 0 && actions.every((action) => (AUDIT_ACTIONS as readonly string[]).includes(action)),
    { error: actionList },
  )
  .transform((actions) => actions as AuditAction[]);

export const auditLogFiltersSchema = z.object({
  userId: positiveInt.optional(),
  username: searchText,
  action: actionsSchema.optional(),
  result: z.enum(AUDIT_RESULTS, { error: `must be one of: ${AUDIT_RESULTS.join(', ')}` }).optional(),
  from: z.coerce.date('must be a date, e.g. 2026-09-22T00:00:00Z').optional(),
  to: z.coerce.date('must be a date, e.g. 2026-09-22T00:00:00Z').optional(),
});
