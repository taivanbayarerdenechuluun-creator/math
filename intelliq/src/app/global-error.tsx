"use client";

// Last-resort boundary: replaces the root layout, so it cannot rely on app providers or theme CSS.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#080B16", color: "#F8FAFC", fontFamily: "system-ui, sans-serif", textAlign: "center", padding: 24 }}>
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>Something went wrong · Алдаа гарлаа</h1>
          <p style={{ color: "#94A3B8", marginTop: 12 }}>INTELLIQ hit an unexpected error. Please try again.</p>
          <p style={{ color: "#94A3B8", marginTop: 4 }}>INTELLIQ-д санаанд оромгүй алдаа гарлаа. Дахин оролдоно уу.</p>
          <button onClick={reset} style={{ marginTop: 20, padding: "12px 20px", borderRadius: 12, border: 0, background: "#8B5CF6", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Try again · Дахин оролдох</button>
        </div>
      </body>
    </html>
  );
}
