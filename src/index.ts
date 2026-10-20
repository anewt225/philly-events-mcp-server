#!/usr/bin/env node
/**
 * Philly Events MCP Server
 * 
 * An MCP server that enables LLMs to discover and search Philadelphia events
 * from multiple sources including Do215, Visit Philly, Eventbrite, and more.
 * 
 * This server is designed to power an AI-driven social calendar that helps
 * Philadelphians discover things to do in the city.
 * 
 * @author Alex
 * @version 1.0.0
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import {
  PhillyEvent,
  GoogleCalendarEvent,
  PHILLY_NEIGHBORHOODS,
  CATEGORY_KEYWORDS
} from './types.js';

import {
  scrapeDo215,
  scrapeVisitPhilly,
  scrapeEventbrite,
  searchAllSources,
  filterEvents
} from './services/eventScraper.js';

import {
  SearchEventsSchema,
  SearchSourceSchema,
  GetEventDetailsSchema,
  ExportToCalendarSchema,
  ListCategoriesSchema,
  ListNeighborhoodsSchema,
  GetWeeklyDigestSchema,
  SearchEventsInput,
  SearchSourceInput,
  ExportToCalendarInput,
  ListCategoriesInput,
  ListNeighborhoodsInput,
  GetWeeklyDigestInput
} from './schemas/eventSchemas.js';

import { PHILLY_TIMEZONE, CHARACTER_LIMIT } from './constants.js';

// Initialize MCP Server
const server = new McpServer({
  name: "philly-events-mcp-server",
  version: "1.0.0"
});

// In-memory event cache for the session
const eventCache = new Map<string, PhillyEvent>();

/**
 * Format events as markdown
 */
function formatEventsMarkdown(events: PhillyEvent[], title: string): string {
  if (events.length === 0) {
    return `# ${title}\n\nNo events found matching your criteria.`;
  }

  let output = `# ${title}\n\n`;
  output += `Found **${events.length}** events:\n\n`;

  for (const event of events) {
    const date = new Date(event.startDate).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    
    const price = event.price?.isFree 
      ? '**FREE**' 
      : event.price?.min 
        ? `$${event.price.min}${event.price.max ? `-$${event.price.max}` : '+'}` 
        : 'Price TBD';

    output += `## ${event.title}\n`;
    output += `📅 ${date}\n`;
    output += `📍 ${event.location.name}`;
    if (event.location.neighborhood) {
      output += ` (${event.location.neighborhood})`;
    }
    output += `\n`;
    output += `💰 ${price}\n`;
    output += `🏷️ ${event.category.join(', ')}\n`;
    output += `\n${event.description.substring(0, 200)}${event.description.length > 200 ? '...' : ''}\n`;
    output += `\n🔗 [View Details](${event.url}) | Source: ${event.source}\n`;
    output += `ID: \`${event.id}\`\n\n---\n\n`;
  }

  return output;
}

/**
 * Format events as JSON
 */
function formatEventsJson(events: PhillyEvent[]): Record<string, unknown> {
  return {
    total: events.length,
    events: events.map(e => ({
      id: e.id,
      title: e.title,
      description: e.description,
      startDate: e.startDate,
      endDate: e.endDate,
      location: e.location,
      category: e.category,
      price: e.price,
      url: e.url,
      source: e.source
    }))
  };
}

/**
 * Convert PhillyEvent to Google Calendar format
 */
function toGoogleCalendarEvent(event: PhillyEvent, includeDescription: boolean, includeSourceLink: boolean): GoogleCalendarEvent {
  let description = '';
  
  if (includeDescription) {
    description = event.description;
  }
  
  if (includeSourceLink) {
    description += `\n\n---\nSource: ${event.source}\nOriginal event: ${event.url}`;
  }

  return {
    summary: event.title,
    description: description.trim(),
    location: event.location.address || event.location.name,
    start: {
      dateTime: event.startDate,
      timeZone: PHILLY_TIMEZONE
    },
    end: {
      dateTime: event.endDate || new Date(new Date(event.startDate).getTime() + 2 * 60 * 60 * 1000).toISOString(),
      timeZone: PHILLY_TIMEZONE
    },
    source: {
      title: event.source,
      url: event.url
    }
  };
}

