import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../config/env.js';

const getModel = (modelName = 'gemini-1.5-flash', jsonMode = true) => {
  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables.');
  }

  const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: jsonMode ? { responseMimeType: 'application/json' } : {}
  });
};

/**
 * Converts a file Buffer to the Gemini inlineData part format
 */
export const fileToGenerativePart = (buffer, mimeType) => {
  return {
    inlineData: {
      data: buffer.toString('base64'),
      mimeType
    }
  };
};

/**
 * Feature 3 & 4: Snap & Log - Food Photo Analysis with Context Hint
 * Dissects food items, estimates portion size in grams, and computes calories + macros.
 */
export const analyzeFoodImage = async ({ imageBuffer, mimeType, contextHint = '' }) => {
  const model = getModel('gemini-1.5-flash', true);

  const prompt = `
You are an expert clinical dietitian and computer vision nutritionist for the CalorieKnows application.
Analyze the provided food dish image thoroughly.

${contextHint ? `USER PROVIDED CONTEXT HINT (Important invisible details like cut of meat, oil used, sweetness, preparation method): "${contextHint}"` : 'No additional context hint provided.'}

INSTRUCTIONS:
1. Identify all distinct food items or ingredients visible in the dish or drink.
2. Estimate the realistic portion weight in grams for each component based on standard plating sizes and the user context hint.
3. Calculate the nutritional content for each item and summarize the whole meal:
   - calories (kcal)
   - protein (grams)
   - carbohydrates (grams)
   - fat (grams)
   - dietary fiber (grams)
   - sugars (grams)
   - sodium (milligrams)
4. Account for cooking oils, gravies, and dressings (incorporating the context hint if specified).
5. Provide a health evaluation note and confidence score (0.0 to 1.0).

OUTPUT FORMAT:
Return strictly valid JSON matching this structure:
{
  "food_name": "Primary name of the dish (e.g. Nasi Ayam Bakar & Sayur Lalapan)",
  "total_calories": 580,
  "protein_g": 38.5,
  "carbs_g": 62.0,
  "fat_g": 18.2,
  "fiber_g": 5.4,
  "sugar_g": 6.1,
  "sodium_mg": 620,
  "confidence_score": 0.92,
  "summary": "Brief 1-2 sentence description of the meal composition",
  "health_insights": "Brief dietitian remark on macro balance or nutritional highlights",
  "items": [
    {
      "item_name": "Dada Ayam Bakar tanpa kulit",
      "portion_estimate_grams": 150,
      "calories": 240,
      "protein_g": 31.0,
      "carbs_g": 4.0,
      "fat_g": 5.0,
      "notes": "Dibakar dengan olesan kecap manis tipis"
    },
    {
      "item_name": "Nasi Putih",
      "portion_estimate_grams": 150,
      "calories": 195,
      "protein_g": 3.5,
      "carbs_g": 43.0,
      "fat_g": 0.5,
      "notes": "1 centong sedang"
    }
  ]
}
`;

  const imagePart = fileToGenerativePart(imageBuffer, mimeType);
  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text();

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error('Failed to parse Gemini JSON output:', responseText);
    throw new Error('AI analysis produced invalid JSON response');
  }
};

/**
 * Feature 5: Nutrition Label Scanner
 * Extracts nutritional facts directly from packaged food/beverage labels.
 */
