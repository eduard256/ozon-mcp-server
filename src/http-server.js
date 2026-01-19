import express from 'express';
import OzonClient from './ozon-client.js';

/**
 * HTTP Server for Ozon MCP
 * Provides Streamable HTTP transport for remote MCP connections
 */

const app = express();
app.use(express.json());

// Initialize Ozon Client
const ozonClient = new OzonClient();

// Session storage
const sessions = new Map();

// CORS headers for cross-origin requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Accept, Mcp-Session-Id');
  res.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Generate session ID
function generateSessionId() {
  return 'mcp-' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// Tool definitions
const TOOLS = [
  {
    name: 'ozon_search',
    description: 'Search for products on Ozon marketplace. Returns list of products with prices, ratings, and links.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "iPhone 15", "ноутбук ASUS")'
        },
        sort: {
          type: 'string',
          enum: ['popular', 'price', 'price_desc', 'new', 'rating', 'discount'],
          description: 'Sort order: popular (default), price (ascending), price_desc (descending), new, rating, discount'
        },
        page: {
          type: 'number',
          description: 'Page number (default: 1)'
        },
        priceMin: {
          type: 'number',
          description: 'Minimum price in rubles'
        },
        priceMax: {
          type: 'number',
          description: 'Maximum price in rubles'
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20, max: 50)'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'ozon_product_details',
    description: 'Get detailed information about a specific product by its ID or URL. Returns full description, characteristics, prices, images, rating and reviews.',
    inputSchema: {
      type: 'object',
      properties: {
        productId: {
          type: 'string',
          description: 'Product ID (number) or full URL from Ozon'
        }
      },
      required: ['productId']
    }
  },
  {
    name: 'ozon_products_list',
    description: 'Get information about multiple products by their IDs or URLs. Useful for comparing products.',
    inputSchema: {
      type: 'object',
      properties: {
        productIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of product IDs or URLs to fetch'
        }
      },
      required: ['productIds']
    }
  },
  {
    name: 'ozon_set_location',
    description: 'Set delivery location city. This affects delivery times and available stock in search results.',
    inputSchema: {
      type: 'object',
      properties: {
        city: {
          type: 'string',
          description: 'City name for delivery (e.g., "Москва", "Санкт-Петербург", "Новосибирск")'
        }
      },
      required: ['city']
    }
  },
  {
    name: 'ozon_get_filters',
    description: 'Get available filters and sort options for a search query or category.',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query or category URL to get filters for'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'ozon_get_categories',
    description: 'Get list of available product categories on Ozon.',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  }
];

// Handle JSON-RPC request
async function handleJsonRpcRequest(request) {
  const { method, params, id } = request;

  try {
    switch (method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2025-03-26',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'ozon-mcp-server',
              version: '1.0.0'
            }
          }
        };

      case 'tools/list':
        return {
          jsonrpc: '2.0',
          id,
          result: { tools: TOOLS }
        };

      case 'tools/call':
        const { name, arguments: args } = params;
        let result;

        switch (name) {
          case 'ozon_search':
            result = await ozonClient.search(args.query, {
              sort: args.sort || 'popular',
              page: args.page || 1,
              priceMin: args.priceMin,
              priceMax: args.priceMax,
              limit: Math.min(args.limit || 20, 50)
            });
            break;

          case 'ozon_product_details':
            result = await ozonClient.getProductDetails(args.productId);
            break;

          case 'ozon_products_list':
            result = await ozonClient.getProductsList(args.productIds);
            break;

          case 'ozon_set_location':
            result = await ozonClient.setLocation(args.city);
            break;

          case 'ozon_get_filters':
            result = await ozonClient.getFilters(args.query);
            break;

          case 'ozon_get_categories':
            result = await ozonClient.getCategories();
            break;

          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
          }
        };

      case 'notifications/initialized':
        // Client notification, no response needed
        return null;

      default:
        return {
          jsonrpc: '2.0',
          id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`
          }
        };
    }
  } catch (error) {
    console.error(`[HTTP] Error handling ${method}:`, error.message);
    return {
      jsonrpc: '2.0',
      id,
      error: {
        code: -32603,
        message: error.message
      }
    };
  }
}

// MCP Endpoint - POST (Streamable HTTP)
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  console.log(`[HTTP] POST /mcp - Session: ${sessionId || 'new'}`);
  console.log(`[HTTP] Request body:`, JSON.stringify(req.body).substring(0, 200));

  // Handle batch or single request
  const requests = Array.isArray(req.body) ? req.body : [req.body];
  const responses = [];

  for (const request of requests) {
    const response = await handleJsonRpcRequest(request);
    if (response) {
      responses.push(response);
    }
  }

  // Set session ID on initialize
  if (requests.some(r => r.method === 'initialize') && !sessionId) {
    const newSessionId = generateSessionId();
    sessions.set(newSessionId, { created: Date.now() });
    res.set('Mcp-Session-Id', newSessionId);
  }

  // Return response
  if (responses.length === 0) {
    res.status(202).send();
  } else if (responses.length === 1) {
    res.json(responses[0]);
  } else {
    res.json(responses);
  }
});

// MCP Endpoint - GET (SSE stream for server-initiated messages)
app.get('/mcp', (req, res) => {
  const accept = req.headers['accept'] || '';

  if (!accept.includes('text/event-stream')) {
    return res.status(406).json({ error: 'Accept header must include text/event-stream' });
  }

  console.log('[HTTP] GET /mcp - Opening SSE stream');

  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });

  // Send keepalive
  const keepalive = setInterval(() => {
    res.write(': keepalive\n\n');
  }, 30000);

  req.on('close', () => {
    clearInterval(keepalive);
    console.log('[HTTP] SSE stream closed');
  });
});

// MCP Endpoint - DELETE (terminate session)
app.delete('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'];

  if (sessionId && sessions.has(sessionId)) {
    sessions.delete(sessionId);
    console.log(`[HTTP] Session ${sessionId} terminated`);
    res.status(200).json({ success: true });
  } else {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'ozon-mcp-server',
    version: '1.0.0',
    sessions: sessions.size
  });
});

// API info endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Ozon MCP Server',
    version: '1.0.0',
    description: 'MCP Server for Ozon marketplace - search products, get details, prices and delivery info',
    endpoints: {
      '/mcp': 'MCP Streamable HTTP endpoint (POST/GET/DELETE)',
      '/health': 'Health check'
    },
    tools: TOOLS.map(t => ({ name: t.name, description: t.description }))
  });
});

// Start server
const PORT = process.env.PORT || 3001;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[HTTP Server] Ozon MCP Server running on http://0.0.0.0:${PORT}`);
  console.log(`[HTTP Server] MCP endpoint: http://0.0.0.0:${PORT}/mcp`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('[HTTP Server] Shutting down...');
  await ozonClient.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('[HTTP Server] Shutting down...');
  await ozonClient.close();
  process.exit(0);
});
