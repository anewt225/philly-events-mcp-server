import axios, { AxiosInstance } from 'axios';
import * as cheerio from 'cheerio';
import { 
  PhillyEvent, 
  EventSource, 
  EventCategory, 
  EventSearchParams,
  CATEGORY_KEYWORDS,
  PHILLY_NEIGHBORHOODS
} from '../types.js';
import { 
  EVENT_SOURCES, 
  USER_AGENT, 
  REQUEST_TIMEOUT,
  RETRY_CONFIG 
} from '../constants.js';

/**
 * Base HTTP client with retry logic and rate limiting
 */
export function createHttpClient(): AxiosInstance {
  const client = axios.create({
    timeout: REQUEST_TIMEOUT,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    }
  });

  return client;
}

/**
 * Retry wrapper for HTTP requests
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      if (attempt < retries) {
        const delay = Math.min(
          RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
          RETRY_CONFIG.maxDelay
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * Classify event into categories based on title and description
 */
export function classifyEvent(title: string, description: string): EventCategory[] {
  const text = `${title} ${description}`.toLowerCase();
  const categories: EventCategory[] = [];
  
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(keyword => text.includes(keyword.toLowerCase()))) {
      categories.push(category as EventCategory);
    }
  }
  
  return categories.length > 0 ? categories : ['other'];
}

/**
 * Extract neighborhood from location string
 */
export function extractNeighborhood(locationText: string): string | undefined {
  const text = locationText.toLowerCase();
  
  for (const neighborhood of PHILLY_NEIGHBORHOODS) {
    if (text.includes(neighborhood.toLowerCase())) {
      return neighborhood;
    }
  }
  
  return undefined;
}

/**
 * Parse price from various text formats
 */
export function parsePrice(priceText: string): { min?: number; max?: number; isFree: boolean } {
  const text = priceText.toLowerCase().trim();
  
  if (text.includes('free') || text === '' || text === '$0') {
    return { isFree: true };
  }
  
  // Match patterns like "$10", "$10-$20", "$10 - $20", "from $10"
  const rangeMatch = text.match(/\$(\d+(?:\.\d{2})?)\s*(?:-|to)\s*\$(\d+(?:\.\d{2})?)/);
  if (rangeMatch) {
    return {
      min: parseFloat(rangeMatch[1]),
      max: parseFloat(rangeMatch[2]),
      isFree: false
    };
  }
  
  const singleMatch = text.match(/\$(\d+(?:\.\d{2})?)/);
  if (singleMatch) {
    return {
      min: parseFloat(singleMatch[1]),
      isFree: false
    };
  }
  
  return { isFree: false };
}

/**
 * Generate a unique ID for an event
 */
export function generateEventId(source: EventSource, title: string, date: string): string {
  const hash = Buffer.from(`${source}-${title}-${date}`).toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 16);
  return `${source}_${hash}`;
}

/**
 * Parse date string into ISO 8601 format
 */
export function parseEventDate(dateText: string): string {
  // Try to parse various date formats
  const cleaned = dateText.trim();
  
  // Already in ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(cleaned)) {
    return cleaned;
  }
  
  // Try native Date parsing
  const date = new Date(cleaned);
  if (!isNaN(date.getTime())) {
    return date.toISOString();
  }
  
  // Return current date as fallback
  return new Date().toISOString();
}

/**
 * Scrape events from Do215
 */
