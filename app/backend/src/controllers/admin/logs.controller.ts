import { Request, Response } from 'express';
import { auditLogFiltersSchema } from '../../schemas/auditLog.schema';
import { paginationSchema } from '../../schemas/common.schema';
import { pageViewFiltersSchema } from '../../schemas/pageView.schema';
import { auditService, pageViewService } from '../../services';
import { asyncHandler } from '../../utils/asyncHandler';
import { sendSuccess } from '../../utils/response';
import { parse } from '../../utils/validation';

export const auditLogs = asyncHandler(async (req: Request, res: Response) => {
  const { action, ...rest } = parse(auditLogFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await auditService.listAuditLogs({ ...rest, actions: action }, page);
  sendSuccess(res, items, 'Audit logs fetched.', 200, { ...page, total });
});

export const pageViews = asyncHandler(async (req: Request, res: Response) => {
  const filters = parse(pageViewFiltersSchema, req.query);
  const page = parse(paginationSchema, req.query);
  const { items, total } = await pageViewService.listPageViews(filters, page);
  sendSuccess(res, items, 'Page views fetched.', 200, { ...page, total });
});
