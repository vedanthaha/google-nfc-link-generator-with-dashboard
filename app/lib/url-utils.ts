/**
 * Google Review URL Utilities
 *
 * Handles client-side & server-side URL parsing, Place ID extraction,
 * and hosted AI review page URL construction for Chocolate Boutique and other businesses.
 */

export const CHOCOLATE_BOUTIQUE_CONFIG = {
  businessName: "Chocolate Boutique",
  mapsUrl: "https://maps.app.goo.gl/2EUdHNiQTreRkgcV8",
  placeId: "ChIJC2rSWrz5YjkRPCpub2Dm4Ko",
  googleReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJC2rSWrz5YjkRPCpub2Dm4Ko",
};

/**
 * Converts a Google Maps feature ID (e.g. 0x3962f9bc5ad26a0b:0xaae0e6606f6e2a3c)
 * into its official Google Place ID (ChIJ...)
 */
export function featureIdToPlaceId(featureId: string): string | null {
  try {
    const parts = featureId.split(":");
    if (parts.length !== 2) return null;
    const hex1 = parts[0].replace(/^0x/i, "");
    const hex2 = parts[1].replace(/^0x/i, "");
    if (hex1.length !== 16 || hex2.length !== 16) return null;

    const bytes = new Uint8Array(20);
    bytes[0] = 0x0a;
    bytes[1] = 0x12;
    bytes[2] = 0x09;

    for (let i = 0; i < 8; i++) {
      bytes[3 + i] = parseInt(hex1.substr(14 - i * 2, 2), 16);
    }
    bytes[11] = 0x11;
    for (let i = 0; i < 8; i++) {
      bytes[12 + i] = parseInt(hex2.substr(14 - i * 2, 2), 16);
    }

    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/=+$/, "");
  } catch {
    return null;
  }
}

/** Extracts a Place ID from a Google URL if present, or derives it from feature data */
export function extractPlaceId(url: string): string | null {
  // Direct placeid query parameter
  const placeIdMatch = url.match(/[?&]placeid=([A-Za-z0-9_-]+)/i);
  if (placeIdMatch) return placeIdMatch[1];

  // Feature ID hex format in Google Maps URLs (!1s0x...:0x...)
  const featureId = extractFeatureId(url);
  if (featureId) {
    const derivedPlaceId = featureIdToPlaceId(featureId);
    if (derivedPlaceId) return derivedPlaceId;
  }

  return null;
}

/** Extracts feature ID hex pair from Google URL */
export function extractFeatureId(url: string): string | null {
  const dataMatch = url.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/i);
  if (dataMatch) return dataMatch[1];
  return null;
}

/** Extracts business name from standard Google Maps URLs */
export function extractBusinessName(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/maps/place/")) {
      const parts = parsed.pathname.split("/");
      if (parts.length > 3) {
        return decodeURIComponent(parts[3]).replace(/\+/g, " ");
      }
    }
    if (parsed.searchParams.has("q")) {
      return parsed.searchParams.get("q");
    }
  } catch {}
  return null;
}

/** Checks if a URL is already a Google Review (writereview) URL */
export function isGoogleReviewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      (parsed.hostname === "search.google.com" || parsed.hostname.endsWith(".google.com")) &&
      parsed.pathname.includes("/local/writereview")
    );
  } catch {
    return false;
  }
}

/** Checks if a URL is a Google Maps shortened URL */
export function isGoogleShortUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "maps.app.goo.gl" ||
      parsed.hostname === "goo.gl" ||
      parsed.hostname === "g.co" ||
      parsed.hostname === "g.page"
    );
  } catch {
    return false;
  }
}

/** Checks if a URL is any kind of Google Maps/Business URL */
export function isGoogleUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const validHosts = [
      "google.com",
      "www.google.com",
      "maps.google.com",
      "search.google.com",
      "maps.app.goo.gl",
      "goo.gl",
      "g.co",
      "g.page",
      "business.google.com",
    ];
    return validHosts.some(
      (h) => parsed.hostname === h || parsed.hostname.endsWith("." + h)
    );
  } catch {
    return false;
  }
}

/** Constructs a direct Google Review URL from a Place ID */
export function buildReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${placeId}`;
}

/** Constructs the URL pointing to our hosted AI review page */
export function buildHostedReviewUrl(origin: string, businessName: string, googleReviewUrl: string): string {
  const url = new URL("/review", origin);
  url.searchParams.set("name", businessName);
  url.searchParams.set("reviewUrl", googleReviewUrl);
  return url.toString();
}

/** Validates that a string is a plausible URL */
export function isValidUrl(input: string): boolean {
  try {
    const url = new URL(input.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
