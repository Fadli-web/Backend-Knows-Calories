import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWeeklyReport, exportWeeklyReportPDF } from '../controllers/reportController.js';

const router = Router();

router.use(requireAuth);

router.get('/weekly', getWeeklyReport);
router.get('/weekly/pdf', exportWeeklyReportPDF);

export default router;
