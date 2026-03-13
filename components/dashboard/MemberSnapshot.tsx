"use client";

import { useMemo, useState } from "react";

type SnapshotMember = {
  guild_id?: string | null;
  user_id?: string | null;
  id?: string | null;
  username?: string | null;
  display_name?: string | null;
  nickname?: string | null;
  avatar_url?: string | null;
  has_verified_role?: boolean | null;
  has_unverified?: boolean | null;
  has_staff_role?: boolean | null;
  in_guild?: boolean | null;
  role_state?: string | null;
  role_names?: string[] | null;
  joined_at?: string | null;
  updated_at?: string | null;
  last_seen_at?: string | null;
};

type MemberSnapshotProps = {
  members: SnapshotMember[];
  className?: string;
  title?: string;
};

type BucketKey = "verified" | "unverified" | "staff";

function normalizeBool(value: unknown): boolean {
  return value === true;
}

function getMemberId(member: SnapshotMember): string {
  return String(member.user_id || member.id || "").trim();
}

function getDisplayName(member: SnapshotMember): string {
  return (
    String(member.display_name || "").trim() ||
    String(member.nickname || "").trim() ||
    String(member.username || "").trim() ||
    "Unknown Member"
  );
}

function getSubtitle(member: SnapshotMember): string {
  const username = String(member.username || "").trim();
  const id = getMemberId(member);
  if (username && id) return `${username} • ${id}`;
  if (username) return username;
  if (id) return id;
  return "Unknown";
}

function formatDate(value?: string | null): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return date.toLocaleString();
}

function bucketClass(kind: BucketKey) {
  if (kind === "verified") {
    return "border-emerald-800 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-900/30";
  }
  if (kind === "unverified") {
    return "border-amber-800 bg-amber-950/30 text-amber-300 hover:bg-amber-900/30";
  }
  return "border-blue-800 bg-blue-950/30 text-blue-300 hover:bg-blue-900/30";
}

function panelClass() {
  return "rounded-2xl border border-zinc-800 bg-zinc-950/80 p-4";
}

function inputClass() {
  return "w-full rounded-2xl border border-zinc-700 bg-zinc-900 px-3 py-2.5 text-sm text-white outline-none focus:border-zinc-500";
}

export default function MemberSnapshot({
  members,
  class
