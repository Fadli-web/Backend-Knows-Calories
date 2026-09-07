import { getUserGoogleTokens, saveUserGoogleTokens } from '../services/googleFitService.js';

/**
 * Get authenticated user profile
 */
export const getProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;

    let { data: profile, error } = await req.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile does not exist yet; auto-create from Supabase auth user metadata
      const userMeta = req.user.user_metadata || {};
      const newProfile = {
        id: userId,
        name: userMeta.full_name || userMeta.name || req.user.email?.split('@')[0] || 'CalorieKnows User',
        email: req.user.email,
        avatar_url: userMeta.avatar_url || null,
        daily_calorie_target: 2000,
        target_protein_g: 150.0,
        target_carbs_g: 200.0,
        target_fat_g: 65.0
      };

      const { data: created, error: createError } = await req.supabase
        .from('profiles')
        .insert(newProfile)
        .select()
        .single();

      if (createError) throw createError;
      profile = created;
    } else if (error) {
      throw error;
    }

    // Check Google Fit status
    const googleTokens = await getUserGoogleTokens(userId);

    res.json({
      success: true,
      data: {
        ...profile,
        google_fit_connected: !!googleTokens?.access_token
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Update authenticated user profile and nutritional targets
 */
export const updateProfile = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const {
      name,
      avatar_url,
      gender,
      age,
      height_cm,
      weight_kg,
      activity_level,
      daily_calorie_target,
      target_protein_g,
      target_carbs_g,
      target_fat_g
    } = req.body;

    const updates = {
      ...(name !== undefined && { name }),
      ...(avatar_url !== undefined && { avatar_url }),
      ...(gender !== undefined && { gender }),
      ...(age !== undefined && { age: Number(age) }),
      ...(height_cm !== undefined && { height_cm: Number(height_cm) }),
      ...(weight_kg !== undefined && { weight_kg: Number(weight_kg) }),
      ...(activity_level !== undefined && { activity_level }),
      ...(daily_calorie_target !== undefined && { daily_calorie_target: Number(daily_calorie_target) }),
      ...(target_protein_g !== undefined && { target_protein_g: Number(target_protein_g) }),
      ...(target_carbs_g !== undefined && { target_carbs_g: Number(target_carbs_g) }),
      ...(target_fat_g !== undefined && { target_fat_g: Number(target_fat_g) }),
      updated_at: new Date().toISOString()
    };

    const { data: updatedProfile, error } = await req.supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Save Google OAuth tokens from Client (e.g. Supabase OAuth provider_token)
 */
export const saveGoogleToken = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { access_token, refresh_token, expiry_date, scope } = req.body;

    if (!access_token) {
      return res.status(400).json({
        success: false,
        message: 'access_token is required'
      });
    }

    const saved = await saveUserGoogleTokens(userId, {
      access_token,
      refresh_token,
      expiry_date,
      scope
    });

    res.json({
      success: true,
      message: 'Google Fit integration linked successfully',
      data: {
        user_id: saved.user_id,
        scope: saved.scope,
        connected: true
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Check Google Fit connectivity status
 */
export const getGoogleFitStatus = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const tokens = await getUserGoogleTokens(userId);

    res.json({
      success: true,
      data: {
        connected: !!tokens?.access_token,
        has_refresh_token: !!tokens?.refresh_token,
        scope: tokens?.scope || null
      }
    });
  } catch (err) {
    next(err);
  }
};
