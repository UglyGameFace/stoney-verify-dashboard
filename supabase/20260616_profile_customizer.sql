-- =========================================================
-- Profile Customizer
-- Optional post-verification profile/self-role panels.
-- This intentionally defaults to optional, not a verification gate.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.profile_customizer_settings (
  guild_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  channel_id text,
  panel_message_id text,
  show_after_verification boolean NOT NULL DEFAULT true,
  require_before_access boolean NOT NULL DEFAULT false,
  allow_user_reset boolean NOT NULL DEFAULT true,
  audit_changes boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_customizer_settings_pkey PRIMARY KEY (guild_id)
);

CREATE TABLE IF NOT EXISTS public.profile_role_panels (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  panel_key text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  channel_id text,
  message_id text,
  enabled boolean NOT NULL DEFAULT true,
  optional boolean NOT NULL DEFAULT true,
  allow_multiple boolean NOT NULL DEFAULT true,
  max_choices integer NOT NULL DEFAULT 1 CHECK (max_choices > 0 AND max_choices <= 25),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_role_panels_pkey PRIMARY KEY (id),
  CONSTRAINT profile_role_panels_panel_key_check CHECK (
    panel_key = ANY (
      ARRAY[
        'pronouns'::text,
        'interests'::text,
        'pings'::text,
        'gaming'::text,
        'vibes'::text,
        'privacy'::text
      ]
    )
  ),
  CONSTRAINT profile_role_panels_guild_panel_key_key UNIQUE (guild_id, panel_key)
);

CREATE TABLE IF NOT EXISTS public.profile_role_options (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  panel_id uuid NOT NULL,
  option_key text NOT NULL,
  label text NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  emoji text,
  role_id text,
  role_name text,
  privacy_kind text NOT NULL DEFAULT 'public_role'::text,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT profile_role_options_pkey PRIMARY KEY (id),
  CONSTRAINT profile_role_options_panel_id_fkey
    FOREIGN KEY (panel_id) REFERENCES public.profile_role_panels(id) ON DELETE CASCADE,
  CONSTRAINT profile_role_options_privacy_kind_check CHECK (
    privacy_kind = ANY (
      ARRAY[
        'public_role'::text,
        'private_choice'::text,
        'reset'::text
      ]
    )
  ),
  CONSTRAINT profile_role_options_panel_option_key_key UNIQUE (panel_id, option_key)
);

CREATE TABLE IF NOT EXISTS public.member_profile_role_choices (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  user_id text NOT NULL,
  panel_key text NOT NULL,
  option_key text NOT NULL,
  role_id text,
  role_name text,
  source text NOT NULL DEFAULT 'discord_panel'::text,
  actor_id text,
  actor_name text,
  removed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT member_profile_role_choices_pkey PRIMARY KEY (id),
  CONSTRAINT member_profile_role_choices_panel_key_check CHECK (
    panel_key = ANY (
      ARRAY[
        'pronouns'::text,
        'interests'::text,
        'pings'::text,
        'gaming'::text,
        'vibes'::text,
        'privacy'::text
      ]
    )
  ),
  CONSTRAINT member_profile_role_choices_source_check CHECK (
    source = ANY (
      ARRAY[
        'discord_panel'::text,
        'dashboard'::text,
        'bot_sync'::text,
        'staff_reset'::text
      ]
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_profile_customizer_settings_enabled
  ON public.profile_customizer_settings(guild_id, enabled);

CREATE INDEX IF NOT EXISTS idx_profile_role_panels_guild
  ON public.profile_role_panels(guild_id, enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_profile_role_options_panel
  ON public.profile_role_options(panel_id, enabled, sort_order);

CREATE INDEX IF NOT EXISTS idx_profile_role_options_guild_role
  ON public.profile_role_options(guild_id, role_id);

CREATE INDEX IF NOT EXISTS idx_member_profile_role_choices_member
  ON public.member_profile_role_choices(guild_id, user_id, removed_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_member_profile_role_choices_active_unique
  ON public.member_profile_role_choices(guild_id, user_id, panel_key, option_key)
  WHERE removed_at IS NULL;
