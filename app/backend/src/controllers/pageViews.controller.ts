import { Request, Response } from 'express';
import { pageViewSchema } from '../schemas/pageView.schema';
import { recordPageView } from '../services/pageView.service';
import { requireUser } from '../services/user.service';
import { asyncHandler } from '../utils/asyncHandler';
import { currentUserId } from '../utils/request';
import { sendSuccess } from '../utils/response';
import { parse } from '../utils/validation';

export const record = asyncHandler(async (req: Request, res: Response) => {
  const { path, page } = parse(pageViewSchema, req.body);
  const user = await requireUser(currentUserId(req));

  await recordPageView({
    userId: user.id,
    username: user.username,
    path,
    page: page ?? null,
    ipAddress: req.ip ?? null,
    userAgent: req.get('user-agent') ?? null,
  });

  sendSuccess(res, null, 'Page view recorded.', 201);
});
