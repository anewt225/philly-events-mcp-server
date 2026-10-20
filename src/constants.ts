/**
 * Application constants for the Philly Events MCP Server
 */

// API endpoints for various event sources
export const EVENT_SOURCES = {
  do215: {
    baseUrl: 'https://do215.com',
    eventsPath: '/events',
    name: 'Do215'
  },
  visitPhilly: {
    baseUrl: 'https://www.visitphilly.com',
    eventsPath: '/things-to-do/events',
    name: 'Visit Philly'
  },
  eventbrite: {
    baseUrl: 'https://www.eventbrite.com',
    apiUrl: 'https://www.eventbriteapi.com/v3',
    searchPath: '/d/pa--philadelphia/events',
    name: 'Eventbrite'
  },
  uwishunu: {
    baseUrl: 'https://www.uwishunu.com',
    eventsPath: '/events',
    name: 'Uwishunu'
  }
} as const;

// Response limits
export const CHARACTER_LIMIT = 50000;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

// Time zone for Philadelphia
export const PHILLY_TIMEZONE = 'America/New_York';

// User agent for web scraping
export const USER_AGENT = 'PhillyEventsMCP/1.0 (Educational Project; +https://github.com/anewt225/philly-events-mcp-server)';

// Request timeout in milliseconds
export const REQUEST_TIMEOUT = 10000;

// Retry configuration
export const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 5000
};

// Cache TTL in seconds
export const CACHE_TTL = {
  events: 3600,        // 1 hour for event listings
  eventDetail: 86400,  // 24 hours for individual event details
  search: 1800         // 30 minutes for search results
};
