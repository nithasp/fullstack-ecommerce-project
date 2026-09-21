import { Router } from 'express';
import * as addresses from '../controllers/addresses.controller';
import { verifyAuthToken } from '../middleware/auth';

const router = Router();

router.use(verifyAuthToken);

router.get('/',       addresses.getAddresses);
router.get('/:id',    addresses.getAddress);
router.post('/',      addresses.createAddress);
router.put('/:id',    addresses.updateAddress);
router.delete('/:id', addresses.deleteAddress);

export default router;
