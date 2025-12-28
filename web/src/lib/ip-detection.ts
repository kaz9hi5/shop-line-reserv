/**
 * Get client IP address using external API service
 * Uses ipify.org as the primary service
 */
export async function getClientIp(): Promise<string> {
  try {
    // Primary service: ipify.org
    const response = await fetch("https://api.ipify.org?format=json", {
      method: "GET",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch IP: ${response.statusText}`);
    }

    const data = await response.json();
    return data.ip;
  } catch (error) {
    // Fallback to alternative service
    try {
      const fallbackResponse = await fetch("https://api64.ipify.org?format=json", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      if (!fallbackResponse.ok) {
        throw new Error(`Fallback service also failed: ${fallbackResponse.statusText}`);
      }

      const fallbackData = await fallbackResponse.json();
      return fallbackData.ip;
    } catch (fallbackError) {
      throw new Error(
        `Failed to detect IP address: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

