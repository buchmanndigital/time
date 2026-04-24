import { NextResponse } from "next/server";
import { runRegisterFromFormData } from "@/lib/auth/credential-operations";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const formData = await request.formData();
  const result = await runRegisterFromFormData(formData);
  if (result.error) {
    return NextResponse.redirect(
      new URL(`/register?error=${encodeURIComponent(result.error)}`, request.url),
      303,
    );
  }
  return NextResponse.redirect(new URL("/", request.url), 303);
}
