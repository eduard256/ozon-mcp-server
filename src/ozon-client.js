import { chromium } from 'playwright';

/**
 * Ozon API Client
 * Uses Playwright for browser automation to bypass antibot protection
 *
 * Key approach: Create fresh browser instance for each request batch
 * to avoid session blocking by antibot system.
 */
class OzonClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
  }

  /**
   * Create fresh browser instance
   */
  async createBrowser() {
    // Close existing if any
    await this.close();

    console.log('[Ozon Client] Creating fresh browser instance...');

    // Match Python script exactly
    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    });

    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'ru-RU'
    });

    this.page = await this.context.newPage();

    console.log('[Ozon Client] Browser created');
    return this.page;
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (e) {
        // Ignore close errors
      }
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  /**
   * Load page with antibot bypass
   */
  async loadPage(url, waitTime = 15000) {
    const page = await this.createBrowser();

    console.log(`[Ozon Client] Loading: ${url}`);

    await page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await page.waitForTimeout(waitTime);

    const title = await page.title();
    console.log(`[Ozon Client] Page title: ${title}`);

    return { page, title };
  }

  /**
   * Search products on Ozon
   */
  async search(query, options = {}) {
    const {
      sort = 'popular',
      page: pageNum = 1,
      priceMin = null,
      priceMax = null,
      limit = 20
    } = options;

    console.log(`[Ozon Client] Searching: ${query}`);

    // Build search URL
    let url = `https://www.ozon.ru/search/?text=${encodeURIComponent(query)}&from_global=true`;

    const sortMap = {
      'popular': 'score',
      'price': 'price',
      'price_desc': 'price_desc',
      'new': 'new',
      'rating': 'rating',
      'discount': 'discount'
    };

    if (sortMap[sort]) {
      url += `&sorting=${sortMap[sort]}`;
    }

    if (priceMin || priceMax) {
      const min = priceMin || 0;
      const max = priceMax || 9999999;
      url += `&currency_price=${min}.000%3B${max}.000`;
    }

    if (pageNum > 1) {
      url += `&page=${pageNum}`;
    }

    try {
      const { page, title } = await this.loadPage(url, 15000);

      // Check for captcha/block
      if (title.includes('Antibot') || title.includes('ограничен')) {
        console.log('[Ozon Client] Page blocked, returning empty results');
        await this.close();
        return [];
      }

      // Extract products
      const products = await page.evaluate((maxResults) => {
        const items = [];
        const seen = new Set();

        // Find all product links
        const links = document.querySelectorAll('a[href*="/product/"]');

        for (const link of links) {
          if (items.length >= maxResults) break;

          try {
            const href = link.getAttribute('href');
            if (!href) continue;

            // Extract product ID
            const idMatch = href.match(/-(\d+)(?:\?|\/|$)/);
            const id = idMatch ? idMatch[1] : null;
            if (!id || seen.has(id)) continue;
            seen.add(id);

            // Get parent container
            const container = link.closest('[data-index]') ||
                             link.closest('[class*="tile"]') ||
                             link.parentElement?.parentElement?.parentElement;

            if (!container) continue;

            const text = container.innerText || '';
            const lines = text.split('\n').filter(l => l.trim());

            // Find price
            let price = null;
            for (const line of lines) {
              if (line.includes('₽')) {
                const match = line.match(/(\d[\d\s]*)/);
                if (match) {
                  price = parseInt(match[1].replace(/\s/g, ''));
                  break;
                }
              }
            }

            // Find name (longer line without price symbols)
            let name = '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (trimmed &&
                  !trimmed.includes('₽') &&
                  !trimmed.match(/^-?\d+%?$/) &&
                  trimmed.length > 15 &&
                  trimmed.length < 300) {
                name = trimmed;
                break;
              }
            }

            // Get image
            const img = container.querySelector('img');
            const image = img?.src || null;

            // Get rating
            let rating = null;
            const ratingMatch = text.match(/(\d[,\.]\d)\s*[★⭐•]/);
            if (ratingMatch) {
              rating = parseFloat(ratingMatch[1].replace(',', '.'));
            }

            items.push({
              id,
              url: `https://www.ozon.ru${href.startsWith('/') ? '' : '/'}${href.split('?')[0]}`,
              name: name || `Product ${id}`,
              price,
              priceFormatted: price ? `${price.toLocaleString('ru-RU')} ₽` : null,
              image,
              rating
            });
          } catch (e) {
            // Skip problematic items
          }
        }

        return items;
      }, limit);

      console.log(`[Ozon Client] Found ${products.length} products`);
      await this.close();
      return products;

    } catch (error) {
      console.error(`[Ozon Client] Search error: ${error.message}`);
      await this.close();
      throw error;
    }
  }

  /**
   * Get product details
   */
  async getProductDetails(productIdOrUrl) {
    let url = productIdOrUrl;
    if (!productIdOrUrl.startsWith('http')) {
      url = `https://www.ozon.ru/product/${productIdOrUrl}/`;
    }

    console.log(`[Ozon Client] Getting product: ${url}`);

    try {
      // First load homepage
      const { page: homePage } = await this.loadPage('https://www.ozon.ru/', 10000);
      const homeTitle = await homePage.title();
      console.log(`[Ozon Client] Homepage: ${homeTitle}`);

      // Then navigate to product
      await homePage.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 90000
      });

      await homePage.waitForTimeout(15000);

      const productTitle = await homePage.title();
      console.log(`[Ozon Client] Product page: ${productTitle}`);

      if (productTitle.includes('Antibot') || productTitle.includes('ограничен')) {
        await this.close();
        throw new Error('Product page blocked by antibot');
      }

      // Extract product data
      const product = await homePage.evaluate(() => {
        const result = {
          title: null,
          price: null,
          oldPrice: null,
          discount: null,
          rating: null,
          reviewsCount: null,
          images: [],
          characteristics: [],
          description: null,
          seller: null,
          inStock: true
        };

        // Title
        const h1 = document.querySelector('h1');
        result.title = h1?.innerText?.trim() || null;

        // Price widget
        const priceWidget = document.querySelector('[data-widget="webPrice"]');
        if (priceWidget) {
          const priceText = priceWidget.innerText;
          const priceMatch = priceText.match(/(\d[\d\s]*)₽/);
          if (priceMatch) {
            result.price = parseInt(priceMatch[1].replace(/\s/g, ''));
          }
          const discountMatch = priceText.match(/-(\d+)%/);
          if (discountMatch) {
            result.discount = parseInt(discountMatch[1]);
          }
        }

        // Rating
        const reviewWidget = document.querySelector('[data-widget="webReviewSummary"]');
        if (reviewWidget) {
          const reviewText = reviewWidget.innerText;
          const ratingMatch = reviewText.match(/(\d[,\.]\d)/);
          if (ratingMatch) {
            result.rating = parseFloat(ratingMatch[1].replace(',', '.'));
          }
          const reviewsMatch = reviewText.match(/(\d+)\s*(отзыв|review)/i);
          if (reviewsMatch) {
            result.reviewsCount = parseInt(reviewsMatch[1]);
          }
        }

        // Images
        const imgs = document.querySelectorAll('img[src*="ozone"]');
        for (const img of imgs) {
          if (result.images.length >= 10) break;
          const src = img.src;
          if (src && !result.images.includes(src)) {
            result.images.push(src);
          }
        }

        // Description
        const descWidget = document.querySelector('[data-widget="webDescription"]');
        if (descWidget) {
          result.description = descWidget.innerText?.trim()?.substring(0, 2000) || null;
        }

        // Seller
        const sellerWidget = document.querySelector('[data-widget="webCurrentSeller"]');
        if (sellerWidget) {
          result.seller = sellerWidget.innerText?.split('\n')[0]?.trim() || null;
        }

        // Stock check
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('нет в наличии') || pageText.includes('товар закончился')) {
          result.inStock = false;
        }

        return result;
      });

      // Extract ID from URL
      const currentUrl = homePage.url();
      const idMatch = currentUrl.match(/-(\d+)/);
      product.id = idMatch ? idMatch[1] : null;
      product.url = currentUrl;

      console.log(`[Ozon Client] Got product: ${product.title}`);
      await this.close();
      return product;

    } catch (error) {
      console.error(`[Ozon Client] Product error: ${error.message}`);
      await this.close();
      throw error;
    }
  }

  /**
   * Get multiple products
   */
  async getProductsList(productIds) {
    const results = [];
    for (const id of productIds) {
      try {
        const product = await this.getProductDetails(id);
        results.push(product);
      } catch (e) {
        results.push({ id, error: e.message });
      }
    }
    return results;
  }

  /**
   * Set location (simplified - just returns success)
   */
  async setLocation(city) {
    console.log(`[Ozon Client] Set location requested: ${city}`);
    return { success: true, city, note: 'Location setting not fully implemented' };
  }

  /**
   * Get filters
   */
  async getFilters(query) {
    return {
      query,
      sortOptions: [
        { value: 'popular', name: 'По популярности' },
        { value: 'price', name: 'По цене (возрастание)' },
        { value: 'price_desc', name: 'По цене (убывание)' },
        { value: 'new', name: 'По новизне' },
        { value: 'rating', name: 'По рейтингу' },
        { value: 'discount', name: 'По скидке' }
      ],
      priceFilter: true,
      note: 'Full filter extraction not implemented'
    };
  }

  /**
   * Get categories
   */
  async getCategories() {
    try {
      const { page } = await this.loadPage('https://www.ozon.ru/', 10000);

      const categories = await page.evaluate(() => {
        const result = [];
        const seen = new Set();
        const links = document.querySelectorAll('a[href*="/category/"]');

        for (const link of links) {
          const href = link.getAttribute('href');
          const name = link.innerText?.trim();
          if (href && name && name.length > 1 && name.length < 100 && !seen.has(href)) {
            seen.add(href);
            result.push({
              name,
              url: href.startsWith('http') ? href : `https://www.ozon.ru${href}`
            });
          }
        }
        return result;
      });

      await this.close();
      return categories;

    } catch (error) {
      console.error(`[Ozon Client] Categories error: ${error.message}`);
      await this.close();
      throw error;
    }
  }
}

export default OzonClient;
