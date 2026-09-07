import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getClosingMealRecommendations } from '../controllers/recommendationController.js';

const router = Router();

router.use(requireAuth);

router.get('/daily-closing', getClosingMealRecommendations);

export default router;
