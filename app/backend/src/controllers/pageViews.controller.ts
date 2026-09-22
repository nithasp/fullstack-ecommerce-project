import { Request, Response } from 'express';
import { auditAs } from '../middleware/audit';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import { parsePageView } from '../utils/validate';

// The frontend reports each page a signed-in user opens. The report becomes one PAGE_VIEW row in
// the audit log, with the page's path standing in for the API route and no HTTP method.
export const record = asyncHandler(async (req: Request, res: Response) => {
  const { path, page } = parsePageView(req.body);
  auditAs(res, { action: 'PAGE_VIEW', event: 'page.viewed', method: null, path, details: page ? { page } : undefined });
  sendSuccess(res, null, 'Page view recorded.', 201);
});
