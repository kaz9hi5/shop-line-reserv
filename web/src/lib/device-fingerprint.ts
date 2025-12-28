/**
 * Generate device fingerprint from browser information
 * This is a simple implementation - in production, consider using a more sophisticated library
 */
export function generateDeviceFingerprint(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const userAgent = navigator.userAgent || "";
  const language = navigator.language || "";
  const platform = navigator.platform || "";
  const screenWidth = window.screen.width || 0;
  const screenHeight = window.screen.height || 0;
  const timezoneOffset = new Date().getTimezoneOffset();

  // Combine various browser properties
  const fingerprint = `${userAgent}|${language}|${platform}|${screenWidth}x${screenHeight}|${timezoneOffset}`;

  // Simple base64 encoding (in production, use crypto.subtle for hashing)
  try {
    return btoa(fingerprint).substring(0, 64);
  } catch {
    // Fallback if btoa is not available
    return fingerprint.substring(0, 64);
  }
}

