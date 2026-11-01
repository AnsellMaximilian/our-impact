const targetUrl = process.env.DEVELOPER_WEBHOOK_URL;
const cronSecret = process.env.CRON_SECRET;

if (!targetUrl || !cronSecret) {
  console.error("DEVELOPER_WEBHOOK_URL and CRON_SECRET are required.");
  process.exitCode = 1;
} else {
  try {
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "https:") throw new Error("DEVELOPER_WEBHOOK_URL must use HTTPS.");
    const response = await fetch(parsedUrl, {
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(55_000),
    });
    const payload = await response.json().catch(() => ({ error: "Non-JSON response." }));
    if (!response.ok) {
      console.error("Developer webhook delivery failed", { httpStatus: response.status, payload });
      process.exitCode = 1;
    } else {
      console.log("Developer webhook delivery finished", payload);
    }
  } catch (error) {
    console.error("Developer webhook scheduler could not reach the app", error instanceof Error ? error.message : "unknown_error");
    process.exitCode = 1;
  }
}
