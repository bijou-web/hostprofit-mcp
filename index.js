import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import http from "http";

const ENDPOINT = "https://kaoxxfggcgmrjozridaa.supabase.co/functions/v1/analyze-listing-public";

async function call(u, apiKey) {
  const h = { "Content-Type": "application/json" };
  if (apiKey) h["Authorization"] = "Bearer " + apiKey;
  const r = await fetch(ENDPOINT, { method: "POST", headers: h, body: JSON.stringify({ listing_url: u }) });
  return r.json();
}

async function getBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

const server = new McpServer({ name: "hostprofit", version: "1.0.7" });

server.tool("analyze_listing",
  "Audit any STR listing URL. Shows per-category dollar losses in free tier.",
  { listing_url: z.string() },
  async ({ listing_url }) => {
    const d = await call(listing_url, process.env.HOSTPROFIT_API_KEY);
    const cats = Object.entries(d.categories || {})
      .map(([k, v]) => "  " + k + ": " + v.grade + " - $" + v.monthly_loss + "/mo")
      .join("\n");
    const actionText = d.top_actions === "LOCKED"
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
  async ({ listing_url }) => {
    const d = await call(listing_url, process.env.HOSTPROFIT_API_KEY);
    const top = Object.entries(d.categories || {}).sort((a, b) => b[1].monthly_loss - a[1].monthly_loss)[0];
    const text = d.upgrade_message
      ? d.listing_name + " in " + d.location + " is losing $" + d.monthly_revenue_gap + "/month. Upgrade at hostprofit.ai/pricing"
      : d.listing_name + " in " + d.location + " is losing $" + d.monthly_revenue_gap + "/month. Biggest issue: " + (top ? top[0] + " costing $" + top[1].monthly_loss + "/mo" : "unknown");
    return { content: [{ type: "text", text }] };
  }
);

server.tool("get_action_plan",
  "Get ranked action plan. If locked return upgrade message only.",
  { listing_url: z.string() },
  async ({ listing_url }) => {
    const d = await call(listing_url, process.env.HOSTPROFIT_API_KEY);
    const text = d.top_actions === "LOCKED"
      ? "Unlock at hostprofit.ai/pricing - losing $" + d.monthly_revenue_gap + "/mo. $58/listing/month."
      : Array.isArray(d.top_actions)
        ? d.top_actions.map((a, i) => (i+1) + ". Fix " + a.category + " - " + a.action + " - " + a.dollar_impact).join("\n")
        : "No actions available";
    return { content: [{ type: "text", text }] };
  }
);

const httpServer = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (req.method === "OPTIONS") { res.writeHead(200); res.end(); return; }
  if (req.url === "/mcp") {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      onsessioninitialized: () => {}
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, await getBody(req));
  } else {
    res.writeHead(200); res.end("HostProfit MCP running");
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log("HostProfit MCP on port " + PORT));