// ============================================================================
// TOOL REGISTRATIONS
// ============================================================================

/**
 * Tool: Search events across all Philadelphia sources
 */
server.registerTool(
  "philly_search_events",
  {
    title: "Search Philadelphia Events",
    description: `Search for events across all Philadelphia event sources (Do215, Visit Philly, Eventbrite).

This is the primary tool for discovering events happening in Philadelphia. It aggregates results from multiple sources, deduplicates them, and allows filtering by various criteria.

Args:
  - query (string, optional): Text to search in event titles, descriptions, and locations
  - categories (array, optional): Filter by categories like 'music', 'food_drink', 'arts_culture', 'sports', 'nightlife', 'comedy', 'outdoor', 'family', 'community', 'workshop', 'networking', 'film', 'theater', 'markets', 'festivals'
  - neighborhoods (array, optional): Filter by Philly neighborhoods like 'Fishtown', 'Center City', 'Rittenhouse', 'Northern Liberties', 'Old City', etc.
  - start_date (string, optional): Start date in YYYY-MM-DD format
  - end_date (string, optional): End date in YYYY-MM-DD format
  - is_free (boolean, optional): Only return free events
  - max_price (number, optional): Maximum ticket price in USD
  - limit (number): Max results to return (default: 20, max: 100)
  - offset (number): Pagination offset (default: 0)
  - response_format ('markdown' | 'json'): Output format (default: 'markdown')

Returns:
  Aggregated event listings from all sources with deduplication.

Examples:
  - "Find live music this weekend" → query="live music", categories=["music"]
  - "Free outdoor events in Fishtown" → is_free=true, categories=["outdoor"], neighborhoods=["Fishtown"]
  - "Comedy shows under $30" → categories=["comedy"], max_price=30`,
    inputSchema: SearchEventsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: SearchEventsInput) => {
    try {
      const events = await searchAllSources({
        query: params.query,
        categories: params.categories,
        neighborhoods: params.neighborhoods,
        startDate: params.start_date,
        endDate: params.end_date,
        isFree: params.is_free,
        maxPrice: params.max_price,
        limit: params.limit,
        offset: params.offset
      });

      // Cache events for later retrieval
      events.forEach(event => eventCache.set(event.id, event));

      if (params.response_format === 'json') {
        const output = formatEventsJson(events);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }

      const markdown = formatEventsMarkdown(events, 'Philadelphia Events');
      return {
        content: [{ type: "text", text: markdown }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error searching events: ${(error as Error).message}. Try narrowing your search criteria or checking your date format (YYYY-MM-DD).`
        }]
      };
    }
  }
);

/**
 * Tool: Search a specific event source
 */
server.registerTool(
  "philly_search_source",
  {
    title: "Search Specific Event Source",
    description: `Search for events from a specific Philadelphia event source.

Use this when you want to search only one source (e.g., just Do215 or just Eventbrite) rather than aggregating from all sources.

Args:
  - source (string): Event source to search - one of 'do215', 'visitphilly', 'eventbrite'
  - query (string, optional): Search text
  - limit (number): Max results (default: 20)
  - response_format ('markdown' | 'json'): Output format

Available sources:
  - do215: Local indie events, arts, music, nightlife
  - visitphilly: Tourism-focused events, major attractions
  - eventbrite: Ticketed events, workshops, professional events`,
    inputSchema: SearchSourceSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: SearchSourceInput) => {
    try {
      let events: PhillyEvent[];
      const searchParams = { query: params.query, limit: params.limit };

      switch (params.source) {
        case 'do215':
          events = await scrapeDo215(searchParams);
          break;
        case 'visitphilly':
          events = await scrapeVisitPhilly(searchParams);
          break;
        case 'eventbrite':
          events = await scrapeEventbrite(searchParams);
          break;
        default:
          throw new Error(`Unknown source: ${params.source}. Use 'do215', 'visitphilly', or 'eventbrite'.`);
      }

      events.forEach(event => eventCache.set(event.id, event));

      if (params.response_format === 'json') {
        const output = formatEventsJson(events);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }

      const markdown = formatEventsMarkdown(events, `Events from ${params.source}`);
      return {
        content: [{ type: "text", text: markdown }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error searching ${params.source}: ${(error as Error).message}`
        }]
      };
    }
  }
);

