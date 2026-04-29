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
    const locked = d.top_a
