import { isCronAuthorized } from "@/lib/cron-auth";
import { deliverDeveloperWebhooks } from "@/lib/developer/webhooks";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return Response.json(await deliverDeveloperWebhooks({ limit: 50 }));
  } catch (error) {
    console.error("Developer webhook cron failed", error);
    return Response.json({ error: "Webhook delivery failed" }, { status: 500 });
  }
}
