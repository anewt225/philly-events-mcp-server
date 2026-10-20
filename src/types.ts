/**
 * Core event data structure used across all sources
 */
export interface PhillyEvent {
  id: string;
  title: string;
  description: string;
  startDate: string;      // ISO 8601 format
  endDate?: string;       // ISO 8601 format
  location: {
    name: string;
    address?: string;
    neighborhood?: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  category: EventCategory[];
  price?: {
    min?: number;
    max?: number;
    isFree: boolean;
    currency: string;
  };
  url: string;
  imageUrl?: string;
  source: EventSource;
  tags: string[];
  lastUpdated: string;    // ISO 8601 format
}

export type EventSource = 
  | 'do215'
  | 'visitphilly'
  | 'eventbrite'
  | 'whenwherewhat'
  | 'uwishunu'
  | 'phillymag';

export type EventCategory =
  | 'music'
  | 'food_drink'
  | 'arts_culture'
  | 'sports'
  | 'nightlife'
  | 'comedy'
  | 'outdoor'
  | 'family'
  | 'community'
  | 'workshop'
  | 'networking'
  | 'film'
  | 'theater'
  | 'markets'
  | 'festivals'
  | 'other';

/**
 * Search parameters for filtering events
 */
export interface EventSearchParams {
  query?: string;
  categories?: EventCategory[];
  neighborhoods?: string[];
  startDate?: string;
  endDate?: string;
  isFree?: boolean;
  maxPrice?: number;
  limit?: number;
  offset?: number;
}

/**
 * Google Calendar event format for export
 */
export interface GoogleCalendarEvent {
  summary: string;
  description: string;
  location: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone: string;
  };
  source?: {
    title: string;
    url: string;
  };
}

/**
 * Response format for paginated results
 */
export interface PaginatedResponse<T> {
  total: number;
  count: number;
  offset: number;
  items: T[];
  hasMore: boolean;
  nextOffset?: number;
}

/**
 * Standard API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

/**
 * Neighborhood definitions for Philadelphia
 */
export const PHILLY_NEIGHBORHOODS = [
  'Center City',
  'Rittenhouse',
  'Old City',
  'Northern Liberties',
  'Fishtown',
  'University City',
  'Manayunk',
  'East Passyunk',
  'South Philly',
  'Fairmount',
  'Gayborhood',
  'Chinatown',
  'Queen Village',
  'Graduate Hospital',
  'Brewerytown',
  'Kensington',
  'Port Richmond',
  'Germantown',
  'Chestnut Hill',
  'Mount Airy',
  'Hawthorne',
  'Bella Vista'
] as const;

export type PhillyNeighborhood = typeof PHILLY_NEIGHBORHOODS[number];

/**
 * Category keywords for classification
 */
export const CATEGORY_KEYWORDS: Record<EventCategory, string[]> = {
  music: ['concert', 'live music', 'dj', 'band', 'jazz', 'rock', 'hip hop', 'electronic', 'orchestra', 'symphony'],
  food_drink: ['food', 'restaurant', 'dining', 'cocktail', 'beer', 'wine', 'tasting', 'brunch', 'happy hour', 'culinary'],
  arts_culture: ['art', 'museum', 'gallery', 'exhibition', 'culture', 'history', 'photography', 'sculpture'],
  sports: ['sports', 'phillies', 'eagles', 'sixers', 'flyers', 'union', 'game', 'match', 'race', 'marathon'],
  nightlife: ['nightclub', 'club', 'party', 'dance', 'lounge', 'bar crawl', 'night out'],
  comedy: ['comedy', 'standup', 'stand-up', 'comedian', 'improv', 'sketch'],
  outdoor: ['outdoor', 'park', 'hiking', 'biking', 'garden', 'nature', 'picnic', 'waterfront'],
  family: ['family', 'kids', 'children', 'child-friendly', 'all ages'],
  community: ['community', 'neighborhood', 'volunteer', 'charity', 'fundraiser', 'meetup'],
  workshop: ['workshop', 'class', 'learn', 'lesson', 'tutorial', 'hands-on', 'diy'],
  networking: ['networking', 'professional', 'business', 'career', 'entrepreneur'],
  film: ['film', 'movie', 'cinema', 'screening', 'documentary'],
  theater: ['theater', 'theatre', 'play', 'musical', 'performance', 'broadway', 'stage'],
  markets: ['market', 'farmers market', 'flea', 'popup', 'pop-up', 'vendor', 'craft'],
  festivals: ['festival', 'fest', 'celebration', 'parade', 'carnival'],
  other: []
};
