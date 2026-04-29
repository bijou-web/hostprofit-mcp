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
