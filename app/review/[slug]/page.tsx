"use client";

import { useState, useCallback, useEffect, use } from "react";
import Link from "next/link";

interface BusinessData {
  id?: string;
  slug: string;
  name: string;
  maps_url?: string;
  google_review_url: string;
  place_id?: string;
}

const EXPERIENCE_CATEGORIES = [
  { id: "taste", label: "Taste" },
  { id: "food_quality", label: "Food Quality" },
  { id: "service", label: "Service" },
  { id: "ambience", label: "Ambience" },
];

export default function BusinessReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;

  const [business, setBusiness] = useState<BusinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [rating, setRating] = useState<number>(5);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([
    "Taste",
    "Service",
  ]);
  const [itemsTried, setItemsTried] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedReview, setGeneratedReview] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Clipboard & navigation status
  const [copyStatus, setCopyStatus] = useState<"idle" | "success" | "failed">(
    "idle"
  );
  const [isNavigating, setIsNavigating] = useState<boolean>(false);

  // Fetch business configuration from API
  useEffect(() => {
    let isMounted = true;
    async function loadBusiness() {
      try {
        setLoading(true);
        const res = await fetch(`/api/businesses/${encodeURIComponent(slug)}`);
        if (!res.ok) {
          throw new Error("Business not found or invalid link.");
        }
        const data = await res.json();
        if (isMounted) {
          setBusiness(data.business);
        }
      } catch (err: unknown) {
        if (isMounted) {
          const msg =
            err instanceof Error ? err.message : "Failed to load business.";
          setLoadError(msg);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    if (slug) {
      loadBusiness();
    }
    return () => {
      isMounted = false;
    };
  }, [slug]);

  // Toggle category highlights
  const toggleCategory = (label: string) => {
    setSelectedCategories((prev) =>
      prev.includes(label)
        ? prev.filter((item) => item !== label)
        : [...prev, label]
    );
  };

  // Generate review strictly from customer's input via server Groq route
  const handleGenerateReview = async () => {
    if (!rating) {
      setErrorMessage("Please select a star rating first.");
      return;
    }

    setIsGenerating(true);
    setErrorMessage("");
    setCopyStatus("idle");

    try {
      const res = await fetch("/api/generate-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: business?.name || "this business",
          rating,
          categories: selectedCategories,
          items: itemsTried,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to generate review. Please try again.");
      }

      const data = await res.json();
      setGeneratedReview(data.review || "");
    } catch (err: unknown) {
      console.error("Generate error:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to generate review.";
      setErrorMessage(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Final button action: Copy Review & Open Google
  const handleCopyAndOpenGoogle = useCallback(async () => {
    const textToCopy = generatedReview.trim();
    if (!textToCopy || !business?.google_review_url) return;

    let copied = false;

    // 1. Try modern Async Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        copied = true;
      } catch (clipErr) {
        console.warn("Async clipboard write failed:", clipErr);
      }
    }

    // 2. Fallback to execCommand if clipboard was restricted
    if (!copied) {
      try {
        const textarea = document.createElement("textarea");
        textarea.value = textToCopy;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        textarea.style.top = "0";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        copied = document.execCommand("copy");
        document.body.removeChild(textarea);
      } catch (fallbackErr) {
        console.warn("execCommand copy fallback failed:", fallbackErr);
      }
    }

    if (copied) {
      setCopyStatus("success");
      setIsNavigating(true);
      // Wait briefly so customer sees clear confirmation, then navigate to Google
      setTimeout(() => {
        window.location.href = business.google_review_url;
      }, 1200);
    } else {
      // Handle clipboard failures honestly without leaving user stranded
      setCopyStatus("failed");
    }
  }, [generatedReview, business]);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-600 dark:text-neutral-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neutral-900 dark:border-neutral-100 mb-4" />
        <p className="text-sm">Loading review experience…</p>
      </div>
    );
  }

  if (loadError || !business) {
    return (
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-center mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100 mb-2">
          Business Not Found
        </h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm mb-6">
          {loadError || "This review link may be inactive or expired."}
        </p>
        <Link
          href="/"
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:opacity-90 transition-opacity"
        >
          Go to Generator
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 flex flex-col justify-between p-4 sm:p-6 font-sans antialiased">
      <div className="w-full max-w-md mx-auto pt-4 sm:pt-8 pb-12">
        {/* Business Branding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-3 shadow-xs">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h1
            id="business-name-header"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50"
          >
            {business.name}
          </h1>
          <p className="text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 mt-1">
            Share your honest feedback on Google
          </p>
        </div>

        {/* Card Container */}
        <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-5 sm:p-6 shadow-sm space-y-6">
          {/* 1. Overall 1-5 Star Rating */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2">
              Overall Rating
            </label>
            <div className="flex items-center justify-center gap-2 py-1">
              {[1, 2, 3, 4, 5].map((star) => {
                const isActive = star <= rating;
                return (
                  <button
                    key={star}
                    id={`star-rating-${star}`}
                    type="button"
                    onClick={() => {
                      setRating(star);
                      if (errorMessage) setErrorMessage("");
                    }}
                    className="p-1 rounded-lg transition-transform active:scale-90 hover:scale-110 focus:outline-none"
                    aria-label={`${star} star${star > 1 ? "s" : ""}`}
                  >
                    <svg
                      width="38"
                      height="38"
                      viewBox="0 0 24 24"
                      className={`transition-colors ${
                        isActive
                          ? "fill-amber-400 stroke-amber-500 text-amber-500"
                          : "fill-neutral-100 dark:fill-neutral-800 stroke-neutral-300 dark:stroke-neutral-700 text-neutral-300 dark:text-neutral-700"
                      }`}
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                  </button>
                );
              })}
            </div>
            <div className="text-center text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">
              {rating === 5 && "5 Stars — Loved it!"}
              {rating === 4 && "4 Stars — Great experience"}
              {rating === 3 && "3 Stars — Average / Okay"}
              {rating === 2 && "2 Stars — Below expectations"}
              {rating === 1 && "1 Star — Disappointing"}
            </div>
          </div>

          {/* 2. Selectable Experience Highlights */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2.5">
              Experience Highlights
            </label>
            <div className="flex flex-wrap gap-2">
              {EXPERIENCE_CATEGORIES.map((cat) => {
                const isSelected = selectedCategories.includes(cat.label);
                return (
                  <button
                    key={cat.id}
                    id={`category-chip-${cat.id}`}
                    type="button"
                    onClick={() => toggleCategory(cat.label)}
                    className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5 border ${
                      isSelected
                        ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 border-neutral-900 dark:border-neutral-100 shadow-xs"
                        : "bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300 border-transparent hover:bg-neutral-200 dark:hover:bg-neutral-700"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Optional field: What did you actually try or experience? */}
          <div>
            <label
              htmlFor="items-input"
              className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2"
            >
              What did you try or experience?{" "}
              <span className="text-neutral-400 normal-case font-normal">
                (optional)
              </span>
            </label>
            <input
              id="items-input"
              type="text"
              value={itemsTried}
              onChange={(e) => setItemsTried(e.target.value)}
              placeholder="e.g. Signature dish, customer service, specific order..."
              className="w-full h-12 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-xs sm:text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
            />
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-600 dark:text-red-400">
              {errorMessage}
            </div>
          )}

          {/* 4. Generate Review Button */}
          {!generatedReview && (
            <button
              id="generate-review-button"
              type="button"
              onClick={handleGenerateReview}
              disabled={isGenerating}
              className="w-full h-12 rounded-xl bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isGenerating ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Drafting review…
                </>
              ) : (
                <>
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  Generate Review
                </>
              )}
            </button>
          )}

          {/* 5. Editable Review Textarea & Action */}
          {generatedReview && (
            <div className="space-y-4 pt-1 animate-in">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="editable-review-textarea"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400"
                >
                  Your Review{" "}
                  <span className="text-neutral-400 font-normal normal-case">
                    (Feel free to edit)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={handleGenerateReview}
                  disabled={isGenerating}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                >
                  Regenerate
                </button>
              </div>

              <textarea
                id="editable-review-textarea"
                rows={4}
                value={generatedReview}
                onChange={(e) => setGeneratedReview(e.target.value)}
                className="w-full p-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs sm:text-sm leading-relaxed outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all resize-y"
              />

              {/* Honest Clipboard Failure Notice */}
              {copyStatus === "failed" && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                  <p className="font-semibold">
                    Automatic clipboard copy was blocked by your browser.
                  </p>
                  <p>
                    Please press and hold the review text above to copy it, then
                    tap below to open Google:
                  </p>
                  <a
                    id="manual-open-google-link"
                    href={business.google_review_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-1 font-bold text-amber-900 dark:text-amber-200 underline"
                  >
                    Open Google Review Composer →
                  </a>
                </div>
              )}

              {/* 6. One final button: Copy Review & Open Google */}
              <button
                id="copy-and-open-google-button"
                type="button"
                onClick={handleCopyAndOpenGoogle}
                disabled={isNavigating}
                className="w-full h-13 py-3.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 font-semibold text-sm sm:text-base transition-all shadow-md flex items-center justify-center gap-2"
              >
                {copyStatus === "success" ? (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-green-500"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    Review Copied! Opening Google…
                  </>
                ) : (
                  <>
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    Copy Review & Open Google
                  </>
                )}
              </button>

              <p className="text-center text-xs text-neutral-400 dark:text-neutral-500">
                Copies text to your clipboard and opens Google Review composer.
                Paste and submit your review on Google.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-neutral-400 dark:text-neutral-500 pb-2">
        <p>Review Assistant for {business.name}</p>
      </footer>
    </div>
  );
}