export async function scrapeDo215(params: EventSearchParams = {}): Promise<PhillyEvent[]> {
  const client = createHttpClient();
  const events: PhillyEvent[] = [];
  
  try {
    const url = `${EVENT_SOURCES.do215.baseUrl}${EVENT_SOURCES.do215.eventsPath}`;
    const response = await withRetry(() => client.get(url));
    const $ = cheerio.load(response.data);
    
    // Do215 event card structure (adapt based on actual HTML)
    $('.event-card, .event-item, [data-event]').each((_, element) => {
      try {
        const $el = $(element);
        const title = $el.find('.event-title, h3, .title').first().text().trim();
        const description = $el.find('.event-description, .description, p').first().text().trim();
        const dateText = $el.find('.event-date, .date, time').first().text().trim();
        const locationName = $el.find('.event-venue, .venue, .location').first().text().trim();
        const eventUrl = $el.find('a').first().attr('href') || '';
        const imageUrl = $el.find('img').first().attr('src');
        const priceText = $el.find('.price, .event-price').first().text().trim();
        
        if (title) {
          const event: PhillyEvent = {
            id: generateEventId('do215', title, dateText),
            title,
            description: description || 'No description available',
            startDate: parseEventDate(dateText),
            location: {
              name: locationName || 'Philadelphia',
              neighborhood: extractNeighborhood(locationName)
            },
            category: classifyEvent(title, description),
            price: {
              ...parsePrice(priceText),
              currency: 'USD'
            },
            url: eventUrl.startsWith('http') ? eventUrl : `${EVENT_SOURCES.do215.baseUrl}${eventUrl}`,
            imageUrl,
            source: 'do215',
            tags: [],
            lastUpdated: new Date().toISOString()
          };
          
          events.push(event);
        }
      } catch {
        // Skip malformed event entries
      }
    });
  } catch (error) {
    console.error('Error scraping Do215:', error);
  }
  
  return filterEvents(events, params);
}

/**
 * Scrape events from Visit Philly
 */
export async function scrapeVisitPhilly(params: EventSearchParams = {}): Promise<PhillyEvent[]> {
  const client = createHttpClient();
  const events: PhillyEvent[] = [];
  
  try {
    const url = `${EVENT_SOURCES.visitPhilly.baseUrl}${EVENT_SOURCES.visitPhilly.eventsPath}`;
    const response = await withRetry(() => client.get(url));
    const $ = cheerio.load(response.data);
    
    // Visit Philly event structure
    $('.event-listing, .event, .listing-item').each((_, element) => {
      try {
        const $el = $(element);
        const title = $el.find('h2, h3, .event-name').first().text().trim();
        const description = $el.find('.event-excerpt, .description, .summary').first().text().trim();
        const dateText = $el.find('.event-date, .date, [data-date]').first().text().trim();
        const locationName = $el.find('.event-location, .venue').first().text().trim();
        const eventUrl = $el.find('a').first().attr('href') || '';
        const imageUrl = $el.find('img').first().attr('src');
        
        if (title) {
          const event: PhillyEvent = {
            id: generateEventId('visitphilly', title, dateText),
            title,
            description: description || 'No description available',
            startDate: parseEventDate(dateText),
            location: {
              name: locationName || 'Philadelphia',
              neighborhood: extractNeighborhood(locationName)
            },
            category: classifyEvent(title, description),
            price: { isFree: false, currency: 'USD' },
            url: eventUrl.startsWith('http') ? eventUrl : `${EVENT_SOURCES.visitPhilly.baseUrl}${eventUrl}`,
            imageUrl,
            source: 'visitphilly',
            tags: [],
            lastUpdated: new Date().toISOString()
          };
          
          events.push(event);
        }
      } catch {
        // Skip malformed entries
      }
    });
  } catch (error) {
    console.error('Error scraping Visit Philly:', error);
  }
  
  return filterEvents(events, params);
}

/**
 * Search Eventbrite for Philadelphia events
 */
