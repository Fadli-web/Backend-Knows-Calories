import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { convertMealToBurnActivity } from '../controllers/converterController.js';

const router = Router();

router.use(requireAuth);

router.post('/burn-it-off', convertMealToBurnActivity);

export default router;
