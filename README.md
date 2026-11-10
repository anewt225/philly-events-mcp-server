# Philly Events MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) server that gives an AI assistant six tools for finding things to do in Philadelphia. It pulls event listings from Do215, Visit Philly and Eventbrite, normalizes them into one event shape, and lets the assistant filter by category, neighborhood, date and price.

Written in TypeScript with the official MCP SDK, Zod input schemas, and cheerio for HTML parsing. Runs over stdio (Claude Desktop, Claude Code) or as a small HTTP service.

## Status

**The MCP layer works. The scrapers need selector work before they return real events.**

Checked on 2026-11-10 with Node 22:

| Part | State |
|---|---|
| `npm install`, `npm run build` | Works |
| Server start, stdio and HTTP | Works |
| All six tools register and answer | Works |
| `philly_list_categories`, `philly_list_neighborhoods` | Return real data (they are static lists) |
| Event search against the live sites | **Returns zero events.** All three sites answer `200`, but the CSS selectors in `src/services/eventScraper.ts` are first-pass guesses and match nothing in the current page markup |
| `philly_export_to_calendar` | Works on events found earlier in the same session, so it has nothing to export until search does |

So today this repo is a complete, typed MCP server with a parsing layer that still has to be fitted to each site. That is the next piece of work (see [Roadmap](#roadmap)).

## Tools

| Tool | What it does |
|---|---|
| `philly_search_events` | Queries all three sources, merges the results, removes duplicates, sorts by start date. Filters: `query`, `categories`, `neighborhoods`, `start_date`, `end_date`, `is_free`, `max_price`, `limit`, `offset` |
| `philly_search_source` | Same search against one source: `do215`, `visitphilly` or `eventbrite` |
| `philly_weekly_digest` | Events for the next seven days, grouped by category, up to five shown per category |
| `philly_export_to_calendar` | Converts event IDs from an earlier search into Google Calendar event JSON (title, description, location, start and end in `America/New_York`). It builds the payload only; it does not call the Calendar API |
| `philly_list_categories` | The 15 categories plus `other`, with the keywords behind each |
| `philly_list_neighborhoods` | The 22 neighborhoods the filter recognizes |

Search tools return Markdown by default, or JSON with `response_format: "json"`. Every tool is annotated read-only.

## Install

Requires Node.js 18 or later (the MCP SDK's minimum; built and run here on Node 22).

```bash
git clone https://github.com/anewt225/philly-events-mcp-server.git
cd philly-events-mcp-server
npm install
npm run build
```

`npm run build` compiles `src/` to `dist/`. `npm run dev` runs the compiler in watch mode.

## Run

### stdio (local use)

```bash
npm start
```

The server waits for MCP messages on stdin and logs to stderr.

### HTTP

```bash
# macOS, Linux, Git Bash
TRANSPORT=http PORT=3000 npm start
```

```powershell
# Windows PowerShell
$env:TRANSPORT = "http"; $env:PORT = "3000"; npm start
```

This serves MCP over streamable HTTP at `POST /mcp` (stateless, JSON responses) and a health check at `GET /health`. `PORT` defaults to 3000. There is no authentication, so keep it on localhost or put it behind something that adds auth.

### Connect it to Claude

Build first so that `dist/index.js` exists, then point Claude at the absolute path to that file.

**Claude Code**

```bash
claude mcp add philly-events -- node /absolute/path/to/philly-events-mcp-server/dist/index.js
```

**Claude Desktop**: Settings → Developer → Edit Config, or edit `claude_desktop_config.json` directly (`~/Library/Application Support/Claude/` on macOS, `%APPDATA%\Claude\` on Windows):

```json
{
  "mcpServers": {
    "philly-events": {
      "command": "node",
      "args": ["/absolute/path/to/philly-events-mcp-server/dist/index.js"]
    }
  }
}
```

On Windows, write the path with forward slashes or escaped backslashes, for example `C:/Users/you/projects/philly-events-mcp-server/dist/index.js`. Restart Claude Desktop after saving.

### Try the tools without Claude

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

The MCP Inspector lists the six tools and lets you call each one by hand.

## How it works

```
assistant ──MCP──▶ index.ts (6 tools, Zod-validated input)
                      │
                      ▼
              eventScraper.ts
   fetch page (axios, 10 s timeout, up to 3 retries with backoff)
        → parse event cards (cheerio)
        → classify by keyword        → 15 categories
        → match venue text           → 22 neighborhoods
        → parse price text           → free / min / max
        → filter, merge, de-duplicate, sort by date
                      │
                      ▼
        Markdown or JSON back to the assistant
```

- **One event shape.** Every source is mapped to the same `PhillyEvent` type (`src/types.ts`), so filters and formatting are written once.
- **Classification is rule-based.** Categories come from keyword lists and neighborhoods from substring matches on the venue text. There is no model call and no embedding search inside the server; the assistant on the other end supplies the language understanding.
- **Duplicates across sources** are removed by comparing the first 30 alphanumeric characters of the lowercased title.
- **Sources fail independently.** If one site times out, the other two still return (`Promise.allSettled`).
- **Session cache.** Events returned by a search are held in memory so that `philly_export_to_calendar` can look them up by ID. The cache lasts as long as the process and has no expiry.
- The scraper identifies itself with a descriptive `User-Agent` that links back to this repo.

## Known limitations

- **Selectors are placeholders** (see [Status](#status)). No events come back from the live sites yet.
- **Paging happens per source.** `limit` and `offset` are applied to each source before the merge, so an aggregated search can return up to three times `limit`, and `offset` does not page through the merged list.
- **Unparseable dates fall back to the current time**, which would put such events at the top of a date-sorted list.
- **Visit Philly prices are not parsed.** Those events are always marked as not free, with no price.
- **Neighborhood filtering depends on the venue text naming the neighborhood.** A venue listed only by street address will not match.
- The input schema for `philly_search_source` also accepts `whenwherewhat`, `uwishunu` and `phillymag`. Those sources are not implemented and return an error.
- The `CACHE_TTL` values in `src/constants.ts` are defined but not used.
- **No automated tests and no CI yet.**
- This reads public listing pages. Check each site's terms of use before running it at any volume.

## Roadmap

1. Fit the parsers to each site's real markup, preferring embedded structured data (JSON-LD `Event` objects) over CSS classes where a site provides it.
2. Save sample pages as fixtures and add parser tests, so a markup change shows up as a failing test instead of an empty result.
3. Merge first, then filter and page, so `limit` and `offset` behave as documented.
4. Later: write events to Google Calendar through its API, a scheduled weekly digest, and saved preferences.

## Project layout

```
src/
├── index.ts                  MCP server, tool registration, stdio and HTTP transports
├── types.ts                  PhillyEvent and related types, neighborhood list, category keywords
├── constants.ts              source URLs, timeouts, retry settings
├── schemas/eventSchemas.ts   Zod input schemas for each tool
└── services/eventScraper.ts  fetching, parsing, classification, filtering, de-duplication
```

## License

[MIT](LICENSE)

Built by [Alex Newton](https://github.com/anewt225).
