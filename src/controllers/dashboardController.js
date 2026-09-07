import { getDailyActivitySummary } from '../services/googleFitService.js';

/**
 * Real-time Dashboard Summary for Progress Rings and Daily Balance
 */
export const getDashboardSummary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today}T00:00:00.000Z`;
    const endOfDay = `${today}T23:59:59.999Z`;

    // 1. Get user profile & target goals
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

    // 2. Fetch today's meals
    const { data: meals } = await req.supabase
      .from('meal_logs')
      .select('*')
      .eq('user_id', userId)
      .gte('logged_at', startOfDay)
      .lte('logged_at', endOfDay)
      .order('logged_at', { ascending: true });

    // Group meals by meal_type
    const mealBreakdown = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snack: []
    };

    let totalCalories = 0;
    let totalProtein = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalFiber = 0;
    let totalSugar = 0;
    let totalSodium = 0;

    (meals || []).forEach(meal => {
      const type = meal.meal_type || 'snack';
      if (mealBreakdown[type]) {
        mealBreakdown[type].push(meal);
      } else {
        mealBreakdown.snack.push(meal);
      }

      totalCalories += Number(meal.total_calories || 0);
      totalProtein += Number(meal.protein_g || 0);
      totalCarbs += Number(meal.carbs_g || 0);
      totalFat += Number(meal.fat_g || 0);
      totalFiber += Number(meal.fiber_g || 0);
      totalSugar += Number(meal.sugar_g || 0);
      totalSodium += Number(meal.sodium_mg || 0);
    });

    // 3. Fetch live Google Fit metrics
    const fitData = await getDailyActivitySummary(userId, new Date());

    // 4. Calculate Net Energy Balance and Remaining Quotas
    const dailyTarget = userProfile.daily_calorie_target || 2000;
    const burnedCalories = fitData.calories_burned || 0;
    const netCalories = totalCalories - burnedCalories;
    const remainingCalories = Math.max(0, dailyTarget - totalCalories);

    const progressPercentage = dailyTarget > 0 
      ? Math.min(100, Math.round((totalCalories / dailyTarget) * 100))
      : 0;

    // Macro progress
    const proteinTarget = userProfile.target_protein_g || 150;
    const carbsTarget = userProfile.target_carbs_g || 200;
    const fatTarget = userProfile.target_fat_g || 65;

    const macroProgress = {
      protein: {
        consumed: Math.round(totalProtein * 10) / 10,
        target: proteinTarget,
        percentage: Math.min(100, Math.round((totalProtein / proteinTarget) * 100))
      },
      carbs: {
        consumed: Math.round(totalCarbs * 10) / 10,
        target: carbsTarget,
        percentage: Math.min(100, Math.round((totalCarbs / carbsTarget) * 100))
      },
      fat: {
        consumed: Math.round(totalFat * 10) / 10,
        target: fatTarget,
        percentage: Math.min(100, Math.round((totalFat / fatTarget) * 100))
      }
    };

    // Check if evening and quota not met
    const currentHour = new Date().getHours();
    const needsClosingMeal = remainingCalories > 200 && currentHour >= 16;

    res.json({
      success: true,
      data: {
        date: today,
        rings: {
          calories: {
            consumed: Math.round(totalCalories),
            target: dailyTarget,
            burned: Math.round(burnedCalories),
            net: Math.round(netCalories),
            remaining: Math.round(remainingCalories),
            percentage: progressPercentage
          },
          steps: {
            current: fitData.steps || 0,
            target: 10000,
            percentage: Math.min(100, Math.round(((fitData.steps || 0) / 10000) * 100))
          },
          macros: macroProgress
        },
        google_fit: {
          connected: fitData.connected,
          steps: fitData.steps,
          calories_burned: fitData.calories_burned,
          distance_meters: fitData.distance_meters
        },
        meal_breakdown: mealBreakdown,
        needs_closing_recommendation: needsClosingMeal,
        nutrients_summary: {
          fiber_g: Math.round(totalFiber * 10) / 10,
          sugar_g: Math.round(totalSugar * 10) / 10,
          sodium_mg: Math.round(totalSodium)
        }
      }
    });
  } catch (err) {
    next(err);
  }
};
