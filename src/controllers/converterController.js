import { calculateBurnItOff } from '../services/activityCalculator.js';
import { getDailyActivitySummary } from '../services/googleFitService.js';

/**
 * Feature 7: Burn It Off Converter
 * Translates meal calories into physical activity durations and tracks against Google Fit progress.
 */
export const convertMealToBurnActivity = async (req, res, next) => {
  try {
    const userId = req.user.id;
    let { calories, meal_id, weight_kg } = req.body;
    let foodName = 'Custom Meal';

    // 1. If meal_id is provided, retrieve calories and food_name from DB
    if (meal_id) {
      const { data: meal, error } = await req.supabase
        .from('meal_logs')
        .select('food_name, total_calories')
        .eq('id', meal_id)
        .eq('user_id', userId)
        .single();

      if (error || !meal) {
        return res.status(404).json({
          success: false,
          message: 'Meal log not found'
        });
      }

      calories = meal.total_calories;
      foodName = meal.food_name;
    }

    if (!calories || Number(calories) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid calories or meal_id is required'
      });
    }

    // 2. Determine user weight
    if (!weight_kg) {
      const { data: profile } = await req.supabase
        .from('profiles')
        .select('weight_kg')
        .eq('id', userId)
        .single();

      weight_kg = profile?.weight_kg || 65;
    }

    // 3. Fetch today's Google Fit activity for live tracking
    const currentFitActivity = await getDailyActivitySummary(userId, new Date());

    // 4. Calculate activity equivalents
    const burnPlan = calculateBurnItOff({
      calories: Number(calories),
      userWeightKg: Number(weight_kg),
      currentFitActivity
    });

    res.json({
      success: true,
      data: {
        food_name: foodName,
        ...burnPlan
      }
    });
  } catch (err) {
    next(err);
  }
};
