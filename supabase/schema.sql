-- CalorieKnows Supabase Database Schema
-- Run this script in the Supabase SQL Editor to set up all tables, RLS policies, and triggers.

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles Table (Synced automatically with Supabase Auth users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    gender TEXT CHECK (gender IN ('male', 'female', 'other')),
    age INTEGER,
    height_cm NUMERIC(5, 2),
    weight_kg NUMERIC(5, 2),
    activity_level TEXT CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active')) DEFAULT 'moderately_active',
    daily_calorie_target INTEGER DEFAULT 2000,
    target_protein_g NUMERIC(5, 1) DEFAULT 150.0,
    target_carbs_g NUMERIC(5, 1) DEFAULT 200.0,
    target_fat_g NUMERIC(5, 1) DEFAULT 65.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Google OAuth Tokens for Google Fit API connectivity
CREATE TABLE IF NOT EXISTS public.user_google_tokens (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    token_type TEXT DEFAULT 'Bearer',
    expiry_date BIGINT,
    scope TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Meal Logs (Snap & Log, Label Scanner, Manual Logs)
CREATE TABLE IF NOT EXISTS public.meal_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')) DEFAULT 'lunch',
    food_name TEXT NOT NULL,
    image_url TEXT,
    context_hint TEXT,
    total_calories NUMERIC(7, 2) NOT NULL DEFAULT 0,
    protein_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
    carbs_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
    fat_g NUMERIC(6, 2) NOT NULL DEFAULT 0,
    fiber_g NUMERIC(6, 2) DEFAULT 0,
    sugar_g NUMERIC(6, 2) DEFAULT 0,
    sodium_mg NUMERIC(7, 2) DEFAULT 0,
    raw_analysis JSONB,
    synced_to_google_fit BOOLEAN DEFAULT false,
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Meal Items (Granular ingredients/components breakdown)
CREATE TABLE IF NOT EXISTS public.meal_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    meal_log_id UUID NOT NULL REFERENCES public.meal_logs(id) ON DELETE CASCADE,
    item_name TEXT NOT NULL,
    portion_estimate_grams NUMERIC(6, 2),
    calories NUMERIC(6, 2) NOT NULL DEFAULT 0,
    protein_g NUMERIC(6, 2) DEFAULT 0,
    carbs_g NUMERIC(6, 2) DEFAULT 0,
    fat_g NUMERIC(6, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Activity Logs (Synced from Google Fit: steps, burned calories)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    steps INTEGER DEFAULT 0,
    calories_burned NUMERIC(7, 2) DEFAULT 0,
    distance_meters NUMERIC(8, 2) DEFAULT 0,
    source TEXT DEFAULT 'google_fit',
    synced_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_user_date UNIQUE (user_id, date)
);

-- 6. Weekly Reports (Aggregated trends & Gemini AI health evaluations)
CREATE TABLE IF NOT EXISTS public.weekly_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    summary_data JSONB NOT NULL,
    ai_insights JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for optimal query performance
CREATE INDEX IF NOT EXISTS idx_meal_logs_user_date ON public.meal_logs(user_id, logged_at DESC);
CREATE INDEX IF NOT EXISTS idx_meal_items_meal_id ON public.meal_items(meal_log_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_date ON public.activity_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user_date ON public.weekly_reports(user_id, start_date DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_google_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

-- Profiles RLS Policies
CREATE POLICY "Users can view own profile" 
ON public.profiles FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Google Tokens RLS Policies (Strict user access)
CREATE POLICY "Users can manage own google tokens" 
ON public.user_google_tokens FOR ALL USING (auth.uid() = user_id);

-- Meal Logs RLS Policies
CREATE POLICY "Users can view own meal logs" 
ON public.meal_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meal logs" 
ON public.meal_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meal logs" 
ON public.meal_logs FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meal logs" 
ON public.meal_logs FOR DELETE USING (auth.uid() = user_id);

-- Meal Items RLS Policies (Access based on parent meal_logs)
CREATE POLICY "Users can view own meal items" 
ON public.meal_items FOR SELECT 
USING (EXISTS (SELECT 1 FROM public.meal_logs WHERE meal_logs.id = meal_items.meal_log_id AND meal_logs.user_id = auth.uid()));

CREATE POLICY "Users can insert own meal items" 
ON public.meal_items FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM public.meal_logs WHERE meal_logs.id = meal_items.meal_log_id AND meal_logs.user_id = auth.uid()));

CREATE POLICY "Users can update own meal items" 
ON public.meal_items FOR UPDATE 
USING (EXISTS (SELECT 1 FROM public.meal_logs WHERE meal_logs.id = meal_items.meal_log_id AND meal_logs.user_id = auth.uid()));

CREATE POLICY "Users can delete own meal items" 
ON public.meal_items FOR DELETE 
USING (EXISTS (SELECT 1 FROM public.meal_logs WHERE meal_logs.id = meal_items.meal_log_id AND meal_logs.user_id = auth.uid()));

-- Activity Logs RLS Policies
CREATE POLICY "Users can view own activity logs" 
ON public.activity_logs FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own activity logs" 
ON public.activity_logs FOR ALL USING (auth.uid() = user_id);

-- Weekly Reports RLS Policies
CREATE POLICY "Users can view own weekly reports" 
ON public.weekly_reports FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly reports" 
ON public.weekly_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Automatic Profile Creation on Google OAuth Sign Up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'CalorieKnows User'),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to execute on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
