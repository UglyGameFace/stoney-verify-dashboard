CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS form_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS form_questions jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS form_config jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS form_updated_at timestamp with time zone;
ALTER TABLE public.ticket_categories ADD COLUMN IF NOT EXISTS form_updated_by text;

CREATE TABLE IF NOT EXISTS public.ticket_form_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  ticket_id uuid,
  guild_id text NOT NULL,
  channel_id text,
  user_id text NOT NULL,
  category_slug text NOT NULL,
  question_index integer NOT NULL DEFAULT 0,
  question_label text NOT NULL,
  question_key text,
  answer text NOT NULL DEFAULT '',
  required boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT ticket_form_responses_pkey PRIMARY KEY (id),
  CONSTRAINT ticket_form_responses_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ticket_categories_form_enabled ON public.ticket_categories(guild_id, form_enabled);
CREATE INDEX IF NOT EXISTS idx_ticket_form_responses_ticket_id ON public.ticket_form_responses(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_form_responses_guild_channel ON public.ticket_form_responses(guild_id, channel_id);
CREATE INDEX IF NOT EXISTS idx_ticket_form_responses_user ON public.ticket_form_responses(guild_id, user_id, created_at DESC);
