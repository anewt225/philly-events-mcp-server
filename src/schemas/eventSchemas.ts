import { z } from 'zod';

/**
 * Event categories enum
 */
export const EventCategorySchema = z.enum([
  'music',
  'food_drink',
  'arts_culture',
  'sports',
  'nightlife',
  'comedy',
  'outdoor',
  'family',
  'community',
  'workshop',
  'networking',
  'film',
  'theater',
  'markets',
  'festivals',
  'other'
]);

/**
 * Event source enum
 */
export const EventSourceSchema = z.enum([
  'do215',
  'visitphilly',
  'eventbrite',
  'whenwherewhat',
  'uwishunu',
  'phillymag'
]);

/**
 * Response format enum
 */
export const ResponseFormatSchema = z.enum(['json', 'markdown']).default('markdown');

/**
 * Schema for searching events across all sources
 */
export const SearchEventsSchema = z.object({
  query: z.string()
    .max(200, 'Query must be 200 characters or less')
    .optional()
    .describe('Search text to match against event titles, descriptions, and locations'),
  
  categories: z.array(EventCategorySchema)
    .optional()
    .describe('Filter by event categories (e.g., music, food_drink, arts_culture)'),
  
  neighborhoods: z.array(z.string())
    .optional()
    .describe('Filter by Philadelphia neighborhoods (e.g., Fishtown, Center City, Rittenhouse)'),
  
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .describe('Start date for event search (YYYY-MM-DD format)'),
  
  end_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
    .optional()
    .describe('End date for event search (YYYY-MM-DD format)'),
  
  is_free: z.boolean()
    .optional()
    .describe('Filter for free events only'),
  
  max_price: z.number()
    .min(0, 'Max price must be non-negative')
    .optional()
    .describe('Maximum ticket price in USD'),
  
  limit: z.number()
    .int()
    .min(1, 'Limit must be at least 1')
    .max(100, 'Limit cannot exceed 100')
    .default(20)
    .describe('Maximum number of events to return (default: 20, max: 100)'),
  
  offset: z.number()
    .int()
    .min(0, 'Offset must be non-negative')
    .default(0)
    .describe('Number of events to skip for pagination'),
  
  response_format: ResponseFormatSchema
    .describe('Output format: markdown for readable text, json for structured data')
}).strict();

/**
 * Schema for searching a specific source
 */
export const SearchSourceSchema = z.object({
  source: EventSourceSchema
    .describe('Event source to search (do215, visitphilly, eventbrite)'),
  
  query: z.string()
    .max(200)
    .optional()
    .describe('Search text to match against events'),
  
  limit: z.number()
    .int()
    .min(1)
    .max(100)
    .default(20)
    .describe('Maximum number of events to return'),
  
  response_format: ResponseFormatSchema
}).strict();

/**
 * Schema for getting event details
 */
export const GetEventDetailsSchema = z.object({
  event_id: z.string()
    .min(1, 'Event ID is required')
    .describe('Unique identifier for the event'),
  
  response_format: ResponseFormatSchema
}).strict();

/**
 * Schema for exporting events to Google Calendar format
 */
export const ExportToCalendarSchema = z.object({
  event_ids: z.array(z.string())
    .min(1, 'At least one event ID is required')
    .max(50, 'Cannot export more than 50 events at once')
    .describe('Array of event IDs to export'),
  
  include_description: z.boolean()
    .default(true)
    .describe('Include full event description in calendar event'),
  
  include_source_link: z.boolean()
    .default(true)
    .describe('Include link to original event page')
}).strict();

/**
 * Schema for listing available categories
 */
export const ListCategoriesSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

/**
 * Schema for listing neighborhoods
 */
export const ListNeighborhoodsSchema = z.object({
  response_format: ResponseFormatSchema
}).strict();

/**
 * Schema for getting weekly digest
 */
export const GetWeeklyDigestSchema = z.object({
  categories: z.array(EventCategorySchema)
    .optional()
    .describe('Filter digest by categories of interest'),
  
  neighborhoods: z.array(z.string())
    .optional()
    .describe('Filter digest by preferred neighborhoods'),
  
  include_free_only: z.boolean()
    .default(false)
    .describe('Only include free events'),
  
  max_events: z.number()
    .int()
    .min(5)
    .max(50)
    .default(20)
    .describe('Maximum events to include in digest'),
  
  response_format: ResponseFormatSchema
}).strict();

// Export inferred types
export type SearchEventsInput = z.infer<typeof SearchEventsSchema>;
export type SearchSourceInput = z.infer<typeof SearchSourceSchema>;
export type GetEventDetailsInput = z.infer<typeof GetEventDetailsSchema>;
export type ExportToCalendarInput = z.infer<typeof ExportToCalendarSchema>;
export type ListCategoriesInput = z.infer<typeof ListCategoriesSchema>;
export type ListNeighborhoodsInput = z.infer<typeof ListNeighborhoodsSchema>;
export type GetWeeklyDigestInput = z.infer<typeof GetWeeklyDigestSchema>;
