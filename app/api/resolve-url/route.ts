import { NextRequest, NextResponse } from "next/server";
import {
  extractBusinessName,
  extractPlaceId,
  buildReviewUrl,
} from "../../lib/url-utils";

/**
 * API route to resolve Google shortened URLs (maps.app.goo.gl, etc.)
 * by following redirects server-side without paid APIs.
 *
 * Never guesses or claims an unverified destination is correct.
 */
export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      );
    }

    const trimmed = url.trim();
    let resolvedUrl = trimmed;

    // Follow redirects for shortlinks
    if (
      trimmed.includes("maps.app.goo.gl") ||
      trimmed.includes("goo.gl") ||
      trimmed.includes("g.co") ||
      trimmed.includes("g.page")
    ) {
      try {
        const response = await fetch(trimmed, {
          method: "GET",
          redirect: "follow",
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
        });
        resolvedUrl = response.url;
      } catch (fetchErr) {
        console.warn("GET redirect follow failed, trying HEAD:", fetchErr);
        try {
          const headResponse = await fetch(trimmed, {
            method: "HEAD",
            redirect: "follow",
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            },
          });
          resolvedUrl = headResponse.url;
        } catch (headErr) {
          console.warn("HEAD redirect follow failed:", headErr);
        }
      }
    }

    const businessName = extractBusinessName(resolvedUrl) || "";
    const placeId = extractPlaceId(resolvedUrl);

    // Reliable review resolution: verified if Place ID is extracted
    const isVerified = Boolean(placeId);
    const reviewUrl = placeId ? buildReviewUrl(placeId) : "";

    return NextResponse.json({
      resolvedUrl,
      businessName,
      placeId: placeId || null,
      reviewUrl,
      isVerified,
    });
  } catch (error: unknown) {
    console.error("URL resolution error:", error);
    const msg = error instanceof Error ? error.message : "Failed to resolve URL";
    return NextResponse.json(
      { error: msg },
      { status: 500 }
    );
  }
}
