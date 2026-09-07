import { getSmartMealRecommendations } from '../services/geminiService.js';
import { getDailyActivitySummary } from '../services/googleFitService.js';

/**
 * Feature 6: Smart Meal Recommender
 * Compares today's food intake vs target and Google Fit burned calories to provide
 * localized closing meal recommendations.
 */
export const getClosingMealRecommendations = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { meal_type = 'dinner', preference = '' } = req.query;

    // 1. Get user profile
    const { data: profile } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    const userProfile = profile || {
      daily_calorie_target: 2000,
      target_protein_g: 150,
      target_carbs_g: 200,
      target_fat_g: 65
    };

    // 2. Fetch today's consumed meals from Supabase
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    const { data: todayMeals } = await req.supabase
      .from('meal_logs')
      .select('total_calories, protein_g, carbs_g, fat_g')
      .eq('user_id', userId)
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay);

    const todayIntake = (todayMeals || []).reduce((acc, meal) => ({
      total_calories: acc.total_calories + Number(meal.total_calories || 0),
      protein_g: acc.protein_g + Number(meal.protein_g || 0),
      carbs_g: acc.carbs_g + Number(meal.carbs_g || 0),
      fat_g: acc.fat_g + Number(meal.fat_g || 0)
    }), { total_calories: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });

    // 3. Fetch live Google Fit activity
    const googleFitData = await getDailyActivitySummary(userId, new Date());

    // 4. Generate AI Recommendations with Gemini
    const recommendations = await getSmartMealRecommendations({
      userProfile,
      todayIntake,
      googleFitData,
      mealType,
      userPreference: preference
    });

    res.json({
      success: true,
      data: {
        date: today,
        user_intake_today: todayIntake,
        google_fit: {
          steps: googleFitData.steps,
          calories_burned: googleFitData.calories_burned,
          connected: googleFitData.connected
        },
        ...recommendations
      }
    });
  } catch (err) {
    next(err);
  }
};
