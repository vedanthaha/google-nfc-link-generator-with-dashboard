"use client";

import { useState, useCallback, useRef } from "react";
import {
  isValidUrl,
  isGoogleUrl,
  isGoogleReviewUrl,
  extractPlaceId,
} from "./lib/url-utils";
import {
  generateQrPngDataUrl,
  generateQrSvgString,
  generateQrPngBlob,
  downloadBlob,
  downloadString,
} from "./lib/qr-utils";

type Step = "input" | "details" | "result";

interface ResolvedState {
  originalUrl: string;
  businessName: string;
  googleReviewUrl: string;
  placeId: string | null;
  isVerified: boolean;
}

interface CreatedBusinessResult {
  slug: string;
  name: string;
  googleReviewUrl: string;
  reviewPageUrl: string;
  qrDataUrl: string;
  qrSvgString: string;
}

export default function Home() {
  const [step, setStep] = useState<Step>("input");
  const [inputUrl, setInputUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Step 2: Resolved business details (editable)
  const [resolved, setResolved] = useState<ResolvedState>({
    originalUrl: "",
    businessName: "",
    googleReviewUrl: "",
    placeId: null,
    isVerified: false,
  });

  // Step 3: Final created permanent business result
  const [result, setResult] = useState<CreatedBusinessResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Copy helper
  const copyToClipboard = useCallback(
    async (text: string, fieldId: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
      } catch {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        setCopiedField(fieldId);
        setTimeout(() => setCopiedField(null), 2000);
      }
    },
    []
  );

  // Downloads for QR code
  const handleDownloadPng = useCallback(async () => {
    if (!result) return;
    try {
      const blob = await generateQrPngBlob(result.reviewPageUrl);
      downloadBlob(
        blob,
        `${result.slug}-review-qr.png`
      );
    } catch (err) {
      console.error("PNG download failed:", err);
    }
  }, [result]);

  const handleDownloadSvg = useCallback(() => {
    if (!result) return;
    downloadString(
      result.qrSvgString,
      `${result.slug}-review-qr.svg`,
      "image/svg+xml"
    );
  }, [result]);

  // Step 1 -> 2: Resolve URL to identify business name and verified review destination
  const handleResolveUrl = async () => {
    const trimmed = inputUrl.trim();

    if (!trimmed) {
      setErrorMessage("Please enter a Google Maps or Business Profile URL.");
      return;
    }

    if (!isValidUrl(trimmed)) {
      setErrorMessage("Please enter a valid HTTP or HTTPS URL.");
      return;
    }

    if (!isGoogleUrl(trimmed)) {
      setErrorMessage(
        "Please enter a Google Maps or Google Business Profile link."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      // Check if it's already a direct writereview link
      if (isGoogleReviewUrl(trimmed)) {
        const placeId = extractPlaceId(trimmed);
        setResolved({
          originalUrl: trimmed,
          businessName: "",
          googleReviewUrl: trimmed,
          placeId,
          isVerified: true,
        });
        setStep("details");
        setLoading(false);
        return;
      }

      // Server-side redirect resolution without paid APIs
      const res = await fetch("/api/resolve-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      if (!res.ok) {
        throw new Error("Could not resolve this Google Maps link.");
      }

      const data = await res.json();
      setResolved({
        originalUrl: trimmed,
        businessName: data.businessName || "",
        googleReviewUrl: data.reviewUrl || "",
        placeId: data.placeId || null,
        isVerified: Boolean(data.isVerified),
      });
      setStep("details");
    } catch (err: unknown) {
      console.error("Resolution error:", err);
      // Let user provide details manually rather than failing
      setResolved({
        originalUrl: trimmed,
        businessName: "",
        googleReviewUrl: "",
        placeId: null,
        isVerified: false,
      });
      setStep("details");
    } finally {
      setLoading(false);
    }
  };

  // Step 2 -> 3: Create permanent business configuration in database
  const handleCreateBusiness = async () => {
    if (!resolved.businessName.trim()) {
      setErrorMessage("Business name is required.");
      return;
    }

    if (!resolved.googleReviewUrl.trim()) {
      setErrorMessage(
        "Google review destination URL is required. Please provide the business's official Google review link."
      );
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const res = await fetch("/api/businesses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: resolved.businessName.trim(),
          mapsUrl: resolved.originalUrl.trim() || undefined,
          googleReviewUrl: resolved.googleReviewUrl.trim(),
          placeId: resolved.placeId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to create business page.");
      }

      const data = await res.json();
      const reviewPageUrl = data.reviewPageUrl;

      // Generate QR codes for the hosted /review/[slug] page URL
      const [qrDataUrl, qrSvgString] = await Promise.all([
        generateQrPngDataUrl(reviewPageUrl),
        generateQrSvgString(reviewPageUrl),
      ]);

      setResult({
        slug: data.business.slug,
        name: data.business.name,
        googleReviewUrl: data.business.google_review_url,
        reviewPageUrl,
        qrDataUrl,
        qrSvgString,
      });
      setStep("result");
    } catch (err: unknown) {
      console.error("Creation error:", err);
      const msg =
        err instanceof Error ? err.message : "Failed to create business page.";
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = useCallback(() => {
    setInputUrl("");
    setResolved({
      originalUrl: "",
      businessName: "",
      googleReviewUrl: "",
      placeId: null,
      isVerified: false,
    });
    setResult(null);
    setStep("input");
    setErrorMessage("");
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 font-sans">
      {/* Header */}
      <header className="w-full border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={handleReset}
            className="flex items-center gap-2.5 text-sm font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-500 flex items-center justify-center text-white font-black text-sm shadow-xs">
              AI
            </div>
            <span>ReviewQR & NFC Studio</span>
          </button>
          <div className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
            Multi-Business Generator
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-xl">
          {/* Hero */}
          {step === "input" && (
            <div className="text-center mb-8 animate-in">
              <span className="inline-block text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 mb-3 border border-amber-200 dark:border-amber-900/50">
                Any Google Business • Permanent AI Page
              </span>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950 dark:text-neutral-50 leading-tight">
                AI Review & NFC Generator
              </h1>
              <p className="mt-3 text-sm sm:text-base text-neutral-600 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed">
                Paste any Google Maps profile to generate a permanent, branded
                AI review page with downloadable QR codes and NFC card URLs.
              </p>
            </div>
          )}

          {/* STEP 1: Input URL */}
          {step === "input" && (
            <div className="space-y-4 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm animate-in">
              <div>
                <label
                  htmlFor="url-input"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-2"
                >
                  Google Maps Business Profile Link
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="url-input"
                    type="url"
                    value={inputUrl}
                    onChange={(e) => {
                      setInputUrl(e.target.value);
                      if (errorMessage) setErrorMessage("");
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleResolveUrl();
                    }}
                    placeholder="https://maps.app.goo.gl/... or google.com/maps/place/..."
                    className="w-full h-13 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 text-xs sm:text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all font-mono"
                    spellCheck={false}
                    autoFocus
                  />
                  {inputUrl && (
                    <button
                      onClick={() => {
                        setInputUrl("");
                        inputRef.current?.focus();
                      }}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                      aria-label="Clear input"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Sample Shortcuts for Testing */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-neutral-400">Quick tests:</span>
                <button
                  type="button"
                  onClick={() =>
                    setInputUrl("https://maps.app.goo.gl/2EUdHNiQTreRkgcV8")
                  }
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium"
                >
                  Chocolate Boutique
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setInputUrl(
                      "https://search.google.com/local/writereview?placeid=ChIJ010lMK_9YjkRWwUxNNEHQ3U"
                    )
                  }
                  className="px-2.5 py-1 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 font-medium"
                >
                  Aloha Sandhu Farms
                </button>
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500 dark:text-red-400">
                  {errorMessage}
                </p>
              )}

              <button
                id="resolve-button"
                onClick={handleResolveUrl}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Resolving Business Link…
                  </span>
                ) : (
                  "Continue to Business Setup →"
                )}
              </button>
            </div>
          )}

          {/* STEP 2: Verify & Edit Business Details */}
          {step === "details" && (
            <div className="space-y-5 bg-white dark:bg-neutral-900 p-6 rounded-3xl border border-neutral-200 dark:border-neutral-800 shadow-sm animate-in">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-lg font-bold text-neutral-950 dark:text-neutral-50">
                    Configure Business Details
                  </h2>
                  <button
                    onClick={() => setStep("input")}
                    className="text-xs text-neutral-500 hover:underline"
                  >
                    Change Link
                  </button>
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Confirm the business name and Google review destination before
                  generating the permanent page.
                </p>
              </div>

              {/* Business Name Field */}
              <div>
                <label
                  htmlFor="business-name-input"
                  className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5"
                >
                  Business Name{" "}
                  <span className="text-neutral-400 font-normal lowercase">
                    (editable)
                  </span>
                </label>
                <input
                  id="business-name-input"
                  type="text"
                  value={resolved.businessName}
                  onChange={(e) =>
                    setResolved((prev) => ({
                      ...prev,
                      businessName: e.target.value,
                    }))
                  }
                  placeholder="e.g. Chocolate Boutique"
                  className="w-full h-12 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-sm font-semibold outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>

              {/* Google Review Destination URL */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="review-destination-input"
                    className="block text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400"
                  >
                    Google Review Destination URL
                  </label>
                  {resolved.isVerified && (
                    <span className="text-xs font-bold text-green-600 dark:text-green-400 flex items-center gap-1">
                      ✓ Verified Destination
                    </span>
                  )}
                </div>

                {!resolved.isVerified && (
                  <div className="p-3 mb-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
                    <p className="font-semibold mb-0.5">
                      Review link could not be automatically verified.
                    </p>
                    <p>
                      Please paste the business owner&apos;s official &quot;Get
                      more reviews&quot; link below. Never save an unverified URL.
                    </p>
                  </div>
                )}

                <input
                  id="review-destination-input"
                  type="url"
                  value={resolved.googleReviewUrl}
                  onChange={(e) =>
                    setResolved((prev) => ({
                      ...prev,
                      googleReviewUrl: e.target.value,
                    }))
                  }
                  placeholder="https://search.google.com/local/writereview?placeid=... or g.page/r/.../review"
                  className="w-full h-12 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 text-xs font-mono outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 transition-all"
                />
              </div>

              {errorMessage && (
                <p className="text-xs text-red-500 dark:text-red-400">
                  {errorMessage}
                </p>
              )}

              <button
                id="create-business-button"
                onClick={handleCreateBusiness}
                disabled={loading}
                className="w-full h-12 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 font-semibold text-sm hover:bg-neutral-800 dark:hover:bg-neutral-200 disabled:opacity-50 transition-all shadow-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
                    Generating Permanent Page & QR…
                  </span>
                ) : (
                  "Create Permanent AI Page & QR Code →"
                )}
              </button>
            </div>
          )}

          {/* STEP 3: Result with QR, NFC URL, and Test Links */}
          {step === "result" && result && (
            <div className="space-y-6 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl p-6 shadow-sm animate-in">
              <div className="text-center">
                <span className="text-xs font-bold uppercase tracking-wider text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/50 px-2.5 py-1 rounded-full border border-green-200 dark:border-green-900/50">
                  ✓ Permanent Review Page Created
                </span>
                <h2
                  id="result-business-name"
                  className="text-2xl sm:text-3xl font-extrabold text-neutral-950 dark:text-neutral-50 mt-2 tracking-tight"
                >
                  {result.name}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Ready to print QR codes and program NFC tags.
                </p>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center">
                <div className="bg-white p-5 rounded-2xl border border-neutral-200 dark:border-neutral-700 shadow-xs inline-block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={result.qrDataUrl}
                    alt={`${result.name} AI Review QR Code`}
                    className="w-56 h-56 sm:w-64 sm:h-64"
                    id="qr-code-image"
                  />
                </div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center">
                  Scans directly to your hosted AI review page
                </p>

                {/* QR Downloads */}
                <div className="flex gap-2.5 mt-4">
                  <button
                    id="download-png"
                    onClick={handleDownloadPng}
                    className="h-10 px-4 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors flex items-center gap-1.5"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download PNG
                  </button>
                  <button
                    id="download-svg"
                    onClick={handleDownloadSvg}
                    className="h-10 px-4 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors flex items-center gap-1.5"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download SVG
                  </button>
                </div>
              </div>

              <hr className="border-neutral-100 dark:border-neutral-800" />

              {/* Permanent AI Review Page URL */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 mb-1.5 block">
                  Unique AI Review-Page URL
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center">
                    <span
                      id="permanent-review-url-text"
                      className="text-xs text-neutral-800 dark:text-neutral-200 truncate font-mono"
                      title={result.reviewPageUrl}
                    >
                      {result.reviewPageUrl}
                    </span>
                  </div>
                  <button
                    id="copy-page-url"
                    onClick={() =>
                      copyToClipboard(result.reviewPageUrl, "page-url")
                    }
                    className="h-11 px-4 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    {copiedField === "page-url" ? "Copied!" : "Copy URL"}
                  </button>
                </div>
              </div>

              {/* NFC-Ready URL Section */}
              <div>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-amber-600 dark:text-amber-400"
                  >
                    <path d="M6 8.32a7.43 7.43 0 0 1 0 7.36" />
                    <path d="M9.46 6.21a11.76 11.76 0 0 1 0 11.58" />
                    <path d="M12.91 4.1a15.91 15.91 0 0 1 .01 15.8" />
                    <path d="M16.37 2a20.16 20.16 0 0 1 0 20" />
                  </svg>
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                    NFC-Ready URL (Identical to QR)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0 h-11 px-3.5 rounded-xl bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center">
                    <span
                      id="nfc-url-text"
                      className="text-xs text-neutral-800 dark:text-neutral-200 truncate font-mono"
                      title={result.reviewPageUrl}
                    >
                      {result.reviewPageUrl}
                    </span>
                  </div>
                  <button
                    id="copy-nfc-url"
                    onClick={() =>
                      copyToClipboard(result.reviewPageUrl, "nfc")
                    }
                    className="h-11 px-4 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 text-xs font-semibold hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap flex items-center gap-1.5"
                  >
                    {copiedField === "nfc" ? "Copied!" : "Copy NFC URL"}
                  </button>
                </div>
              </div>

              {/* Google Review Destination info */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400">
                    Google Review Destination
                  </label>
                  <a
                    id="test-google-destination-link"
                    href={result.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-semibold"
                  >
                    Test in Google ↗
                  </a>
                </div>
                <div className="p-3 rounded-xl bg-neutral-100 dark:bg-neutral-800 text-xs font-mono text-neutral-600 dark:text-neutral-300 truncate">
                  {result.googleReviewUrl}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <a
                  id="preview-customer-review-link"
                  href={result.reviewPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-12 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  Test Customer AI Review Flow ↗
                </a>

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full h-11 rounded-xl border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 font-semibold text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  + Generate Another Business Page
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-neutral-500">
          <p>ReviewQR & NFC Studio • Compatible with Vercel & Supabase</p>
          <p>Zero external paid APIs required.</p>
        </div>
      </footer>
    </div>
  );
}
