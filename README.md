# HostProfit MCP

Audit any Airbnb/VRBO/STR listing for dollar-denominated revenue gaps.

## Tools
- `analyze_listing` — Full audit with category grades and revenue gap
- `get_revenue_gap` — Quick monthly dollar loss for any listing
- `get_action_plan` — Ranked fix list (Pro tier)

## Setup

Get your API key at [hostprofit.ai](https://hostprofit.ai)

Add to your Claude/Cursor/Windsurf MCP config:

```json
{
  "mcpServers": {
    "hostprofit": {
      "command": "npx",
      "args": ["-y", "hostprofit-mcp"],
      "env": {
        "HOSTPROFIT_API_KEY": "your_key_here"
      }
    }
  }
}
```

## Pricing
Free tier: revenue gap + category grades
Pro ($58/mo): full action plan — hostprofit.ai/pricing
