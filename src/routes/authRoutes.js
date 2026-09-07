import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  getProfile,
  updateProfile,
  saveGoogleToken,
  getGoogleFitStatus
} from '../controllers/authController.js';

const router = Router();

// All auth/profile routes require authentication
router.use(requireAuth);

router.get('/profile', getProfile);
router.put('/profile', updateProfile);
router.post('/google-token', saveGoogleToken);
router.get('/google-status', getGoogleFitStatus);

export default router;
