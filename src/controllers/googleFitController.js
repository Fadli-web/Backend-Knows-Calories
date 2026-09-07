import { getDailyActivitySummary, syncMealToGoogleFit } from '../services/googleFitService.js';

/**
 * Feature 2: Get today's live steps and active burned calories from Google Fit API
 */
export const getDailySummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date } = req.query;

    const targetDate = date ? new Date(date) : new Date();
    const activity = await getDailyActivitySummary(userId, targetDate);

    res.json({
      success: true,
      data: activity
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Manually sync an existing meal log to Google Fit
 */
export const syncMeal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { meal_id } = req.body;

    if (!meal_id) {
      return res.status(400).json({
        success: false,
        message: 'meal_id is required'
      });
    }

    // Fetch meal from database
    const { data: meal, error } = await req.supabase
      .from('meal_logs')
      .select('*')
      .eq('id', meal_id)
      .eq('user_id', userId)
      .single();

    if (error || !meal) {
      return res.status(404).json({
        success: false,
        message: 'Meal log not found'
      });
    }

    const syncResult = await syncMealToGoogleFit(userId, meal);

    res.json({
      success: syncResult.success,
      message: syncResult.message || 'Synced with Google Fit',
      data: syncResult
    });
  } catch (err) {
    next(err);
  }
};
