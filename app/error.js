"use client"

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body style={{ background: "#08111f", color: "#e1ebf8", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ border: "1px solid rgba(255,98,98,.35)", background: "rgba(255,98,98,.12)", padding: 18, borderRadius: 16 }}>
            <h1 style={{ marginTop: 0 }}>Something went wrong</h1>
            <p>{error?.message || "An unexpected error occurred."}</p>
            <button onClick={() => reset()} style={{ padding: "12px 14px", borderRadius: 12, border: "none", cursor: "pointer" }}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
