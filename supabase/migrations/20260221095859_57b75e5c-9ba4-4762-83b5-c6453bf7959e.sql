ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS duracio_estimada INTEGER NOT NULL DEFAULT 30;

NOTIFY pgrst, 'reload schema';