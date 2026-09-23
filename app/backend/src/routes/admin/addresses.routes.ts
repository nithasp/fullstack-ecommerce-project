import { Router } from 'express';
import * as addresses from '../../controllers/admin/addresses.controller';

const router = Router();

router.get('/', addresses.index);
router.post('/', addresses.create);
router.get('/:id', addresses.show);
router.patch('/:id', addresses.update);
router.delete('/:id', addresses.destroy);

export default router;
