import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
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

router.use(requireAuth);

// Snap & Log Scanner (multipart "image" or JSON image_base64)
router.post('/food', upload.single('image'), scanFood);

// Nutrition Label Scanner (multipart "image" or JSON image_base64)
router.post('/label', upload.single('image'), scanNutritionLabel);

// Meal Logging & History
router.post('/log-meal', logMeal);
router.get('/meals', getMeals);
router.delete('/meals/:id', deleteMeal);

export default router;