/**
 * Tool: Export events to Google Calendar format
 */
server.registerTool(
  "philly_export_to_calendar",
  {
    title: "Export Events to Calendar Format",
    description: `Convert Philadelphia events to Google Calendar format for import.

This tool takes event IDs (from search results) and returns them in Google Calendar JSON format, ready for import via the Google Calendar API.

Args:
  - event_ids (array): Array of event IDs to export (max 50)
  - include_description (boolean): Include full description (default: true)
  - include_source_link (boolean): Include link to original event (default: true)

Returns:
  Array of Google Calendar event objects ready for API import.

Example workflow:
  1. Use philly_search_events to find events
  2. Note the event IDs from results
  3. Call this tool with those IDs to get calendar format
  4. Import to Google Calendar via API`,
    inputSchema: ExportToCalendarSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: ExportToCalendarInput) => {
    try {
      const calendarEvents: GoogleCalendarEvent[] = [];
      const notFound: string[] = [];

      for (const eventId of params.event_ids) {
        const event = eventCache.get(eventId);
        if (event) {
          calendarEvents.push(toGoogleCalendarEvent(
            event,
            params.include_description,
            params.include_source_link
          ));
        } else {
          notFound.push(eventId);
        }
      }

      const output = {
        success: true,
        exported: calendarEvents.length,
        notFound: notFound.length > 0 ? notFound : undefined,
        events: calendarEvents
      };

      return {
        content: [{
          type: "text",
          text: JSON.stringify(output, null, 2)
        }],
        structuredContent: output
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error exporting events: ${(error as Error).message}. Make sure the event IDs are from a recent search.`
        }]
      };
    }
  }
);

/**
 * Tool: List available event categories
 */
server.registerTool(
  "philly_list_categories",
  {
    title: "List Event Categories",
    description: `List all available event categories for filtering Philadelphia events.

Use this to discover what categories are available when searching for events.`,
    inputSchema: ListCategoriesSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: ListCategoriesInput) => {
    const categories = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => ({
      category,
      description: `Events related to: ${keywords.slice(0, 5).join(', ')}${keywords.length > 5 ? ', ...' : ''}`,
      keywords: keywords
    }));

    if (params.response_format === 'json') {
      return {
        content: [{ type: "text", text: JSON.stringify({ categories }, null, 2) }],
        structuredContent: { categories }
      };
    }

    let markdown = '# Philadelphia Event Categories\n\n';
    for (const cat of categories) {
      markdown += `## ${cat.category}\n`;
      markdown += `${cat.description}\n\n`;
    }

    return {
      content: [{ type: "text", text: markdown }]
    };
  }
);

/**
 * Tool: List Philadelphia neighborhoods
 */
server.registerTool(
  "philly_list_neighborhoods",
  {
    title: "List Philadelphia Neighborhoods",
    description: `List all recognized Philadelphia neighborhoods for filtering events.

Use this to discover what neighborhood filters are available.`,
    inputSchema: ListNeighborhoodsSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false
    }
  },
  async (params: ListNeighborhoodsInput) => {
    const neighborhoods = PHILLY_NEIGHBORHOODS;

    if (params.response_format === 'json') {
      return {
        content: [{ type: "text", text: JSON.stringify({ neighborhoods }, null, 2) }],
        structuredContent: { neighborhoods: [...neighborhoods] }
      };
    }

    let markdown = '# Philadelphia Neighborhoods\n\n';
    markdown += 'These neighborhoods can be used to filter event searches:\n\n';
    markdown += neighborhoods.map(n => `- ${n}`).join('\n');

    return {
      content: [{ type: "text", text: markdown }]
    };
  }
);

/**
 * Tool: Generate a weekly event digest
 */
