import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

// Import route modules
import authRoutes from './routes/authRoutes.js';
import scannerRoutes from './routes/scannerRoutes.js';
import googleFitRoutes from './routes/googleFitRoutes.js';
import recommendationRoutes from './routes/recommendationRoutes.js';
import converterRoutes from './routes/converterRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

const app = express();

// Middleware
app.use(cors({
  origin: env.CLIENT_URL === '*' ? '*' : env.CLIENT_URL.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'CalorieKnows Backend API',
    version: '1.0.0',
    env: env.NODE_ENV
  });
});

// Root API Endpoint with Route Directory
app.get('/', (req, res) => {
  res.json({
    name: 'CalorieKnows Backend API',
    description: 'AI-Powered Nutrition & Google Fit Health Ecosystem',
    version: '1.0.0',
    endpoints: {
      health: 'GET /api/health',
      auth_profile: {
        register: 'POST /api/auth/register (email, password, name)',
        login: 'POST /api/auth/login (email, password)',
        profile: 'GET /api/auth/profile',
        update_profile: 'PUT /api/auth/profile',
        save_google_token: 'POST /api/auth/google-token',
        google_status: 'GET /api/auth/google-status'
      },
      scanner: {
        snap_and_log: 'POST /api/scanner/food (multipart/base64 + context_hint)',
        label_scanner: 'POST /api/scanner/label (multipart/base64)',
        log_meal: 'POST /api/scanner/log-meal',
        get_meals: 'GET /api/scanner/meals',
        delete_meal: 'DELETE /api/scanner/meals/:id'
      },
      google_fit: {
        daily_summary: 'GET /api/google-fit/daily-summary',
        sync_meal: 'POST /api/google-fit/sync-meal'
      },
      smart_meal_recommender: {
        daily_closing: 'GET /api/recommendations/daily-closing'
      },
      burn_it_off: {
        convert: 'POST /api/converter/burn-it-off'
      },
      reports: {
        weekly_json: 'GET /api/reports/weekly',
        weekly_pdf: 'GET /api/reports/weekly/pdf'
      },
      dashboard: {
        summary: 'GET /api/dashboard/summary'
      }
    }
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/scanner', scannerRoutes);
app.use('/api/google-fit', googleFitRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/converter', converterRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Fallback Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
