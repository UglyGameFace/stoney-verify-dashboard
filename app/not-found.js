import Link from "next/link"

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#08111f", color: "#e1ebf8", fontFamily: "Inter, system-ui, sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <div style={{ border: "1px solid rgba(255,255,255,.08)", background: "rgba(255,255,255,.03)", padding: 18, borderRadius: 16 }}>
          <h1 style={{ marginTop: 0 }}>Page not found</h1>
          <p>The page you requested does not exist or is no longer available.</p>
          <Link href="/" style={{ textDecoration: "underline" }}>Return to dashboard</Link>
        </div>
      </div>
    </div>
  )
}
