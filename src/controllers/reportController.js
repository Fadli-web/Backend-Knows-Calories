import { generateWeeklyInsights } from '../services/geminiService.js';
import { generateWeeklyReportPDF } from '../services/pdfService.js';
import { supabaseAdmin } from '../config/supabase.js';

/**
 * Helper to aggregate 7 days of data for a user
 */
const aggregateWeeklyData = async (supabase, userId) => {
  // Dates for the last 7 days
  const now = new Date();
  const endDateStr = now.toISOString().split('T')[0];
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(now.getDate() - 6);
  const startDateStr = sevenDaysAgo.toISOString().split('T')[0];

  // 1. Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  const userProfile = profile || {
    name: 'CalorieKnows User',
    daily_calorie_target: 2000,
    target_protein_g: 150,
    target_carbs_g: 200,
    target_fat_g: 65,
    activity_level: 'moderately_active'
  };

  // 2. Fetch meal logs for the last 7 days
  const { data: meals } = await supabase
    .from('meal_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('logged_at', `${startDateStr}T00:00:00.000Z`)
    .lte('logged_at', `${endDateStr}T23:59:59.999Z`);

  // 3. Fetch activity logs for the last 7 days
  const { data: activities } = await supabase
    .from('activity_logs')
    .select('*')
    .eq('user_id', userId)
    .gte('date', startDateStr)
    .lte('date', endDateStr);

  // 4. Group by day
  const dailyMap = {};
  for (let d = 0; d < 7; d++) {
    const curDate = new Date(sevenDaysAgo);
    curDate.setDate(sevenDaysAgo.getDate() + d);
    const dateStr = curDate.toISOString().split('T')[0];
    dailyMap[dateStr] = {
      date: dateStr,
      calories: 0,
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fiber_g: 0,
      sodium_mg: 0,
      steps: 0,
      calories_burned: 0
    };
  }

  (meals || []).forEach(meal => {
    const dateStr = meal.logged_at.split('T')[0];
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].calories += Number(meal.total_calories || 0);
      dailyMap[dateStr].protein_g += Number(meal.protein_g || 0);
      dailyMap[dateStr].carbs_g += Number(meal.carbs_g || 0);
      dailyMap[dateStr].fat_g += Number(meal.fat_g || 0);
      dailyMap[dateStr].fiber_g += Number(meal.fiber_g || 0);
      dailyMap[dateStr].sodium_mg += Number(meal.sodium_mg || 0);
    }
  });

  (activities || []).forEach(act => {
    const dateStr = act.date;
    if (dailyMap[dateStr]) {
      dailyMap[dateStr].steps += Number(act.steps || 0);
      dailyMap[dateStr].calories_burned += Number(act.calories_burned || 0);
    }
  });

  const dailyBreakdown = Object.values(dailyMap);

  // 5. Compute Totals & Averages
  const totalDays = dailyBreakdown.length || 7;
  const totals = dailyBreakdown.reduce((acc, day) => ({
    total_calories: acc.total_calories + day.calories,
    total_burned: acc.total_burned + day.calories_burned,
    total_steps: acc.total_steps + day.steps,
    total_protein_g: acc.total_protein_g + day.protein_g,
    total_carbs_g: acc.total_carbs_g + day.carbs_g,
    total_fat_g: acc.total_fat_g + day.fat_g
  }), {
    total_calories: 0,
    total_burned: 0,
    total_steps: 0,
    total_protein_g: 0,
    total_carbs_g: 0,
    total_fat_g: 0
  });

  const averages = {
    avg_daily_calories: Math.round(totals.total_calories / totalDays),
    avg_daily_burned: Math.round(totals.total_burned / totalDays),
    avg_daily_steps: Math.round(totals.total_steps / totalDays),
    avg_daily_protein_g: Math.round((totals.total_protein_g / totalDays) * 10) / 10,
    avg_daily_carbs_g: Math.round((totals.total_carbs_g / totalDays) * 10) / 10,
    avg_daily_fat_g: Math.round((totals.total_fat_g / totalDays) * 10) / 10
  };

  return {
    userProfile,
    startDate: startDateStr,
    endDate: endDateStr,
    dailyBreakdown,
    totals: {
      ...totals,
      ...averages
    }
  };
};

/**
 * Feature 8: Get Weekly Nutrition & Activity Report (JSON)
 */
export const getWeeklyReport = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { refresh } = req.query;

    const aggregated = await aggregateWeeklyData(req.supabase, userId);

    // Check if report cached for this range
    let aiInsights = null;
    if (refresh !== 'true') {
      const { data: cached } = await req.supabase
        .from('weekly_reports')
        .select('*')
        .eq('user_id', userId)
        .eq('start_date', aggregated.startDate)
        .eq('end_date', aggregated.endDate)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cached) {
        aiInsights = cached.ai_insights;
      }
    }

    if (!aiInsights) {
      aiInsights = await generateWeeklyInsights({
        weeklySummary: aggregated,
        userProfile: aggregated.userProfile
      });

      // Cache report to weekly_reports table
      await supabaseAdmin
        .from('weekly_reports')
        .insert({
          user_id: userId,
          start_date: aggregated.startDate,
          end_date: aggregated.endDate,
          summary_data: aggregated.totals,
          ai_insights: aiInsights
        })
        .catch(err => console.warn('Warning: Failed to cache weekly report:', err.message));
    }

    res.json({
      success: true,
      data: {
        ...aggregated,
        ai_insights: aiInsights
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Feature 8: Export Weekly Nutrition Report as Downloadable PDF
 */
export const exportWeeklyReportPDF = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const aggregated = await aggregateWeeklyData(req.supabase, userId);

    // Check cached or generate AI Insights
    let aiInsights = null;
    const { data: cached } = await req.supabase
      .from('weekly_reports')
      .select('*')
      .eq('user_id', userId)
      .eq('start_date', aggregated.startDate)
      .eq('end_date', aggregated.endDate)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (cached) {
      aiInsights = cached.ai_insights;
    } else {
      aiInsights = await generateWeeklyInsights({
        weeklySummary: aggregated,
        userProfile: aggregated.userProfile
      });

      await supabaseAdmin
        .from('weekly_reports')
        .insert({
          user_id: userId,
          start_date: aggregated.startDate,
          end_date: aggregated.endDate,
          summary_data: aggregated.totals,
          ai_insights: aiInsights
        })
        .catch(err => console.warn('Warning: Failed to cache weekly report:', err.message));
    }

    const pdfBuffer = await generateWeeklyReportPDF({
      userProfile: aggregated.userProfile,
      startDate: aggregated.startDate,
      endDate: aggregated.endDate,
      dailyBreakdown: aggregated.dailyBreakdown,
      totals: aggregated.totals,
      aiInsights
    });

    const filename = `CalorieKnows-Weekly-Report-${aggregated.startDate}-to-${aggregated.endDate}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);

    res.end(pdfBuffer);
  } catch (err) {
    next(err);
  }
};
