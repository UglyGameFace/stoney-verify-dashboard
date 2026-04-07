"use client";

import { useEffect, useMemo, useState } from "react";

type TicketCategory = {
  id?: string | null;
  guild_id?: string | null;
  name?: string | null;
  slug?: string | null;
  color?: string | null;
  description?: string | null;
  intake_type?: string | null;
  match_keywords?: string[] | null;
  button_label?: string | null;
  sort_order?: number | null;
  is_default?: boolean | null;
  created_at?: string | null;
  keyword_count?: number | null;
  usage?: {
    total?: number;
    open?: number;
    claimed?: number;
    closed?: number;
    deleted?: number;
    manualOverrideCount?: number;
    latestTicketAt?: string | null;
  } | null;
};

type CategoriesResponse = {
  categories?: TicketCategory[];
  defaultCategoryId?: string | null;
  presets?: Record<string, string[]>;
  codServiceKeywords?: string[];
  error?: string;
};

type MutationResponse = {
  ok?: boolean;
  error?: string;
  category?: TicketCategory | null;
  deletedId?: string | null;
  linkedTickets?: Array<{
    id?: string | null;
    title?: string | null;
    status?: string | null;
  }>;
};

type FormState = {
  id: string;
  name: string;
  slug: string;
  color: string;
  description: string;
  intake_type: string;
  match_keywords: string;
  button_label: string;
  sort_order: string;
  is_default: boolean;
};

const DEFAULT_FORM: FormState = {
  id: "",
  name: "",
  slug: "",
  color: "#45d483",
  description: "",
  intake_type: "general",
  match_keywords: "",
  button_label: "",
  sort_order: "",
  is_default: false,
};

const INTAKE_TYPES = [
  "general",
  "verification",
  "appeal",
  "report",
  "partnership",
  "question",
  "custom",
];

function normalizeString(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeString(value).toLowerCase();
}

function slugify(value: unknown): string {
  return normalizeString(value)
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g