export const analyzeNutritionLabel = async ({ imageBuffer, mimeType, contextHint = '' }) => {
  const model = getModel('gemini-1.5-flash', true);

  const prompt = `
You are an expert food packaging analyst for the CalorieKnows application.
Extract all nutritional information accurately from the provided nutrition facts label (Informasi Nilai Gizi).

${contextHint ? `ADDITIONAL CONTEXT: "${contextHint}"` : ''}

INSTRUCTIONS:
1. Extract the product name or brand if visible on the packaging.
2. Read the serving size (Takaran Saji) and servings per container (Jumlah Sajian per Kemasan).
3. Extract per-serving values for:
   - calories / energi total (kcal)
   - calories from fat / energi dari lemak (kcal)
   - total fat / lemak total (g)
   - saturated fat / lemak jenuh (g)
   - trans fat / lemak trans (g)
   - cholesterol / kolesterol (mg)
   - sodium / natrium (mg)
   - total carbohydrate / karbohidrat total (g)
   - dietary fiber / serat pangan (g)
   - total sugar / gula (g)
   - added sugar / gula tambahan (g)
   - protein (g)
4. Extract any prominent vitamins or minerals listed.
5. If servings per container > 1, compute total package calories and macros as well.

OUTPUT FORMAT:
Return strictly valid JSON matching this structure:
{
  "product_name": "Product or Brand Name if found",
  "serving_size": "e.g. 30g / 1 bungkus (250 ml)",
  "servings_per_container": 2.5,
  "per_serving": {
    "calories": 140,
    "calories_from_fat": 45,
    "total_fat_g": 5,
    "saturated_fat_g": 2.5,
    "trans_fat_g": 0,
    "cholesterol_mg": 0,
    "sodium_mg": 180,
    "total_carbs_g": 21,
    "dietary_fiber_g": 2,
    "total_sugar_g": 9,
    "added_sugar_g": 7,
    "protein_g": 3
  },
  "total_package": {
    "calories": 350,
    "total_fat_g": 12.5,
    "sodium_mg": 450,
    "total_carbs_g": 52.5,
    "total_sugar_g": 22.5,
    "protein_g": 7.5
  },
  "vitamins_and_minerals": [
    { "name": "Kalsium", "percentage": "15%" },
    { "name": "Vitamin D", "percentage": "10%" }
  ],
  "health_assessment": "Short summary of whether this is high sodium, high sugar, or good protein source"
}
`;

  const imagePart = fileToGenerativePart(imageBuffer, mimeType);
  const result = await model.generateContent([prompt, imagePart]);
  const responseText = result.response.text();

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error('Failed to parse Gemini Nutrition Label JSON:', responseText);
    throw new Error('AI label scanner produced invalid JSON response');
  }
};

/**
 * Feature 6: Smart Meal Recommender
 * Compares intake vs targets and Google Fit burned calories, recommending localized meals
 * to precisely close remaining daily deficits.
 */
