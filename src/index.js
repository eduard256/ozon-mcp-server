#!/usr/bin/env node
// Ozon MCP server (stdio). Three tools: ozon_search, ozon_product_details, ozon_product_reviews.
// CRITICAL: stdout is the JSON-RPC wire — never write to it. All logs go to stderr.

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { search, details, reviews } from "./ozon.js";
import { shutdown } from "./browser.js";

const log = (...a) => console.error("[ozon-mcp]", ...a);
const TOOL_TIMEOUT_MS = 55000; // stay under typical MCP client timeout (~60s)
const MAX_TEXT = 60000; // cap JSON-RPC payload size

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/** Wrap a tool body: run with timeout, serialize result, convert any failure to isError. */
function tool(label, fn) {
  return async (args) => {
    try {
      const result = await withTimeout(fn(args), TOOL_TIMEOUT_MS, label);
      let text = JSON.stringify(result, null, 2);
      if (text.length > MAX_TEXT) text = text.slice(0, MAX_TEXT) + "\n…(truncated)";
      return { content: [{ type: "text", text }] };
    } catch (err) {
      log(`${label} error:`, err?.message);
      return {
        content: [{ type: "text", text: `Error: ${err?.message || String(err)}` }],
        isError: true,
      };
    }
  };
}

const server = new McpServer({ name: "ozon-mcp-server", version: "0.0.1" });

server.registerTool(
  "ozon_search",
  {
    title: "Search Ozon products",
    description:
      "Search products on the Ozon marketplace (ozon.ru). Returns a list of products with name, " +
      "price (RUB, numeric), old price, discount, rating, review count, brand, image and a clean " +
      "product URL. Use this to find products and compare prices, then hand the URLs to the user.",
    inputSchema: {
      query: z.string().min(1).describe('Search query, e.g. "iphone 15", "плед 150х200", "носки мужские"'),
      sort: z
        .enum(["popular", "price", "price_desc", "rating", "new", "discount"])
        .default("popular")
        .describe("Sort order: popular (default), price (cheap→expensive), price_desc, rating, new, discount"),
      priceMin: z.number().int().nonnegative().optional().describe("Minimum price in RUB"),
      priceMax: z.number().int().nonnegative().optional().describe("Maximum price in RUB"),
      limit: z.number().int().min(1).max(36).default(12).describe("Max number of results (1–36, default 12)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  tool("ozon_search", search)
);

server.registerTool(
  "ozon_product_details",
  {
    title: "Get Ozon product details",
    description:
      "Get full details for one Ozon product: name, price (card/regular/old), availability, product " +
      "rating, seller (name + rating), images, key characteristics, and the product description " +
      "(text and/or banner image URLs). Accepts an SKU, a full product URL, or a slug.",
    inputSchema: {
      product: z
        .string()
        .min(1)
        .describe('Product SKU (e.g. "1185261285"), full ozon.ru product URL, or product slug'),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  tool("ozon_product_details", details)
);

server.registerTool(
  "ozon_product_reviews",
  {
    title: "Get Ozon product reviews",
    description:
      "Read real customer reviews for an Ozon product: author, score (1–5), comment, pros, cons, " +
      "date, usefulness, whether the item was purchased, and whether photos are attached. " +
      "Accepts an SKU, a full product URL, or a slug.",
    inputSchema: {
      product: z
        .string()
        .min(1)
        .describe('Product SKU (e.g. "1185261285"), full ozon.ru product URL, or product slug'),
      limit: z.number().int().min(1).max(30).default(10).describe("Max number of reviews (1–30, default 10)"),
    },
    annotations: { readOnlyHint: true, openWorldHint: true, idempotentHint: true },
  },
  tool("ozon_product_reviews", reviews)
);

// ── lifecycle ───────────────────────────────────────────────────────────────────
let cleaning = false;
async function cleanup() {
  if (cleaning) return;
  cleaning = true;
  log("shutting down…");
  await shutdown().catch(() => {});
  process.exit(0);
}
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
process.on("uncaughtException", (e) => {
  log("uncaughtException:", e);
  cleanup();
});
process.on("unhandledRejection", (r) => log("unhandledRejection:", r));

const transport = new StdioServerTransport();
transport.onclose = cleanup; // client disconnected → free the browser
await server.connect(transport);
log("ready on stdio");
