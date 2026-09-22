import { Request, Response } from 'express';
import { auditAs } from '../middleware/audit';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { parsePageView } from '../utils/validate';

export const record = asyncHandler(async (req: Request, res: Response) => {
  const { path, page } = parsePageView(req.body);
  auditAs(res, { action: 'PAGE_VIEW', event: 'page.viewed', method: null, path, details: page ? { page } : undefined });
  sendSuccess(res, null, 'Page view recorded.', 201);
});
