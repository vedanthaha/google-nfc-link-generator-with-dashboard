/**
 * QR Code Generation Utilities
 *
 * Generates high-quality QR codes suitable for print, inspired by the
 * reference repo's use of the `qrcode` Python library.
 * Uses the `qrcode` npm package for browser-side generation.
 */
import QRCode from "qrcode";

/** Default QR options for high-quality print output */
const DEFAULT_OPTIONS: QRCode.QRCodeToDataURLOptions = {
  errorCorrectionLevel: "H", // Highest error correction for reliable scanning
  margin: 4, // Good quiet zone
  width: 1024, // High resolution for print
  color: {
    dark: "#000000",
    light: "#ffffff",
  },
};

/**
 * Generate a QR code as a PNG data URL
 */
export async function generateQrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    ...DEFAULT_OPTIONS,
    type: "image/png",
  });
}

/**
 * Generate a QR code as an SVG string
 */
export async function generateQrSvgString(url: string): Promise<string> {
  return QRCode.toString(url, {
    errorCorrectionLevel: "H",
    margin: 4,
    type: "svg",
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

/**
 * Generate a downloadable PNG blob for the QR code
 */
export async function generateQrPngBlob(url: string): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, url, {
    ...DEFAULT_OPTIONS,
    width: 2048, // Extra high resolution for download
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Failed to generate PNG blob"));
      },
      "image/png",
      1.0
    );
  });
}

/**
 * Trigger a file download from a Blob
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Trigger a file download from a string (e.g. SVG)
 */
export function downloadString(
  content: string,
  filename: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: mimeType });
  downloadBlob(blob, filename);
}
