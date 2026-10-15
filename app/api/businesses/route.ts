import { NextRequest, NextResponse } from "next/server";
import { createBusiness, generateSlug } from "../../lib/db";

function getBaseUrl(req: NextRequest): string {
  // 1. Explicit override if set
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL.replace(/\/+$/, "");
  }

  // 2. Vercel automatic production URL
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // 3. Vercel deployment URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // 4. Automatic incoming request host (works on any custom domain or Vercel preview)
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ||
    (host && host.includes("localhost") ? "http" : "https");

  if (host) {
    return `${proto}://${host}`;
  }

  return "http://localhost:3000";
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, mapsUrl, googleReviewUrl, placeId } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

    if (!googleReviewUrl || typeof googleReviewUrl !== "string" || !googleReviewUrl.trim()) {
      return NextResponse.json(
        { error: "Google review destination URL is required." },
        { status: 400 }
      );
    }

    const trimmedName = name.trim();
    const trimmedReviewUrl = googleReviewUrl.trim();
    const trimmedMapsUrl = mapsUrl ? String(mapsUrl).trim() : undefined;
    const trimmedPlaceId = placeId ? String(placeId).trim() : undefined;

    // Generate unique slug
    const slug = generateSlug(trimmedName);

    const business = await createBusiness({
      slug,
      name: trimmedName,
      maps_url: trimmedMapsUrl,
      google_review_url: trimmedReviewUrl,
      place_id: trimmedPlaceId,
    });

    const baseUrl = getBaseUrl(req);
    const reviewPageUrl = `${baseUrl}/review/${business.slug}`;

    return NextResponse.json({
      success: true,
      business,
      reviewPageUrl,
    });
  } catch (error: unknown) {
    console.error("Error in POST /api/businesses:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
