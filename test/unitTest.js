import { calculateBurnItOff } from '../src/services/activityCalculator.js';
import { generateWeeklyReportPDF } from '../src/services/pdfService.js';

async function runTests() {
  console.log('🧪 Starting CalorieKnows Backend Verification Tests...');

  // 1. Test Burn It Off Converter
  console.log('\n--- Test 1: Burn It Off Activity Calculator ---');
  const burnResult = calculateBurnItOff({
    calories: 550,
    userWeightKg: 70,
    currentFitActivity: {
      calories_burned: 220,
      steps: 4500
    }
  });

  console.log('Target Meal Calories:', burnResult.target_meal_calories);
  console.log('Steps Equivalent:', burnResult.steps_equivalent);
  console.log('Activities calculated:', burnResult.activities.length);
  console.log('Google Fit Tracking Status:', burnResult.google_fit_tracking.status);
  console.log('Percentage Cleared:', burnResult.google_fit_tracking.percentage_cleared + '%');

  if (burnResult.activities.length >= 6 && burnResult.steps_equivalent > 0) {
    console.log('✅ Burn It Off calculation passed!');
  } else {
    throw new Error('Burn It Off calculation failed');
  }

  // 2. Test PDFKit Generation
  console.log('\n--- Test 2: Weekly Report PDF Generation ---');
  const pdfBuffer = await generateWeeklyReportPDF({
    userProfile: {
      name: 'Budi Santoso',
      daily_calorie_target: 2100,
      height_cm: 175,
      weight_kg: 70,
      activity_level: 'moderately_active'
    },
    startDate: '2026-09-01',
    endDate: '2026-09-07',
    dailyBreakdown: [
      { date: '2026-09-01', calories: 1950, calories_burned: 450, steps: 8200, protein_g: 135, carbs_g: 210, fat_g: 58 },
      { date: '2026-09-02', calories: 2050, calories_burned: 520, steps: 9100, protein_g: 140, carbs_g: 220, fat_g: 62 },
      { date: '2026-09-03', calories: 1880, calories_burned: 400, steps: 7800, protein_g: 130, carbs_g: 200, fat_g: 55 },
      { date: '2026-09-04', calories: 2150, calories_burned: 600, steps: 10500, protein_g: 155, carbs_g: 230, fat_g: 65 },
      { date: '2026-09-05', calories: 2200, calories_burned: 480, steps: 8500, protein_g: 142, carbs_g: 240, fat_g: 68 },
      { date: '2026-09-06', calories: 1920, calories_burned: 390, steps: 6900, protein_g: 128, carbs_g: 210, fat_g: 59 },
      { date: '2026-09-07', calories: 2010, calories_burned: 510, steps: 9400, protein_g: 145, carbs_g: 215, fat_g: 60 }
    ],
    totals: {
      total_calories: 14160,
      total_burned: 3350,
      total_steps: 60400,
      avg_daily_calories: 2023,
      avg_daily_burned: 479,
      avg_daily_steps: 8629,
      avg_daily_protein_g: 139.3,
      avg_daily_carbs_g: 217.9,
      avg_daily_fat_g: 61.0
    },
    aiInsights: {
      grade: 'A',
      score: 90,
      executive_summary: 'Keseimbangan nutrisi dan aktivitas fisik sangat baik selama 7 hari terakhir.',
      strengths: ['Konsistensi pemenuhan target protein', 'Aktivitas langkah harian melampaui 8.500 langkah'],
      areas_for_improvement: ['Asupan lemak saat akhir pekan sedikit meningkat'],
      action_plan_next_week: ['Pertahankan ritme jalan 9.000 langkah', 'Tingkatkan konsumsi air putih']
    }
  });

  console.log('PDF Generated successfully! Size:', pdfBuffer.length, 'bytes');
  const isPdf = pdfBuffer.toString('ascii', 0, 5) === '%PDF-';
  if (pdfBuffer.length > 1000 && isPdf) {
    console.log('✅ PDF Generation passed with valid %PDF- header!');
  } else {
    throw new Error('PDF output buffer invalid or too small');
  }

  console.log('\n🎉 ALL LOCAL ENGINE TESTS PASSED!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
