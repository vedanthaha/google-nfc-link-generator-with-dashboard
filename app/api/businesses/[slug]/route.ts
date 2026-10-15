import { NextRequest, NextResponse } from "next/server";
import { getBusinessBySlug } from "../../../lib/db";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;

    if (!slug) {
      return NextResponse.json(
        { error: "Business slug is required." },
        { status: 400 }
      );
    }

    const business = await getBusinessBySlug(slug);

    if (!business) {
      return NextResponse.json(
        { error: "Business not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ business });
  } catch (error: unknown) {
    console.error("Error in GET /api/businesses/[slug]:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
