"use client";

import { useEffect } from "react";
import { captureReferralFromUrl } from "@/lib/billing";

/** Notes a creator's ?ref= code on arrival, so it can be credited if the family joins. */
export function ReferralCapture() {
  useEffect(() => captureReferralFromUrl(), []);
  return null;
}
