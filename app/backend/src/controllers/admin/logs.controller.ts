import { Request, Response } from 'express';
import { auditLogFiltersSchema } from '../../schemas/auditLog.schema';
import { paginationSchema } from '../../schemas/common.schema';
import { pageViewFiltersSchema } from '../../schemas/pageView.schema';
import { listAuditLogs } from '../../services/audit.service';
import { listPageViews } from '../../services/pageView.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendPage } from '../../utils/response';
import { parse } from '../../utils/validation';

export const auditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { action, ...rest } = parse(auditLogFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await listAuditLogs({ ...rest, actions: action }, page);
  sendPage(res, items, { ...page, total }, 'Audit logs fetched.');
});

export const pageViews = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(pageViewFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await listPageViews(filters, page);
  sendPage(res, items, { ...page, total }, 'Page views fetched.');
});
