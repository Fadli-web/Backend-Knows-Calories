import { Router } from 'express';
import multer from 'multer';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import {
  scanFood,
  scanNutritionLabel,
  logMeal,
  getMeals,
  deleteMeal
} from '../controllers/scannerController.js';

const router = Router();

// Configure in-memory upload (no local disk writes, optimal for Vercel Serverless)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB maximum file size
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP) are allowed!'), false);
    }
  }
});

// Snap & Log Scanner (can scan with optional auth)
router.post('/food', optionalAuth, upload.single('image'), scanFood);

// Nutrition Label Scanner (can scan with optional auth)
router.post('/label', optionalAuth, upload.single('image'), scanNutritionLabel);

// Meal Logging & History (requires auth)
router.post('/log-meal', requireAuth, logMeal);
router.get('/meals', requireAuth, getMeals);
router.delete('/meals/:id', requireAuth, deleteMeal);

export default router;
