import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    let finalUrl = url;

    // Follow redirects for short links (e.g., maps.app.goo.gl)
    if (url.includes("maps.app.goo.gl") || url.includes("goo.gl") || url.includes("g.page")) {
      try {
        const response = await fetch(url, { method: "HEAD", redirect: "follow" });
        finalUrl = response.url;
      } catch (e) {
        console.warn("Failed to resolve short URL, using original.", e);
      }
    }

    // Attempt to extract business name from URL
    let textQuery = "";
    try {
      const parsed = new URL(finalUrl);
      if (parsed.pathname.startsWith("/maps/place/")) {
        const parts = parsed.pathname.split("/");
        if (parts.length > 3) {
          textQuery = decodeURIComponent(parts[3]).replace(/\+/g, " ");
        }
      } else if (parsed.searchParams.has("q")) {
        textQuery = parsed.searchParams.get("q") || "";
      } else if (parsed.searchParams.has("query")) {
        textQuery = parsed.searchParams.get("query") || "";
      }
    } catch (e) {
      console.warn("Could not parse URL to extract name", e);
    }

    if (!textQuery) {
      // Fallback: If we couldn't extract a name, we might just try using the URL itself as the query, 
      // but Places API might not like it. Let's try passing the URL.
      textQuery = url; 
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      console.warn("GOOGLE_PLACES_API_KEY is not configured. Returning mock data for testing.");
      
      // Mock response for testing the flow without an API key
      return NextResponse.json({
        matches: [
          {
            placeId: "ChIJ010lMK_9YjkRWwUxNNEHQ3U",
            name: "Aloha Sandhu Farms & Resorts",
            address: "Near, Bypass Rd, Omaxe City 1, Mayakhedi, Indore, Madhya Pradesh 452016, India",
            writeReviewUrl: "https://search.google.com/local/writereview?placeid=ChIJ010lMK_9YjkRWwUxNNEHQ3U", // Proper direct review composer format
          }
        ]
      });
    }

    // Call Google Places API (New)
    const placesResponse = await fetch(
      "https://places.googleapis.com/v1/places:searchText",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.formattedAddress,places.googleMapsLinks.writeAReviewUri",
        },
        body: JSON.stringify({
          textQuery,
        }),
      }
    );

    if (!placesResponse.ok) {
      console.error("Places API error:", await placesResponse.text());
      return NextResponse.json(
        { error: "Failed to query Google Places API." },
        { status: 502 }
      );
    }

    const data = await placesResponse.json();

    if (!data.places || data.places.length === 0) {
      return NextResponse.json({ matches: [] });
    }

    interface GooglePlaceItem {
      id?: string;
      displayName?: { text?: string };
      formattedAddress?: string;
      googleMapsLinks?: { writeAReviewUri?: string };
    }

    // Map to simple structure
    const matches = (data.places as GooglePlaceItem[]).map((place) => ({
      placeId: place.id || "",
      name: place.displayName?.text || "Unknown Business",
      address: place.formattedAddress || "",
      writeReviewUrl: place.googleMapsLinks?.writeAReviewUri || "",
    }));

    return NextResponse.json({ matches });
  } catch (error) {
    console.error("resolve-business error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
