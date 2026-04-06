-- =============================================
-- MoneyMate - Full Supabase Schema
-- Safe to re-run (uses IF NOT EXISTS)
-- =============================================

-- Create expenses (one-time payments) table
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create incomes table
CREATE TABLE IF NOT EXISTS public.incomes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
    source TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create daily_spends table
CREATE TABLE IF NOT EXISTS public.daily_spends (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
    amount NUMERIC NOT NULL,
    note TEXT NOT NULL,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create savings_goals table (updated with DPS/recurring fields)
CREATE TABLE IF NOT EXISTS public.savings_goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
    name TEXT NOT NULL,
    current_amount NUMERIC DEFAULT 0 NOT NULL,
    target_amount NUMERIC NOT NULL,
    color TEXT,
    -- DPS / Recurring savings fields
    is_recurring BOOLEAN DEFAULT FALSE NOT NULL,
    frequency TEXT DEFAULT 'monthly',        -- 'monthly' or 'weekly'
    monthly_amount NUMERIC DEFAULT 0,        -- amount per installment (weekly or monthly)
    start_month TEXT,                        -- 'YYYY-MM' e.g. '2026-01'
    duration_months INTEGER,                 -- how many months the plan runs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- If the table already exists and is missing the new columns, add them:
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE NOT NULL;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS frequency TEXT DEFAULT 'monthly';
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS monthly_amount NUMERIC DEFAULT 0;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS start_month TEXT;
ALTER TABLE public.savings_goals ADD COLUMN IF NOT EXISTS duration_months INTEGER;

-- Create recurring_expenses (EMI) table
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    start_month TEXT,            -- Deprecated
    end_month TEXT,              -- Deprecated
    start_date DATE,             -- New
    end_date DATE,               -- New
    frequency TEXT DEFAULT 'monthly', -- 'monthly' or 'weekly'
    payment_day INTEGER DEFAULT 1,    -- 0-6 for weekly, 1-31 for monthly
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Migration for recurring_expenses columns
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recurring_expenses' AND column_name = 'start_month') THEN
        UPDATE public.recurring_expenses 
        SET start_date = (start_month || '-01')::DATE,
            end_date = (end_month || '-01')::DATE
        WHERE start_date IS NULL;
    END IF;
END $$;


-- Create loans table
CREATE TABLE IF NOT EXISTS public.loans (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid() NOT NULL,
    partner_name TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    remaining_amount NUMERIC NOT NULL,
    type TEXT NOT NULL, -- 'taken' (I borrowed) or 'given' (I lent)
    start_date DATE NOT NULL,
    due_date DATE,
    interest_rate NUMERIC DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- =============================================
-- Enable Row Level Security
-- =============================================
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_spends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- =============================================
-- Policies (drop first to avoid duplicates on re-run)
-- =============================================
DO $$ BEGIN
  -- expenses
  DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
  DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
  -- incomes
  DROP POLICY IF EXISTS "Users can view their own incomes" ON public.incomes;
  DROP POLICY IF EXISTS "Users can insert their own incomes" ON public.incomes;
  DROP POLICY IF EXISTS "Users can update their own incomes" ON public.incomes;
  DROP POLICY IF EXISTS "Users can delete their own incomes" ON public.incomes;
  -- daily_spends
  DROP POLICY IF EXISTS "Users can view their own daily_spends" ON public.daily_spends;
  DROP POLICY IF EXISTS "Users can insert their own daily_spends" ON public.daily_spends;
  DROP POLICY IF EXISTS "Users can update their own daily_spends" ON public.daily_spends;
  DROP POLICY IF EXISTS "Users can delete their own daily_spends" ON public.daily_spends;
  -- savings_goals
  DROP POLICY IF EXISTS "Users can view their own savings_goals" ON public.savings_goals;
  DROP POLICY IF EXISTS "Users can insert their own savings_goals" ON public.savings_goals;
  DROP POLICY IF EXISTS "Users can update their own savings_goals" ON public.savings_goals;
  DROP POLICY IF EXISTS "Users can delete their own savings_goals" ON public.savings_goals;
  -- recurring_expenses
  DROP POLICY IF EXISTS "Users can view their own recurring_expenses" ON public.recurring_expenses;
  DROP POLICY IF EXISTS "Users can insert their own recurring_expenses" ON public.recurring_expenses;
  DROP POLICY IF EXISTS "Users can update their own recurring_expenses" ON public.recurring_expenses;
  DROP POLICY IF EXISTS "Users can delete their own recurring_expenses" ON public.recurring_expenses;
  -- loans
  DROP POLICY IF EXISTS "Users can view their own loans" ON public.loans;
  DROP POLICY IF EXISTS "Users can insert their own loans" ON public.loans;
  DROP POLICY IF EXISTS "Users can update their own loans" ON public.loans;
  DROP POLICY IF EXISTS "Users can delete their own loans" ON public.loans;
END $$;

CREATE POLICY "Users can view their own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own incomes" ON public.incomes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own incomes" ON public.incomes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own incomes" ON public.incomes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own incomes" ON public.incomes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own daily_spends" ON public.daily_spends FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own daily_spends" ON public.daily_spends FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own daily_spends" ON public.daily_spends FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own daily_spends" ON public.daily_spends FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own savings_goals" ON public.savings_goals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own savings_goals" ON public.savings_goals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own savings_goals" ON public.savings_goals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own savings_goals" ON public.savings_goals FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own recurring_expenses" ON public.recurring_expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own recurring_expenses" ON public.recurring_expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own recurring_expenses" ON public.recurring_expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own recurring_expenses" ON public.recurring_expenses FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own loans" ON public.loans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own loans" ON public.loans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own loans" ON public.loans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own loans" ON public.loans FOR DELETE USING (auth.uid() = user_id);

-- Table for tracking monthly EMI/Recurring payments
CREATE TABLE IF NOT EXISTS public.recurring_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recurring_expense_id UUID REFERENCES public.recurring_expenses(id) ON DELETE CASCADE,
  payment_month TEXT NOT NULL, -- Format: "YYYY-MM"
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(recurring_expense_id, payment_month)
);

ALTER TABLE public.recurring_payments ENABLE ROW LEVEL SECURITY;

-- Polices: Users can manage their own payments