server.registerTool(
  "philly_weekly_digest",
  {
    title: "Generate Weekly Event Digest",
    description: `Generate a curated weekly digest of Philadelphia events.

This tool searches for events happening in the next 7 days and formats them as a digestible newsletter-style summary, organized by category.

Args:
  - categories (array, optional): Focus on specific categories
  - neighborhoods (array, optional): Focus on specific neighborhoods
  - include_free_only (boolean): Only include free events (default: false)
  - max_events (number): Maximum events in digest (default: 20, max: 50)
  - response_format ('markdown' | 'json'): Output format

Perfect for:
  - Weekly event roundup emails
  - Planning your weekend
  - Discovering new things to do`,
    inputSchema: GetWeeklyDigestSchema,
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: true
    }
  },
  async (params: GetWeeklyDigestInput) => {
    try {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const events = await searchAllSources({
        categories: params.categories,
        neighborhoods: params.neighborhoods,
        startDate: today.toISOString().split('T')[0],
        endDate: nextWeek.toISOString().split('T')[0],
        isFree: params.include_free_only ? true : undefined,
        limit: params.max_events
      });

      events.forEach(event => eventCache.set(event.id, event));

      // Group events by category for digest
      const byCategory: Record<string, PhillyEvent[]> = {};
      for (const event of events) {
        const primaryCategory = event.category[0] || 'other';
        if (!byCategory[primaryCategory]) {
          byCategory[primaryCategory] = [];
        }
        byCategory[primaryCategory].push(event);
      }

      if (params.response_format === 'json') {
        const output = {
          weekOf: today.toISOString().split('T')[0],
          totalEvents: events.length,
          byCategory,
          events
        };
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output
        };
      }

      // Format as markdown digest
      let markdown = `# 📅 Philly Events This Week\n`;
      markdown += `**Week of ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}**\n\n`;
      markdown += `Found **${events.length}** events for you!\n\n`;

      for (const [category, categoryEvents] of Object.entries(byCategory)) {
        const emoji = getCategoryEmoji(category);
        markdown += `## ${emoji} ${category.replace('_', ' & ').toUpperCase()}\n\n`;

        for (const event of categoryEvents.slice(0, 5)) {
          const date = new Date(event.startDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          });
          const price = event.price?.isFree ? 'FREE' : event.price?.min ? `$${event.price.min}` : '';
          
          markdown += `**${event.title}**\n`;
          markdown += `${date} • ${event.location.name} ${price ? `• ${price}` : ''}\n`;
          markdown += `[More Info](${event.url})\n\n`;
        }

        if (categoryEvents.length > 5) {
          markdown += `_...and ${categoryEvents.length - 5} more ${category} events_\n\n`;
        }
      }

      return {
        content: [{ type: "text", text: markdown }]
      };
    } catch (error) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Error generating digest: ${(error as Error).message}`
        }]
      };
    }
  }
);

/**
 * Helper: Get emoji for category
 */
function getCategoryEmoji(category: string): string {
  const emojis: Record<string, string> = {
    music: '🎵',
    food_drink: '🍽️',
    arts_culture: '🎨',
    sports: '⚽',
    nightlife: '🌙',
    comedy: '😂',
    outdoor: '🌳',
    family: '👨‍👩‍👧',
    community: '🤝',
    workshop: '🛠️',
    networking: '💼',
    film: '🎬',
    theater: '🎭',
    markets: '🛍️',
    festivals: '🎉',
    other: '📌'
  };
  return emojis[category] || '📌';
}

// ============================================================================
// SERVER STARTUP
// ============================================================================

async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Philly Events MCP Server running on stdio");
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.get('/health', (_, res) => {
    res.json({ status: 'healthy', server: 'philly-events-mcp-server' });
  });

  app.post('/mcp', async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on('close', () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || '3000');
  app.listen(port, () => {
    console.error(`Philly Events MCP Server running on http://localhost:${port}/mcp`);
  });
}

// Choose transport based on environment
const transport = process.env.TRANSPORT || 'stdio';
if (transport === 'http') {
  runHTTP().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch(error => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
