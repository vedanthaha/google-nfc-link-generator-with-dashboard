import Groq from "groq-sdk";
import { NextRequest, NextResponse } from "next/server";

interface ReviewRequest {
  businessName?: string;
  rating: number;
  categories?: string[];
  items?: string;
}

/** Formats category chips naturally into English */
function formatCategories(categories: string[]): string {
  if (categories.length === 0) return "";
  const cleaned = categories.map((c) => c.trim().toLowerCase());
  if (cleaned.length === 1) return cleaned[0];
  if (cleaned.length === 2) return `${cleaned[0]} and ${cleaned[1]}`;
  return `${cleaned.slice(0, -1).join(", ")}, and ${cleaned[cleaned.length - 1]}`;
}

/**
 * Deterministic honest review generator strictly based on user's exact inputs.
 * Zero invented facts, menu items, or claims.
 * Reflects selected rating honestly (including negative and mixed experiences).
 */
export function generateHonestReviewFallback({
  businessName = "this business",
  rating,
  categories = [],
  items = "",
}: ReviewRequest): string {
  const name = businessName.trim() || "this business";
  const trimmedItems = items.trim();
  const catText = formatCategories(categories);

  const sentences: string[] = [];

  if (rating === 5) {
    sentences.push(`I had an exceptional 5-star experience at ${name}!`);
    if (trimmedItems) {
      sentences.push(`I tried the ${trimmedItems} and was thoroughly impressed.`);
    }
    if (catText) {
      sentences.push(
        categories.length === 1
          ? `The ${catText} was outstanding.`
          : `Everything regarding ${catText} was top tier.`
      );
    }
    sentences.push("Highly recommend visiting!");
  } else if (rating === 4) {
    sentences.push(`I had a very good 4-star visit to ${name}.`);
    if (trimmedItems) {
      sentences.push(`I had the ${trimmedItems} and enjoyed it.`);
    }
    if (catText) {
      sentences.push(
        categories.length === 1
          ? `The ${catText} was great.`
          : `Both the ${catText} were very good.`
      );
    }
    sentences.push("I would gladly return.");
  } else if (rating === 3) {
    sentences.push(`My experience at ${name} was average (3 stars).`);
    if (trimmedItems) {
      sentences.push(`I tried the ${trimmedItems}.`);
    }
    if (catText) {
      sentences.push(
        `While the ${catText} was decent, there is definitely room for improvement.`
      );
    }
    sentences.push("A mixed experience overall.");
  } else if (rating === 2) {
    sentences.push(`My visit to ${name} was disappointing (2 stars).`);
    if (trimmedItems) {
      sentences.push(`I had the ${trimmedItems}, but it fell below expectations.`);
    }
    if (catText) {
      sentences.push(
        `The ${catText} was lacking and needs significant attention.`
      );
    }
    sentences.push("Hope the team takes steps to address these issues.");
  } else {
    // 1 star
    sentences.push(
      `I had an unsatisfactory 1-star experience at ${name}.`
    );
    if (trimmedItems) {
      sentences.push(`I tried the ${trimmedItems}, and it was very disappointing.`);
    }
    if (catText) {
      sentences.push(
        `The ${catText} fell far short of acceptable standards.`
      );
    }
    sentences.push("I would not recommend based on this visit.");
  }

  return sentences.join(" ");
}

export async function POST(req: NextRequest) {
  try {
    const body: ReviewRequest = await req.json();
    const {
      businessName = "this business",
      rating,
      categories = [],
      items = "",
    } = body;

    if (!rating || rating < 1 || rating > 5) {
      return NextResponse.json(
        { error: "Rating must be between 1 and 5" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    if (!apiKey) {
      // Deterministic honest generator fallback when GROQ_API_KEY is not configured
      const review = generateHonestReviewFallback({
        businessName,
        rating,
        categories,
        items,
      });
      return NextResponse.json({ review, source: "deterministic_fallback" });
    }

    // Call Groq AI API
    try {
      const groq = new Groq({ apiKey });

      const promptSystem = `You are a helpful assistant helping a customer draft their authentic, genuine Google Review for "${businessName}".

CRITICAL CONSTRAINTS:
1. Ground the review strictly and exclusively in the customer's supplied information.
2. DO NOT invent, assume, or add menu items, dishes, drinks, staff names, prices, events, or experiences that were not explicitly provided.
3. If "What they tried or experienced" is empty or not provided, DO NOT mention any food, drinks, or items.
4. Reflect the customer's selected star rating (${rating} out of 5 stars) honestly and faithfully. For lower ratings (1-3 stars), draft an honest, constructive critique reflecting their dissatisfaction. For 4-5 stars, express genuine appreciation.
5. Write in natural, conversational first-person English in a single concise paragraph.
6. Do NOT include quotation marks, headings, or meta comments. Return ONLY the review text.`;

      const userContent = `Customer Input:
- Rating: ${rating} out of 5 stars
- Highlights selected: ${
        categories.length > 0 ? categories.join(", ") : "None specified"
      }
- What they tried or experienced: ${
        items.trim() ? items.trim() : "None specified"
      }`;

      const chatCompletion = await groq.chat.completions.create({
        messages: [
          { role: "system", content: promptSystem },
          { role: "user", content: userContent },
        ],
        model,
        temperature: 0.3,
        max_tokens: 350,
      });

      const review = chatCompletion.choices[0]?.message?.content?.trim();

      if (review) {
        return NextResponse.json({ review, source: "groq" });
      }
    } catch (groqErr) {
      console.warn(
        "Groq API call failed, falling back to deterministic honest generator:",
        groqErr
      );
    }

    // Fallback if Groq call failed or returned empty
    const review = generateHonestReviewFallback({
      businessName,
      rating,
      categories,
      items,
    });
    return NextResponse.json({ review, source: "fallback" });
  } catch (error: unknown) {
    console.error("Error in generate-review route:", error);
    const msg =
      error instanceof Error ? error.message : "Failed to generate review";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
