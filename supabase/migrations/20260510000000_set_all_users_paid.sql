-- Migration: set all users to paid plan for testing
-- All plan restrictions are lifted until paid features are formally defined.
-- The plan-protection trigger must be disabled to allow this bulk update.

ALTER TABLE public.profiles DISABLE TRIGGER profiles_protect_plan;

UPDATE public.profiles
  SET plan = 'paid', subscription_status = 'active';

ALTER TABLE public.profiles
  ALTER COLUMN plan SET DEFAULT 'paid';

ALTER TABLE public.profiles ENABLE TRIGGER profiles_protect_plan;
