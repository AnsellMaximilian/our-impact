const targetUrl = process.env.RECONCILIATION_URL;
const cronSecret = process.env.CRON_SECRET;

if (!targetUrl || !cronSecret) {
  console.error("RECONCILIATION_URL and CRON_SECRET are required.");
  process.exitCode = 1;
} else {
  try {
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "https:") {
      throw new Error("RECONCILIATION_URL must use HTTPS.");
    }

    const response = await fetch(parsedUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(55_000),
    });
    const payload = await response.json().catch(() => ({
      error: "The reconciliation endpoint returned a non-JSON response.",
    }));

    if (!response.ok) {
      console.error("PayPal reconciliation request failed", {
        httpStatus: response.status,
        payload,
      });
      process.exitCode = 1;
    } else {
      console.log("PayPal reconciliation finished", payload);
    }
  } catch (error) {
    console.error(
      "PayPal reconciliation could not reach the application",
      error instanceof Error ? error.message : "unknown_error",
    );
    process.exitCode = 1;
  }
}
