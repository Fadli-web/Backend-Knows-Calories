import { analyzeFoodImage, analyzeNutritionLabel } from '../services/geminiService.js';
import { syncMealToGoogleFit } from '../services/googleFitService.js';

/**
 * Helper to extract image buffer and mimeType from either multer file or JSON base64
 */
const extractImagePayload = (req) => {
  if (req.file) {
    return {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype
    };
  }

  if (req.body.image_base64) {
    const raw = req.body.image_base64;
    let mimeType = req.body.mime_type || 'image/jpeg';
    let base64Data = raw;

    // Support data URI (e.g. data:image/png;base64,xxxx)
    if (raw.startsWith('data:')) {
      const parts = raw.split(',');
      const match = parts[0].match(/:(.*?);/);
      if (match) mimeType = match[1];
      base64Data = parts[1];
    }

    return {
      buffer: Buffer.from(base64Data, 'base64'),
      mimeType
    };
  }

  return null;
};

/**
 * Feature 3 & 4: Snap & Log Food Photo Scanner
 */
export const scanFood = async (req, res, next) => {
  try {
    const image = extractImagePayload(req);
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image provided. Upload a file via multipart form-data (field: "image") or provide "image_base64".'
      });
    }

    const contextHint = req.body.context_hint || '';

    const analysis = await analyzeFoodImage({
      imageBuffer: image.buffer,
      mimeType: image.mimeType,
      contextHint
    });

    res.json({
      success: true,
      message: 'Food scanned and analyzed successfully',
      data: {
        ...analysis,
        context_hint_applied: !!contextHint
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Feature 5: Nutrition Facts Label Scanner
 */
export const scanNutritionLabel = async (req, res, next) => {
  try {
    const image = extractImagePayload(req);
    if (!image) {
      return res.status(400).json({
        success: false,
        message: 'No image provided. Upload a file via multipart form-data (field: "image") or provide "image_base64".'
      });
    }

    const contextHint = req.body.context_hint || '';

    const labelData = await analyzeNutritionLabel({
      imageBuffer: image.buffer,
      mimeType: image.mimeType,
      contextHint
    });

    res.json({
      success: true,
      message: 'Nutrition label scanned successfully',
      data: labelData
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Save Meal Log to Database and optionally sync to Google Fit
 */
export const logMeal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      meal_type = 'lunch',
      food_name,
      image_url,
      context_hint,
      total_calories,
      protein_g,
      carbs_g,
      fat_g,
      fiber_g = 0,
      sugar_g = 0,
      sodium_mg = 0,
      items = [],
      raw_analysis,
      sync_google_fit = true
    } = req.body;

    if (!food_name || total_calories === undefined) {
      return res.status(400).json({
        success: false,
        message: 'food_name and total_calories are required'
      });
    }

    // 1. Insert meal_logs record
    const { data: meal, error: mealError } = await req.supabase
      .from('meal_logs')
      .insert({
        user_id: userId,
        meal_type,
        food_name,
        image_url,
        context_hint,
        total_calories: Number(total_calories),
        protein_g: Number(protein_g || 0),
        carbs_g: Number(carbs_g || 0),
        fat_g: Number(fat_g || 0),
        fiber_g: Number(fiber_g || 0),
        sugar_g: Number(sugar_g || 0),
        sodium_mg: Number(sodium_mg || 0),
        raw_analysis,
        logged_at: new Date().toISOString()
      })
      .select()
      .single();

    if (mealError) throw mealError;

    // 2. Insert items if provided
    let insertedItems = [];
    if (items && Array.isArray(items) && items.length > 0) {
      const itemsPayload = items.map(item => ({
        meal_log_id: meal.id,
        item_name: item.item_name || 'Item',
        portion_estimate_grams: item.portion_estimate_grams ? Number(item.portion_estimate_grams) : null,
        calories: Number(item.calories || 0),
        protein_g: Number(item.protein_g || 0),
        carbs_g: Number(item.carbs_g || 0),
        fat_g: Number(item.fat_g || 0),
        notes: item.notes || null
      }));

      const { data: itemData, error: itemError } = await req.supabase
        .from('meal_items')
        .insert(itemsPayload)
        .select();

      if (!itemError) {
        insertedItems = itemData;
      }
    }

    // 3. Sync to Google Fit if requested
    let googleFitSyncResult = null;
    if (sync_google_fit) {
      googleFitSyncResult = await syncMealToGoogleFit(userId, meal);
    }

    res.status(201).json({
      success: true,
      message: 'Meal logged successfully',
      data: {
        ...meal,
        items: insertedItems,
        google_fit_sync: googleFitSyncResult
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Get logged meals with optional date filtering (?date=YYYY-MM-DD)
 */
export const getMeals = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { date, limit = 50 } = req.query;

    let query = req.supabase
      .from('meal_logs')
      .select(`
        *,
        meal_items (*)
      `)
      .eq('user_id', userId)
      .order('logged_at', { ascending: false })
      .limit(Number(limit));

    if (date) {
      // Filter for exact date UTC
      const start = `${date}T00:00:00.000Z`;
      const end = `${date}T23:59:59.999Z`;
      query = query.gte('logged_at', start).lte('logged_at', end);
    }

    const { data: meals, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      count: meals.length,
      data: meals
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Delete a meal log
 */
export const deleteMeal = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const { error } = await req.supabase
      .from('meal_logs')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Meal log deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};
