import { NextResponse, type NextRequest } from "next/server";

export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/servers",
    "/auth-status",
    "/ticket-categories/:path*",
    "/ticket-forms/:path*",
    "/tickets/:path*",
  ],
};
