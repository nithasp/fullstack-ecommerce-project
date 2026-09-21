import { Router } from 'express';
import * as users from '../controllers/users.controller';
import { verifyAuthToken, requireAdmin } from '../middleware/auth';

const router = Router();

router.use(verifyAuthToken);

// Listing and creating accounts is an admin function; get/update/delete are limited to the token user
// unless the token belongs to an admin (OWASP API1/API5)
router.get('/',       requireAdmin, users.index);
router.get('/:id',    users.show);
router.post('/',      requireAdmin, users.create);
router.put('/:id',    users.update);
router.delete('/:id', users.destroy);

export default router;
