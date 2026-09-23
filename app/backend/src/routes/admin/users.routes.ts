import { Router } from 'express';
import * as users from '../../controllers/admin/users.controller';

const router = Router();

router.get('/', users.index);
router.post('/', users.create);
router.get('/:id', users.show);
router.patch('/:id', users.update);
router.put('/:id/role', users.updateRole);
router.put('/:id/password', users.resetPassword);
router.delete('/:id', users.destroy);

export default router;
