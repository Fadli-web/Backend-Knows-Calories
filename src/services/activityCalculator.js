/**
 * Feature 7: Burn It Off Converter
 * Translates meal calories into real physical activity targets based on scientific MET values.
 */

// Compendium of Physical Activities MET standards
const ACTIVITY_METS = {
  walking_casual: {
    name: 'Jalan Santai (4 km/jam)',
    icon: 'walk',
    met: 3.0,
    intensity: 'Rendah'
  },
  walking_brisk: {
    name: 'Jalan Cepat (5.5 km/jam)',
    icon: 'fast-walk',
    met: 4.3,
    intensity: 'Sedang'
  },
  jogging: {
    name: 'Jogging (8 km/jam)',
    icon: 'jog',
    met: 7.0,
    intensity: 'Tinggi'
  },
  running: {
    name: 'Lari Cepat (10 km/jam)',
    icon: 'run',
    met: 9.8,
    intensity: 'Sangat Tinggi'
  },
  cycling: {
    name: 'Bersepeda Santai (16-19 km/jam)',
    icon: 'bike',
    met: 6.8,
    intensity: 'Sedang'
  },
  jump_rope: {
    name: 'Lompat Tali (Skipping)',
    icon: 'jump-rope',
    met: 10.0,
    intensity: 'Sangat Tinggi'
  },
  swimming: {
    name: 'Berenang Bebas (Santai)',
    icon: 'swim',
    met: 7.0,
    intensity: 'Tinggi'
  }
};

/**
 * Calculates physical activity durations needed to burn a given amount of calories
 * @param {number} calories - Food calories to burn
 * @param {number} [userWeightKg=65] - User body weight in kilograms (default 65kg)
 * @param {object} [currentFitActivity] - Today's Google Fit data (calories_burned, steps)
 */
export const calculateBurnItOff = ({
  calories,
  userWeightKg = 65,
  currentFitActivity = { calories_burned: 0, steps: 0 }
}) => {
  const weight = Number(userWeightKg) || 65;
  const targetCalories = Number(calories) || 0;

  const activities = Object.entries(ACTIVITY_METS).map(([key, item]) => {
    // Cal/min = (MET * 3.5 * weightKg) / 200
    const calPerMin = (item.met * 3.5 * weight) / 200;
    const durationMinutes = calPerMin > 0 ? Math.ceil(targetCalories / calPerMin) : 0;

    return {
      key,
      name: item.name,
      intensity: item.intensity,
      calories_burned_per_minute: Math.round(calPerMin * 10) / 10,
      duration_minutes: durationMinutes,
      formatted_duration: durationMinutes >= 60 
        ? `${Math.floor(durationMinutes / 60)} jam ${durationMinutes % 60} menit`
        : `${durationMinutes} menit`
    };
  });

  // Steps equivalent: average ~0.045 kcal burned per step for standard 65kg person
  const calPerStep = 0.045 * (weight / 65);
  const stepsRequired = calPerStep > 0 ? Math.ceil(targetCalories / calPerStep) : 0;

  // Comparison with today's Google Fit data
  const fitBurned = Number(currentFitActivity.calories_burned) || 0;
  const fitSteps = Number(currentFitActivity.steps) || 0;

  const percentageBurned = targetCalories > 0 
    ? Math.min(100, Math.round((fitBurned / targetCalories) * 100))
    : 100;

  const remainingToBurn = Math.max(0, targetCalories - fitBurned);

  return {
    target_meal_calories: targetCalories,
    user_weight_kg: weight,
    steps_equivalent: stepsRequired,
    activities,
    google_fit_tracking: {
      today_burned_calories: fitBurned,
      today_steps: fitSteps,
      percentage_cleared: percentageBurned,
      remaining_calories_to_burn: remainingToBurn,
      status: percentageBurned >= 100 ? 'Burned Off Completely!' : 'In Progress'
    }
  };
};
