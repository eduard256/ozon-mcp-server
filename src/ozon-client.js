import { chromium } from 'playwright';

/**
 * Ozon API Client
 * Uses Playwright for browser automation to bypass antibot protection
 *
 * Key features:
 * - Natural navigation (homepage -> target page) to bypass captcha
 * - Persistent browser session for faster subsequent requests
 * - Extracts data from DOM and JSON embedded in pages
 */
class OzonClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.isInitialized = false;
    this.lastHomepageVisit = 0;
    this.homepageVisitInterval = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Initialize browser instance
   */
  async init() {
    if (this.isInitialized) return;

    console.log('[Ozon Client] Initializing browser...');

    this.browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--disable-web-security'
      ]
    });

    this.context = await this.browser.newContext({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'ru-RU',
      timezoneId: 'Europe/Moscow'
    });

    this.page = await this.context.newPage();

    // Remove webdriver detection
    await this.page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
      delete navigator.__proto__.webdriver;
    });

    // Load homepage to get cookies and bypass initial protection
    await this.visitHomepage();

    this.isInitialized = true;
    console.log('[Ozon Client] Initialized successfully');
  }

  /**
   * Visit homepage to refresh cookies (needed for antibot bypass)
   */
  async visitHomepage(force = false) {
    const now = Date.now();
    if (!force && now - this.lastHomepageVisit < this.homepageVisitInterval && this.lastHomepageVisit > 0) {
      return; // Skip if visited recently
    }

    console.log('[Ozon Client] Visiting homepage for antibot bypass...');

    await this.page.goto('https://www.ozon.ru/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    // Wait longer and simulate human behavior
    await this.page.waitForTimeout(8000);
    await this.simulateHumanBehavior();
    await this.page.waitForTimeout(3000);

    this.lastHomepageVisit = now;

    const title = await this.page.title();
    console.log(`[Ozon Client] Homepage visited (title: ${title}), cookies refreshed`);
  }

  /**
   * Close browser instance
   */
  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
      this.page = null;
      this.isInitialized = false;
      console.log('[Ozon Client] Browser closed');
    }
  }

  /**
   * Simulate human-like behavior
   */
  async simulateHumanBehavior() {
    // Random mouse movements
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(Math.random() * 1700) + 100;
      const y = Math.floor(Math.random() * 800) + 100;
      await this.page.mouse.move(x, y);
      await this.page.waitForTimeout(Math.random() * 300 + 100);
    }

    // Small scroll
    await this.page.mouse.wheel(0, Math.floor(Math.random() * 300) + 100);
    await this.page.waitForTimeout(500);
  }

  /**
   * Check if page has captcha
   */
  async hasCaptcha() {
    const title = await this.page.title();
    return title.includes('Antibot') || title.includes('Captcha') || title.includes('ограничен');
  }

  /**
   * Search products on Ozon
   * @param {string} query - Search query
   * @param {Object} options - Search options
   */
  async search(query, options = {}) {
    await this.init();

    const {
      sort = 'popular', // popular, price, price_desc, new, rating, discount
      page = 1,
      priceMin = null,
      priceMax = null,
      limit = 20
    } = options;

    console.log(`[Ozon Client] Searching: ${query}`);

    // Build search URL
    let url = `https://www.ozon.ru/search/?text=${encodeURIComponent(query)}&from_global=true`;

    // Add sorting
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

    // Add price filter
    if (priceMin || priceMax) {
      const min = priceMin || 0;
      const max = priceMax || 9999999;
      url += `&currency_price=${min}.000%3B${max}.000`;
    }

    // Add page
    if (page > 1) {
      url += `&page=${page}`;
    }

    // First visit homepage to establish session
    await this.visitHomepage();

    console.log(`[Ozon Client] Navigating to search: ${url}`);

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await this.page.waitForTimeout(12000);
    await this.simulateHumanBehavior();
    await this.page.waitForTimeout(3000);

    // Check for captcha
    if (await this.hasCaptcha()) {
      console.log('[Ozon Client] Captcha detected, trying to bypass with fresh session...');
      // Force new homepage visit
      this.lastHomepageVisit = 0;
      await this.visitHomepage(true);
      await this.page.waitForTimeout(5000);
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await this.page.waitForTimeout(15000);
      await this.simulateHumanBehavior();
    }

    const pageTitle = await this.page.title();
    console.log(`[Ozon Client] Search page title: ${pageTitle}`);

    // Extract products from page
    const products = await this.page.evaluate((maxResults) => {
      const items = [];

      // Try to find product cards using various selectors
      const selectors = [
        '[data-widget="searchResultsV2"] [data-index]',
        '.widget-search-result-container [data-index]',
        '.k0a_27 a', // product links
        '[class*="tile-root"]',
        'a[href*="/product/"]'
      ];

      let cards = [];
      for (const selector of selectors) {
        cards = document.querySelectorAll(selector);
        if (cards.length > 0) break;
      }

      // Extract from found cards
      const seen = new Set();

      for (const card of cards) {
        if (items.length >= maxResults) break;

        try {
          // Find product link
          const link = card.tagName === 'A' ? card : card.querySelector('a[href*="/product/"]');
          if (!link) continue;

          const href = link.getAttribute('href');
          if (!href || !href.includes('/product/')) continue;

          // Extract product ID from URL
          const idMatch = href.match(/\/product\/[^\/]+-(\d+)/);
          const id = idMatch ? idMatch[1] : null;

          if (!id || seen.has(id)) continue;
          seen.add(id);

          // Find parent container for this product
          let container = link.closest('[data-index]') || link.closest('[class*="tile"]') || link.parentElement?.parentElement;

          // Extract text content
          const text = container ? container.innerText : link.innerText;
          const lines = text.split('\n').filter(l => l.trim());

          // Try to extract price (usually contains ₽)
          let price = null;
          let priceText = '';
          for (const line of lines) {
            if (line.includes('₽')) {
              priceText = line;
              const match = line.match(/(\d[\d\s]*)/);
              if (match) {
                price = parseInt(match[1].replace(/\s/g, ''));
              }
              break;
            }
          }

          // Try to find name (usually first non-empty, non-badge line)
          let name = '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed &&
                !trimmed.includes('₽') &&
                !trimmed.match(/^\d+%?$/) &&
                !trimmed.match(/^-\d+%$/) &&
                trimmed.length > 10) {
              name = trimmed;
              break;
            }
          }

          // Find image
          const img = container?.querySelector('img') || link.querySelector('img');
          const image = img?.src;

          // Find rating
          let rating = null;
          const ratingMatch = text.match(/(\d[,\.]\d)\s*[★⭐]/);
          if (ratingMatch) {
            rating = parseFloat(ratingMatch[1].replace(',', '.'));
          }

          items.push({
            id,
            url: `https://www.ozon.ru${href.startsWith('/') ? href : '/' + href}`,
            name: name || 'Unknown',
            price,
            priceFormatted: price ? `${price.toLocaleString('ru-RU')} ₽` : priceText || null,
            image: image || null,
            rating
          });
        } catch (e) {
          // Skip problematic cards
        }
      }

      return items;
    }, limit);

    console.log(`[Ozon Client] Found ${products.length} products`);
    return products;
  }

  /**
   * Get product details by URL or ID
   * @param {string} productIdOrUrl - Product ID or full URL
   */
  async getProductDetails(productIdOrUrl) {
    await this.init();

    // Build URL if only ID provided
    let url = productIdOrUrl;
    if (!productIdOrUrl.startsWith('http')) {
      url = `https://www.ozon.ru/product/${productIdOrUrl}/`;
    }

    console.log(`[Ozon Client] Getting product details: ${url}`);

    // Use natural navigation to bypass captcha
    await this.visitHomepage();

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await this.page.waitForTimeout(15000);
    await this.simulateHumanBehavior();

    // Check for captcha
    if (await this.hasCaptcha()) {
      console.log('[Ozon Client] Captcha on product page, retrying...');
      await this.page.waitForTimeout(5000);
      await this.visitHomepage();
      await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
      await this.page.waitForTimeout(15000);

      if (await this.hasCaptcha()) {
        throw new Error('Unable to bypass captcha for product page');
      }
    }

    const currentUrl = this.page.url();
    const title = await this.page.title();

    // Extract product data
    const product = await this.page.evaluate(() => {
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

      // Title from h1
      const h1 = document.querySelector('h1');
      result.title = h1?.innerText?.trim() || null;

      // Price from webPrice widget
      const priceWidget = document.querySelector('[data-widget="webPrice"]');
      if (priceWidget) {
        const priceText = priceWidget.innerText;

        // Current price (first number with ₽)
        const priceMatch = priceText.match(/(\d[\d\s]*)₽/);
        if (priceMatch) {
          result.price = parseInt(priceMatch[1].replace(/\s/g, ''));
        }

        // Old price (crossed out)
        const oldPriceMatch = priceText.match(/(\d[\d\s]*)₽.*?(\d[\d\s]*)₽/);
        if (oldPriceMatch) {
          result.oldPrice = parseInt(oldPriceMatch[2].replace(/\s/g, ''));
        }

        // Discount
        const discountMatch = priceText.match(/-(\d+)%/);
        if (discountMatch) {
          result.discount = parseInt(discountMatch[1]);
        }
      }

      // Rating from webReviewSummary
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
      const images = document.querySelectorAll('img[loading="eager"]');
      for (const img of images) {
        const src = img.src;
        if (src && src.includes('ozone') && !result.images.includes(src)) {
          result.images.push(src);
          if (result.images.length >= 10) break;
        }
      }

      // Characteristics from webCharacteristics
      const charsWidget = document.querySelector('[data-widget="webCharacteristics"]');
      if (charsWidget) {
        const rows = charsWidget.querySelectorAll('dl, tr, [class*="characteristic"]');
        for (const row of rows) {
          const text = row.innerText;
          const parts = text.split(/[\t\n:]/);
          if (parts.length >= 2) {
            result.characteristics.push({
              name: parts[0].trim(),
              value: parts.slice(1).join(' ').trim()
            });
          }
        }
      }

      // Description from webDescription
      const descWidget = document.querySelector('[data-widget="webDescription"]');
      if (descWidget) {
        result.description = descWidget.innerText?.trim()?.substring(0, 2000) || null;
      }

      // Seller info
      const sellerWidget = document.querySelector('[data-widget="webCurrentSeller"]');
      if (sellerWidget) {
        result.seller = sellerWidget.innerText?.split('\n')[0]?.trim() || null;
      }

      // Check stock
      const pageText = document.body.innerText.toLowerCase();
      if (pageText.includes('нет в наличии') || pageText.includes('товар закончился')) {
        result.inStock = false;
      }

      return result;
    });

    // Extract ID from URL
    const idMatch = currentUrl.match(/-(\d+)/);
    product.id = idMatch ? idMatch[1] : null;
    product.url = currentUrl;

    // Fix title if it shows error page
    if (product.title === 'Доступ ограничен' || !product.title) {
      throw new Error('Failed to load product page (access restricted)');
    }

    console.log(`[Ozon Client] Got product: ${product.title}`);
    return product;
  }

  /**
   * Get multiple products by IDs
   * @param {Array<string>} productIds - Array of product IDs or URLs
   */
  async getProductsList(productIds) {
    const results = [];

    for (const id of productIds) {
      try {
        const product = await this.getProductDetails(id);
        results.push(product);
      } catch (e) {
        console.error(`[Ozon Client] Failed to get product ${id}: ${e.message}`);
        results.push({ id, error: e.message });
      }

      // Small delay between requests
      await this.page.waitForTimeout(2000);
    }

    return results;
  }

  /**
   * Set delivery location
   * @param {string} city - City name
   */
  async setLocation(city) {
    await this.init();

    console.log(`[Ozon Client] Setting location to: ${city}`);

    // Go to homepage
    await this.page.goto('https://www.ozon.ru/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await this.page.waitForTimeout(5000);

    // Try to click location selector and change city
    try {
      // Click on location button (usually in header)
      const locationBtn = await this.page.$('[data-widget="addressButton"], [class*="location"], button:has-text("город")');
      if (locationBtn) {
        await locationBtn.click();
        await this.page.waitForTimeout(2000);

        // Type city in search input
        const input = await this.page.$('input[placeholder*="город"], input[placeholder*="адрес"], input[type="text"]');
        if (input) {
          await input.fill(city);
          await this.page.waitForTimeout(2000);

          // Click first suggestion
          const suggestion = await this.page.$('[class*="suggestion"], [class*="address-item"]');
          if (suggestion) {
            await suggestion.click();
            await this.page.waitForTimeout(3000);

            console.log(`[Ozon Client] Location set to: ${city}`);
            return { success: true, city };
          }
        }
      }
    } catch (e) {
      console.error(`[Ozon Client] Failed to set location: ${e.message}`);
    }

    return { success: false, error: 'Could not change location via UI' };
  }

  /**
   * Get available filters for a category/search
   * @param {string} query - Search query or category URL
   */
  async getFilters(query) {
    await this.init();

    const url = query.startsWith('http')
      ? query
      : `https://www.ozon.ru/search/?text=${encodeURIComponent(query)}`;

    console.log(`[Ozon Client] Getting filters for: ${url}`);

    await this.page.goto(url, {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await this.page.waitForTimeout(10000);

    // Extract available filters
    const filters = await this.page.evaluate(() => {
      const result = {
        sortOptions: [
          { value: 'popular', name: 'По популярности' },
          { value: 'price', name: 'По цене (возрастание)' },
          { value: 'price_desc', name: 'По цене (убывание)' },
          { value: 'new', name: 'По новизне' },
          { value: 'rating', name: 'По рейтингу' },
          { value: 'discount', name: 'По скидке' }
        ],
        priceFilter: true,
        availableFilters: []
      };

      // Find filter buttons/sections
      const filterElements = document.querySelectorAll('[data-widget*="filter"], [class*="filter"]');
      for (const el of filterElements) {
        const text = el.innerText?.trim();
        if (text && text.length < 50) {
          result.availableFilters.push(text);
        }
      }

      return result;
    });

    return {
      query,
      url,
      ...filters
    };
  }

  /**
   * Get category tree
   */
  async getCategories() {
    await this.init();

    console.log('[Ozon Client] Getting categories...');

    await this.page.goto('https://www.ozon.ru/', {
      waitUntil: 'domcontentloaded',
      timeout: 90000
    });

    await this.page.waitForTimeout(5000);

    // Try to open menu and get categories
    const categories = await this.page.evaluate(() => {
      const result = [];

      // Find category links
      const links = document.querySelectorAll('a[href*="/category/"]');
      const seen = new Set();

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

    console.log(`[Ozon Client] Found ${categories.length} categories`);
    return categories;
  }
}

export default OzonClient;
