import { google } from 'googleapis';
import { env } from '../config/env.js';
import { supabaseAdmin } from '../config/supabase.js';

let _fitness = null;
const getFitness = () => {
  if (!_fitness) {
    _fitness = google.fitness('v1');
  }
  return _fitness;
};

/**
 * Creates a configured OAuth2 client for a given user's tokens
 */
export const createGoogleOAuth2Client = (tokens = {}) => {
  const oauth2Client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI
  );

  if (tokens.access_token) {
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date: tokens.expiry_date
    });
  }

  return oauth2Client;
};

/**
 * Retrieve Google OAuth tokens for a specific user from Supabase
 */
export const getUserGoogleTokens = async (userId) => {
  const { data, error } = await supabaseAdmin
    .from('user_google_tokens')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) {
    return null;
  }

  return data;
};

/**
 * Save or update Google OAuth tokens in Supabase
 */
export const saveUserGoogleTokens = async (userId, tokenData) => {
  const payload = {
    user_id: userId,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    token_type: tokenData.token_type || 'Bearer',
    expiry_date: tokenData.expiry_date || null,
    scope: tokenData.scope || null,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabaseAdmin
    .from('user_google_tokens')
    .upsert(payload, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) {
    console.error('Error saving Google tokens:', error);
    throw new Error('Failed to save Google OAuth tokens: ' + error.message);
  }

  return data;
};

/**
 * Get authenticated Google Fit client, automatically handling token refreshes
 */
const getAuthenticatedFitnessClient = async (userId) => {
  const tokens = await getUserGoogleTokens(userId);
  if (!tokens || !tokens.access_token) {
    return null;
  }

  const auth = createGoogleOAuth2Client(tokens);

  // Listen for refreshed tokens and save to Supabase
  auth.on('tokens', async (newTokens) => {
    try {
      await saveUserGoogleTokens(userId, {
        ...tokens,
        ...newTokens
      });
    } catch (err) {
      console.error('Failed to update refreshed Google tokens:', err);
    }
  });

  return auth;
};

/**
 * Feature 2: Fetch today's steps & active burned calories from Google Fit API
 * @param {string} userId - Supabase user ID
 * @param {Date} [date] - Target date (defaults to today)
 */
export const getDailyActivitySummary = async (userId, date = new Date()) => {
  const auth = await getAuthenticatedFitnessClient(userId);

  // If user has not connected Google Fit yet, return gracefully
  if (!auth) {
    return {
      connected: false,
      date: date.toISOString().split('T')[0],
      steps: 0,
      calories_burned: 0,
      distance_meters: 0,
      message: 'Google Fit is not connected. Connect Google Fit to sync live activity.'
    };
  }

  // Calculate start and end of day in milliseconds
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const startTimeMillis = startOfDay.getTime();

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  const endTimeMillis = endOfDay.getTime();

  try {
    const fitnessClient = getFitness();
    const res = await fitnessClient.users.dataset.aggregate({
      auth,
      userId: 'me',
      requestBody: {
        aggregateBy: [
          {
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
          },
          {
            dataTypeName: 'com.google.calories.expended',
            dataSourceId: 'derived:com.google.calories.expended:com.google.android.gms:merge_calories_expended'
          },
          {
            dataTypeName: 'com.google.distance.delta',
            dataSourceId: 'derived:com.google.distance.delta:com.google.android.gms:merge_distance_delta'
          }
        ],
        bucketByTime: { durationMillis: 86400000 }, // 1 day
        startTimeMillis,
        endTimeMillis
      }
    });

    let steps = 0;
    let caloriesBurned = 0;
    let distanceMeters = 0;

    const buckets = res.data.bucket || [];
    for (const bucket of buckets) {
      for (const dataset of bucket.dataset || []) {
        for (const point of dataset.point || []) {
          const type = point.dataTypeName;
          const val = point.value?.[0];

          if (type === 'com.google.step_count.delta' && val?.intVal) {
            steps += val.intVal;
          } else if (type === 'com.google.calories.expended' && val?.fpVal) {
            caloriesBurned += val.fpVal;
          } else if (type === 'com.google.distance.delta' && val?.fpVal) {
            distanceMeters += val.fpVal;
          }
        }
      }
    }

    const result = {
      connected: true,
      date: date.toISOString().split('T')[0],
      steps: Math.round(steps),
      calories_burned: Math.round(caloriesBurned),
      distance_meters: Math.round(distanceMeters)
    };

    // Cache to activity_logs in Supabase
    await supabaseAdmin
      .from('activity_logs')
      .upsert({
        user_id: userId,
        date: result.date,
        steps: result.steps,
        calories_burned: result.calories_burned,
        distance_meters: result.distance_meters,
        source: 'google_fit',
        synced_at: new Date().toISOString()
      }, { onConflict: 'user_id,date' })
      .catch(err => console.warn('Warning: Failed to cache activity log to db:', err.message));

    return result;
  } catch (err) {
    console.error('Google Fit API Aggregate Error:', err.message);
    return {
      connected: true,
      error: true,
      date: date.toISOString().split('T')[0],
      steps: 0,
      calories_burned: 0,
      distance_meters: 0,
      message: 'Failed to retrieve live data from Google Fit: ' + err.message
    };
  }
};

/**
 * Feature 2: Sync logged meal nutrition directly to user's Google Fit dataset
 * Writes to com.google.nutrition data stream
 */
export const syncMealToGoogleFit = async (userId, meal) => {
  const auth = await getAuthenticatedFitnessClient(userId);
  if (!auth) {
    return {
      success: false,
      synced: false,
      message: 'Google Fit account is not linked.'
    };
  }

  const mealTime = meal.logged_at ? new Date(meal.logged_at) : new Date();
  const startTimeNanos = BigInt(mealTime.getTime()) * BigInt(1000000);
  const endTimeNanos = startTimeNanos + BigInt(60000000000); // 1 minute window

  // Google Fit Nutrition format
  const nutrientsMap = [
    { key: 'calories', value: { fpVal: Number(meal.total_calories || 0) } },
    { key: 'protein', value: { fpVal: Number(meal.protein_g || 0) } },
    { key: 'carbs.total', value: { fpVal: Number(meal.carbs_g || 0) } },
    { key: 'fat.total', value: { fpVal: Number(meal.fat_g || 0) } },
    { key: 'dietary_fiber', value: { fpVal: Number(meal.fiber_g || 0) } },
    { key: 'sugar', value: { fpVal: Number(meal.sugar_g || 0) } },
    { key: 'sodium', value: { fpVal: Number(meal.sodium_mg ? meal.sodium_mg / 1000 : 0) } } // converted to grams
  ];

  // Map meal_type to Google Fit Meal Type (1: During meal, 2: Breakfast, 3: Lunch, 4: Dinner, 5: Snack)
  const mealTypeMap = {
    breakfast: 2,
    lunch: 3,
    dinner: 4,
    snack: 5
  };
  const mealTypeVal = mealTypeMap[meal.meal_type] || 1;

  const dataSourceId = 'raw:com.google.nutrition:calorieknows.app:nutrition_sync';

  try {
    const fitnessClient = getFitness();
    // 1. Ensure DataSource exists
    try {
      await fitnessClient.users.dataSources.create({
        auth,
        userId: 'me',
        requestBody: {
          dataStreamName: 'CalorieKnows Nutrition Log',
          type: 'raw',
          application: {
            name: 'CalorieKnows',
            version: '1.0'
          },
          dataType: {
            name: 'com.google.nutrition',
            field: [
              { name: 'nutrients', format: 'map' },
              { name: 'meal_type', format: 'integer' },
              { name: 'food_item', format: 'string' }
            ]
          }
        }
      });
    } catch (createErr) {
      // If data source already exists, continue
    }

    // 2. Insert Dataset Point
    const datasetId = `${startTimeNanos}-${endTimeNanos}`;
    await fitnessClient.users.dataSources.datasets.patch({
      auth,
      userId: 'me',
      dataSourceId,
      datasetId,
      requestBody: {
        dataSourceId,
        minStartTimeNs: startTimeNanos.toString(),
        maxEndTimeNs: endTimeNanos.toString(),
        point: [
          {
            dataTypeName: 'com.google.nutrition',
            startTimeNanos: startTimeNanos.toString(),
            endTimeNanos: endTimeNanos.toString(),
            value: [
              { mapVal: nutrientsMap },
              { intVal: mealTypeVal },
              { strVal: meal.food_name || 'Food Dish' }
            ]
          }
        ]
      }
    });

    // Update meal_logs table flag
    if (meal.id) {
      await supabaseAdmin
        .from('meal_logs')
        .update({ synced_to_google_fit: true })
        .eq('id', meal.id);
    }

    return {
      success: true,
      synced: true,
      message: 'Successfully recorded nutrition data to Google Fit'
    };
  } catch (err) {
    console.error('Google Fit Nutrition sync error:', err.message);
    return {
      success: false,
      synced: false,
      error: err.message
    };
  }
};