export const getSmartMealRecommendations = async ({
  userProfile,
  todayIntake,
  googleFitData,
  mealType = 'dinner',
  userPreference = ''
}) => {
  const model = getModel('gemini-1.5-flash', true);

  const dailyTarget = userProfile.daily_calorie_target || 2000;
  const targetProtein = userProfile.target_protein_g || 120;
  const targetCarbs = userProfile.target_carbs_g || 220;
  const targetFat = userProfile.target_fat_g || 60;

  const consumedCalories = todayIntake.total_calories || 0;
  const consumedProtein = todayIntake.protein_g || 0;
  const consumedCarbs = todayIntake.carbs_g || 0;
  const consumedFat = todayIntake.fat_g || 0;

  const burnedCalories = googleFitData.calories_burned || 0;
  const steps = googleFitData.steps || 0;

  // Remaining budget
  const remainingCalories = Math.max(0, dailyTarget - consumedCalories + (burnedCalories > 0 ? Math.round(burnedCalories * 0.5) : 0));
  const remainingProtein = Math.max(0, targetProtein - consumedProtein);
  const remainingCarbs = Math.max(0, targetCarbs - consumedCarbs);
  const remainingFat = Math.max(0, targetFat - consumedFat);

  const prompt = `
You are the CalorieKnows Smart Meal Recommender AI, specializing in healthy Indonesian and Southeast Asian localized culinary nutrition.

USER CURRENT STATE:
- Daily Calorie Target: ${dailyTarget} kcal (Protein: ${targetProtein}g, Carbs: ${targetCarbs}g, Fat: ${targetFat}g)
- Consumed Today: ${consumedCalories} kcal (Protein: ${consumedProtein}g, Carbs: ${consumedCarbs}g, Fat: ${consumedFat}g)
- Google Fit Active Burned: ${burnedCalories} kcal (${steps} steps recorded)
- Estimated Remaining Calorie Budget: ${remainingCalories} kcal
- Remaining Macro Deficit: Protein: ${remainingProtein}g, Carbs: ${remainingCarbs}g, Fat: ${remainingFat}g
- Target Meal Time: ${mealType}
${userPreference ? `- User Dietary Notes / Preferences: "${userPreference}"` : ''}

GOAL:
Provide 3 distinct, highly realistic localized menu recommendations (focusing on accessible Indonesian cuisine or healthy meal prep) that fit within the remaining calorie budget and specifically help achieve the protein/macro targets for the closing meal of the day.

OUTPUT FORMAT:
Return strictly valid JSON matching this structure:
{
  "target_summary": {
    "remaining_calories": ${remainingCalories},
    "remaining_protein_g": ${remainingProtein},
    "remaining_carbs_g": ${remainingCarbs},
    "remaining_fat_g": ${remainingFat}
  },
  "dietitian_advice": "1-2 sentences explaining why these selections fit the user's daily budget and activity balance",
  "recommendations": [
    {
      "menu_name": "e.g. Pepes Tahu Jamur + Sup Dada Ayam Jamur",
      "tag": "Tinggi Protein / Rendah Lemak",
      "calories": 380,
      "protein_g": 35.0,
      "carbs_g": 25.0,
      "fat_g": 8.0,
      "description": "Hidangan lezat kaya protein dan serat tanpa minyak berlebih.",
      "ingredients": [
        "150g Dada ayam rebus suwir",
        "1 kotak Tahu putih kukus",
        "Sayuran sup (wortel, buncis, seledri)"
      ],
      "cooking_tip": "Hindari menggoreng; gunakan metode kukus atau kuah bening untuk menjaga kuota kalori malam hari."
    }
  ]
}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error('Failed to parse Gemini Meal Recommendation JSON:', responseText);
    throw new Error('AI meal recommender produced invalid JSON response');
  }
};

/**
 * Feature 8: Weekly Nutrition Report - AI Insights
 * Evaluates 7-day intake, macronutrient consistency, and activity correlation from Google Fit.
 */
export const generateWeeklyInsights = async ({ weeklySummary, userProfile }) => {
  const model = getModel('gemini-1.5-flash', true);

  const prompt = `
You are the chief nutrition analyst for CalorieKnows. Evaluate the user's weekly health, nutrition, and physical activity report.

USER PROFILE:
- Name: ${userProfile.name || 'CalorieKnows Member'}
- Daily Calorie Target: ${userProfile.daily_calorie_target || 2000} kcal
- Activity Level: ${userProfile.activity_level || 'moderately_active'}

WEEKLY AGGREGATED DATA:
${JSON.stringify(weeklySummary, null, 2)}

INSTRUCTIONS:
1. Provide an overall health score (Grade A+, A, B, C, D) and numerical score out of 100.
2. Highlight 2-3 key dietary achievements (e.g. consistent protein intake, active calorie burn).
3. Identify 2-3 areas for improvement (e.g. excessive sodium on weekends, high sugar snacks).
4. Correlate Google Fit physical activity (steps & burned calories) with food energy intake.
5. Provide 3 actionable, practical goals for next week.

OUTPUT FORMAT:
Return strictly valid JSON:
{
  "grade": "A",
  "score": 88,
  "executive_summary": "1-2 paragraph professional executive summary of the week's dietary journey",
  "strengths": [
    "Konsistensi pemenuhan target protein harian tercapai 6 dari 7 hari",
    "Aktivitas fisik aktif rata-rata di atas 8.000 langkah per hari"
  ],
  "areas_for_improvement": [
    "Asupan natrium meningkat di akhir pekan karena makanan kemasan",
    "Variasi serat sayur hijau perlu ditingkatkan saat makan malam"
  ],
  "energy_balance_analysis": "Analisis perbandingan antara kalori masuk dari makanan dan kalori terbakar dari Google Fit",
  "action_plan_next_week": [
    "Prioritaskan camilan buah segar dibanding makanan ringan olahan",
    "Pertahankan target 8.500 langkah setiap hari",
    "Minum air putih minimal 2.5 liter per hari"
  ]
}
`;

  const result = await model.generateContent(prompt);
  const responseText = result.response.text();

  try {
    return JSON.parse(responseText);
  } catch (err) {
    console.error('Failed to parse Gemini Weekly Insights JSON:', responseText);
    throw new Error('AI weekly insights produced invalid JSON response');
  }
};
