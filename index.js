startCommand:
  type: stdio
  configSchema:
    type: object
    properties:
      apiKey:
        type: string
        description: Your HostProfit API key from hostprofit.ai
    required: []
  commandFunction: |-
    (config) => ({
      command: "npx",
      args: ["-y", "hostprofit-mcp"],
      env: {
        HOSTPROFIT_API_KEY: config.apiKey || ""
      }
    })
