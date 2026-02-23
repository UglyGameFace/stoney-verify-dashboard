// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "sv_staff_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // protect dashboard routes
  if (pathname.startsWith("/dashboard")) {
    const token = req.cookies.get(COOKIE_NAME)?.value;
    if (!token) {
      const login = req.nextUrl.clone();
      login.pathname = "/api/auth/login";
      login.searchParams.set("next", pathname);
      return NextResponse.redirect(login);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
