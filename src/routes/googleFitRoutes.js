import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getDailySummary, syncMeal } from '../controllers/googleFitController.js';

const router = Router();

router.use(requireAuth);

router.get('/daily-summary', getDailySummary);
router.post('/sync-meal', syncMeal);

export default router;
