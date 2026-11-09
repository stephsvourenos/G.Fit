"use client";

import { useEffect } from "react";
import { reportError } from "@/components/ErrorReporter";

/** Last-resort screen if the whole site crashes; the problem is reported to Admin → System health. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => reportError(`Page crashed: ${error.message}${error.digest ? ` (${error.digest})` : ""}`), [error]);
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#0E1116", color: "#F7F4EE", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ maxWidth: 420, padding: 24, textAlign: "center" }}>
          <h1 style={{ fontSize: 28 }}>Something went wrong</h1>
          <p style={{ opacity: 0.7 }}>We’ve been told about it. Please try again.</p>
          <button onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, fontWeight: 700 }}>Try again</button>
        </div>
      </body>
    </html>
  );
}
