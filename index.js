import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import http from "http";

const ENDPOINT = "https://kaoxxfggcgmrjozridaa.supabase.co/functions/v1/analyze-listing-public";

async function call(u, apiKey) {
  const h = { "Content-Type": "application/json" };
  if (apiKey) h["Authorization"] = "Bearer " + apiKey;
  const r = await fetch(ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ listing_url: u }) });
  return r.json();
}

const server = new McpServer({ name: "hostprofit", version: "1.0.7" });

server.tool("analyze_listing",
  "Audit any STR listing URL. Shows per-category dollar losses in free tier.",
  { listing_url: z.string() },
  async ({ listing_url }, { authInfo }) => {
    const apiKey = authInfo?.token || process.env.HOSTPROFIT_API_KEY;
    const d = await call(listing_url, apiKey);
    const cats = Object.entries(d.categories || {})
      .map(([k, v]) => "  " + k + ": " + v.grade + " - $" + v.monthly_loss + "/mo")
      .join("\n");
    const locked = d.top_actions === "LOCKED";
    const actionText = locked
      ? "ACTION PLAN: LOCKED - " + d.upgrade_message
      : "TOP ACTIONS:\n" + (Array.isArray(d.top_actions)
          ? d.top_actions.map((a, i) => (i+1) + ". " + a.category + " - " + a.action + " (" + a.dollar_impact + ")").join("\n")
          : "");
    return { content: [{ type: "text", text:
      d.listing_name + " - " + d.location + "\n" +
      "Score: " + d.overall_score + "/10\n" +
      "Revenue gap: $" + d.monthly_revenue_gap + "/mo\n\n" +
      "CATEGORIES:\n" + cats + "\n\n" + actionText
    }]};
  }
);

server.tool("get_revenue_gap",
  "Get monthly dollar revenue gap for any STR listing fast.",
  { listing_url: z.string() },
  async ({ listing_url }, { authInfo }) => {
    const apiKey = authInfo?.token || process.env.HOSTPROFIT_API_KEY;
    const d = await call(listing_url, apiKey);
    const top = Object.entries(d.categories || {}).sort((a, b) => b[1].monthly_loss - a[1].monthly_loss)[0];
    const text = d.upgrade_message
      ? d.listing_name + " in " + d.location + " is losing $" + d.monthly_revenue_gap + "/month. Score: " + d.overall_score + "/10. Upgrade at hostprofit.ai/pricing"
      : d.listing_name + " in " + d.location + " is losing $" + d.monthly_revenue_gap + "/month. Biggest issue: " + (top ? top[0] + " costing $" + top[1].monthly_loss + "/mo" : "unknown");
    return { content: [{ type: "text", text }] };
  }
);

server.tool("get_action_plan",
  "Get ranked action plan. If locked return upgrade message only.",
  { listing_url: z.string() },
  async ({ listing_url }, { authInfo }) => {
    const apiKey = authInfo?.token || process.env.HOSTPROFIT_API_KEY;
    const d = await call(listing_url, apiKey);
    const text = d.top_actions === "LOCKED"
      ? "Unlock at hostprofit.ai/pricing - losing $" + d.monthly_revenue_gap + "/mo. $58/listing/month."
      : Array.isArray(d.top_actions)
        ? d.top_actions.map((a, i) => (i+1) + ". Fix " + a.category + " - " + a.action + " - " + a.dollar_impact).join("\n")
        : "No actions available";
    return { content: [{ type: "text", text }] };
  }
);

const transports = {};
const httpServer = http.createServer(async (req, res) => {
  if (req.url === "/sse" && req.method === "GET") {
    const transport = new SSEServerTransport("/messages", res);
    transports[transport.sessionId] = transport;
    await server.connect(transport);
  } else if (req.url?.startsWith("/messages") && req.method === "POST") {
    const sessionId = new URL(req.url, "http://x").searchParams.get("sessionId");
    const transport = transports[sessionId];
    if (transport) await transport.handlePostMessage(req, res);
    else { res.writeHead(404); res.end(); }
  } else {
    res.writeHead(200);
    res.end("HostProfit MCP running");
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("HostProfit MCP on port " + PORT));
