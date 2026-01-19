import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import OzonClient from './ozon-client.js';

// Initialize Ozon Client
const ozonClient = new OzonClient();

// Create MCP Server
const server = new Server(
  {
    name: 'ozon-mcp-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// Define available tools
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

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
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
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: error.message
          }, null, 2)
        }
      ],
      isError: true
    };
  }
});

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.error('[MCP Server] Shutting down...');
  await ozonClient.close();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('[MCP Server] Shutting down...');
  await ozonClient.close();
  process.exit(0);
});

// Start server
async function main() {
  console.error('[MCP Server] Starting Ozon MCP Server...');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[MCP Server] Server started and listening on stdio');
}

main().catch((error) => {
  console.error('[MCP Server] Fatal error:', error);
  process.exit(1);
});
