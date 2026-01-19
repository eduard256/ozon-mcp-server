# Ozon MCP Server

MCP (Model Context Protocol) Server for Ozon marketplace. Allows AI assistants to search products, get detailed information, prices, and delivery info from Ozon.ru.

## Features

- **ozon_search** - Search products with filters (price, sorting, pagination)
- **ozon_product_details** - Get detailed product info (price, characteristics, images, rating)
- **ozon_products_list** - Get info for multiple products at once
- **ozon_set_location** - Set delivery city
- **ozon_get_filters** - Get available filters for search
- **ozon_get_categories** - Get product categories list

## How it Works

The server uses Playwright to automate a headless browser and bypass Ozon's antibot protection:

1. Maintains a persistent browser session with cookies
2. Uses "natural navigation" (homepage → target page) to avoid captcha
3. Extracts data from page DOM and embedded JSON
4. Simulates human-like behavior (mouse movements, scrolling)

## Installation

### Option 1: Direct (Node.js)

```bash
# Clone repository
git clone https://github.com/eduard256/ozon-mcp-server.git
cd ozon-mcp-server

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium
npx playwright install-deps chromium

# Start server
npm start
```

### Option 2: Docker

```bash
# Clone and build
git clone https://github.com/eduard256/ozon-mcp-server.git
cd ozon-mcp-server
docker-compose up -d
```

## Configuration

Environment variables:

- `PORT` - HTTP server port (default: 3001)

## Usage

### HTTP API

The server exposes MCP Streamable HTTP transport at `/mcp` endpoint.

**Base URL:** `http://localhost:3001`

**Endpoints:**
- `GET /` - Server info and available tools
- `GET /health` - Health check
- `POST /mcp` - MCP JSON-RPC endpoint
- `GET /mcp` - SSE stream (Accept: text/event-stream)
- `DELETE /mcp` - Terminate session

### Example: Search Products

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "ozon_search",
      "arguments": {
        "query": "iPhone 15",
        "sort": "popular",
        "limit": 10
      }
    }
  }'
```

### Example: Get Product Details

```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "ozon_product_details",
      "arguments": {
        "productId": "https://www.ozon.ru/product/smartfon-apple-iphone-15-128gb-1234567890/"
      }
    }
  }'
```

## Claude Desktop Integration

Add to your Claude Desktop config (`~/.config/claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "ozon": {
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Or for remote server:

```json
{
  "mcpServers": {
    "ozon": {
      "url": "http://YOUR_SERVER_IP:3001/mcp"
    }
  }
}
```

## Tools Reference

### ozon_search

Search for products on Ozon.

**Parameters:**
- `query` (required) - Search text
- `sort` - Sort order: `popular`, `price`, `price_desc`, `new`, `rating`, `discount`
- `page` - Page number (default: 1)
- `priceMin` - Minimum price in rubles
- `priceMax` - Maximum price in rubles
- `limit` - Max results (default: 20, max: 50)

**Returns:** Array of products with id, url, name, price, image, rating

### ozon_product_details

Get detailed product information.

**Parameters:**
- `productId` (required) - Product ID or full URL

**Returns:** Object with title, price, oldPrice, discount, rating, reviewsCount, images, characteristics, description, seller, inStock

### ozon_products_list

Get multiple products at once.

**Parameters:**
- `productIds` (required) - Array of product IDs or URLs

**Returns:** Array of product details

### ozon_set_location

Set delivery city (affects prices and availability).

**Parameters:**
- `city` (required) - City name

**Returns:** Success status

### ozon_get_filters

Get available filters for a search.

**Parameters:**
- `query` (required) - Search query or category URL

**Returns:** Available sort options and filters

### ozon_get_categories

Get list of product categories.

**Parameters:** None

**Returns:** Array of categories with name and url

## Notes

- First request may take longer (browser initialization)
- Product detail pages require natural navigation to bypass captcha
- Rate limiting: avoid too many rapid requests
- Ozon may change their antibot measures, requiring updates

## License

MIT
