"use client";

import { useEffect, useState } from "react";
import { coachPortraitUrl, type CoachPicture } from "@app/domain";
import { supabase, supabaseConfigured } from "./supabase";

/** Coaches who have given written consent for their portrait to be used as a profile picture. */
export function useCoachPictures(): CoachPicture[] {
  const [list, setList] = useState<CoachPicture[]>([]);
  useEffect(() => {
    if (!supabaseConfigured) return;
    let alive = true;
    supabase()
      .from("coach_pictures")
      .select("id, display_name, portrait_path")
      .order("display_name")
      .then(({ data }) => {
        if (!alive || !data) return;
        setList(data.map((c) => ({ id: c.id as string, name: c.display_name as string, imageUrl: coachPortraitUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "", c.portrait_path as string) })));
      });
    return () => { alive = false; };
  }, []);
  return list;
}
