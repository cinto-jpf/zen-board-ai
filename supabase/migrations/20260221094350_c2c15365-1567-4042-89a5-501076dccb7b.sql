
ALTER TABLE public.tasks
ADD COLUMN IF NOT EXISTS finalitzacio_tasca TIMESTAMP WITH TIME ZONE;

NOTIFY pgrst, 'reload schema';