export async function scrapeEventbrite(params: EventSearchParams = {}): Promise<PhillyEvent[]> {
  const client = createHttpClient();
  const events: PhillyEvent[] = [];
  
  try {
    // Build search URL with parameters
    const searchQuery = params.query ? encodeURIComponent(params.query) : '';
    const url = `${EVENT_SOURCES.eventbrite.baseUrl}${EVENT_SOURCES.eventbrite.searchPath}/${searchQuery ? `?q=${searchQuery}` : ''}`;
    
    const response = await withRetry(() => client.get(url));
    const $ = cheerio.load(response.data);
    
    // Eventbrite search results structure
    $('[data-testid="event-card"], .eds-event-card, .search-result-card').each((_, element) => {
      try {
        const $el = $(element);
        const title = $el.find('[data-testid="event-card-title"], .eds-event-card__formatted-name, h2').first().text().trim();
        const description = $el.find('[data-testid="event-card-description"], .eds-event-card-content__description').first().text().trim();
        const dateText = $el.find('[data-testid="event-card-date"], .eds-text-color--ui-800').first().text().trim();
        const locationName = $el.find('[data-testid="event-card-venue"], .card-text--truncated__one').first().text().trim();
        const eventUrl = $el.find('a').first().attr('href') || '';
        const imageUrl = $el.find('img').first().attr('src');
        const priceText = $el.find('[data-testid="event-card-price"], .eds-text-weight--heavy').first().text().trim();
        
        if (title) {
          const event: PhillyEvent = {
            id: generateEventId('eventbrite', title, dateText),
            title,
            description: description || 'No description available',
            startDate: parseEventDate(dateText),
            location: {
              name: locationName || 'Philadelphia',
              neighborhood: extractNeighborhood(locationName)
            },
            category: classifyEvent(title, description),
            price: {
              ...parsePrice(priceText),
              currency: 'USD'
            },
            url: eventUrl.startsWith('http') ? eventUrl : `${EVENT_SOURCES.eventbrite.baseUrl}${eventUrl}`,
            imageUrl,
            source: 'eventbrite',
            tags: [],
            lastUpdated: new Date().toISOString()
          };
          
          events.push(event);
        }
      } catch {
        // Skip malformed entries
      }
    });
  } catch (error) {
    console.error('Error scraping Eventbrite:', error);
  }
  
  return filterEvents(events, params);
}

/**
 * Filter events based on search parameters
 */
export function filterEvents(events: PhillyEvent[], params: EventSearchParams): PhillyEvent[] {
  let filtered = [...events];
  
  // Text search
  if (params.query) {
    const query = params.query.toLowerCase();
    filtered = filtered.filter(event => 
      event.title.toLowerCase().includes(query) ||
      event.description.toLowerCase().includes(query) ||
      event.location.name.toLowerCase().includes(query)
    );
  }
  
  // Category filter
  if (params.categories && params.categories.length > 0) {
    filtered = filtered.filter(event =>
      event.category.some(cat => params.categories!.includes(cat))
    );
  }
  
  // Neighborhood filter
  if (params.neighborhoods && params.neighborhoods.length > 0) {
    filtered = filtered.filter(event =>
      event.location.neighborhood &&
      params.neighborhoods!.some(n => 
        event.location.neighborhood!.toLowerCase().includes(n.toLowerCase())
      )
    );
  }
  
  // Date range filter
  if (params.startDate) {
    const startDate = new Date(params.startDate);
    filtered = filtered.filter(event => new Date(event.startDate) >= startDate);
  }
  
  if (params.endDate) {
    const endDate = new Date(params.endDate);
    filtered = filtered.filter(event => new Date(event.startDate) <= endDate);
  }
  
  // Price filters
  if (params.isFree !== undefined) {
    filtered = filtered.filter(event => event.price?.isFree === params.isFree);
  }
  
  if (params.maxPrice !== undefined) {
    filtered = filtered.filter(event => 
      event.price?.isFree || 
      (event.price?.min !== undefined && event.price.min <= params.maxPrice!)
    );
  }
  
  // Pagination
  const offset = params.offset || 0;
  const limit = params.limit || 20;
  
  return filtered.slice(offset, offset + limit);
}

/**
 * Search all sources and aggregate results
 */
export async function searchAllSources(params: EventSearchParams = {}): Promise<PhillyEvent[]> {
  const [do215Events, visitPhillyEvents, eventbriteEvents] = await Promise.allSettled([
    scrapeDo215(params),
    scrapeVisitPhilly(params),
    scrapeEventbrite(params)
  ]);
  
  const allEvents: PhillyEvent[] = [];
  
  if (do215Events.status === 'fulfilled') {
    allEvents.push(...do215Events.value);
  }
  if (visitPhillyEvents.status === 'fulfilled') {
    allEvents.push(...visitPhillyEvents.value);
  }
  if (eventbriteEvents.status === 'fulfilled') {
    allEvents.push(...eventbriteEvents.value);
  }
  
  // Deduplicate by title similarity
  const seen = new Set<string>();
  const deduplicated = allEvents.filter(event => {
    const key = event.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 30);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  
  // Sort by date
  deduplicated.sort((a, b) => 
    new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  
  return deduplicated;
}
