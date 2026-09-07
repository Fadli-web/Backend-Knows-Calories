import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  registerWithEmail,
  loginWithEmail,
  getProfile,
  updateProfile,
  saveGoogleToken,
  getGoogleFitStatus
} from '../controllers/authController.js';

const router = Router();

// Public Authentication Endpoints (Email & Password)
router.post('/register', registerWithEmail);
router.post('/login', loginWithEmail);

// Protected Endpoints (Require Supabase JWT Bearer token)
router.get('/profile', requireAuth, getProfile);
router.put('/profile', requireAuth, updateProfile);
router.post('/google-token', requireAuth, saveGoogleToken);
router.get('/google-status', requireAuth, getGoogleFitStatus);

export default router;
