# 🏛️ Philly Events MCP Server

An MCP (Model Context Protocol) server that enables AI assistants to discover and search Philadelphia events from multiple sources. This project demonstrates modern AI infrastructure patterns including tool-based agents, semantic search, and structured data aggregation.

## 🎯 Project Overview

This MCP server aggregates events from Philadelphia's top event sources:

- **Do215** - Local indie events, arts, music, nightlife
- **Visit Philly** - Tourism-focused events, major attractions
- **Eventbrite** - Ticketed events, workshops, professional networking

It provides a unified API that AI agents can use to help users discover things to do in Philadelphia.

## 🚀 Features

### Tools Available

| Tool | Description |
|------|-------------|
| `philly_search_events` | Search events across all sources with powerful filters |
| `philly_search_source` | Search a specific event source |
| `philly_export_to_calendar` | Export events to Google Calendar format |
| `philly_list_categories` | List all event categories |
| `philly_list_neighborhoods` | List Philadelphia neighborhoods |
| `philly_weekly_digest` | Generate a curated weekly event digest |

### Search Capabilities

- **Text search** - Match against titles, descriptions, locations
- **Category filters** - Music, food/drink, arts, sports, nightlife, comedy, etc.
- **Neighborhood filters** - Fishtown, Center City, Rittenhouse, and 20+ more
- **Date range** - Find events for specific time periods
- **Price filters** - Free events or max price limits
- **Pagination** - Handle large result sets efficiently

## 📦 Installation

```bash
# Clone the repository
git clone https://github.com/anewt225/philly-events-mcp-server.git
cd philly-events-mcp-server

# Install dependencies
npm install

# Build the TypeScript
npm run build
```

## 🔧 Usage

### Running with stdio (Local Development)

```bash
npm start
```

### Running with HTTP (Production)

```bash
TRANSPORT=http PORT=3000 npm start
```

### Adding it to Claude

First clone, `npm install` and `npm run build` (see Installation) so that `dist/index.js` exists. Then use the absolute path to that file below.

**Claude Code** (one command):

```bash
claude mcp add philly-events -- node /absolute/path/to/philly-events-mcp-server/dist/index.js
```

**Claude Desktop**: open Settings → Developer → Edit Config, or edit `claude_desktop_config.json` directly:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

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

On Windows, use forward slashes or escaped backslashes in the path (for example `C:/Users/you/projects/philly-events-mcp-server/dist/index.js`). Restart Claude Desktop after saving; the `philly_*` tools then appear in the tools menu.

## 💡 Example Queries

Once connected, you can ask Claude things like:

- *"What's happening in Fishtown this weekend?"*
- *"Find free outdoor events in Philadelphia"*
- *"Show me live music events under $30"*
- *"Generate a weekly digest of food and drink events"*
- *"Find comedy shows in Center City next Friday"*

## 🏗️ Architecture

```
philly-events-mcp-server/
├── src/
│   ├── index.ts           # MCP server + tool registration
│   ├── types.ts           # TypeScript interfaces
│   ├── constants.ts       # Configuration constants
│   ├── schemas/           # Zod validation schemas
│   │   └── eventSchemas.ts
│   └── services/          # Business logic
│       └── eventScraper.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Key Design Decisions

1. **MCP Protocol** - Uses Anthropic's Model Context Protocol for seamless AI integration
2. **TypeScript** - Strong typing for reliability and maintainability
3. **Zod Schemas** - Runtime validation with clear error messages
4. **Modular Scrapers** - Each source is independent and can be updated separately
5. **In-Memory Cache** - Efficient event retrieval within a session

## 🔜 Roadmap

### Phase 2: Intelligence Layer
- [ ] Implement RAG with vector database for semantic search
- [ ] Add preference learning based on user selections
- [ ] Build recommendation engine

### Phase 3: Product Features
- [ ] Google Calendar API integration
- [ ] Weekly email digest automation
- [ ] User preference profiles
- [ ] Event similarity matching

## 🧪 Testing

```bash
# Build and verify
npm run build

# Test with MCP Inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

## 📊 Event Categories

| Category | Description |
|----------|-------------|
| `music` | Concerts, live music, DJs |
| `food_drink` | Food events, happy hours, tastings |
| `arts_culture` | Museums, galleries, exhibitions |
| `sports` | Sports games, fitness events |
| `nightlife` | Clubs, parties, bar events |
| `comedy` | Stand-up, improv, sketch |
| `outdoor` | Parks, hiking, outdoor activities |
| `family` | Kid-friendly events |
| `community` | Neighborhood events, meetups |
| `workshop` | Classes, learning events |
| `networking` | Professional events |
| `film` | Movies, screenings |
| `theater` | Plays, musicals |
| `markets` | Farmers markets, flea markets |
| `festivals` | Festivals, celebrations |

## 🏘️ Neighborhoods

Center City, Rittenhouse, Old City, Northern Liberties, Fishtown, University City, Manayunk, East Passyunk, South Philly, Fairmount, Gayborhood, Chinatown, Queen Village, Graduate Hospital, Brewerytown, Kensington, Port Richmond, Germantown, Chestnut Hill, Mount Airy, Hawthorne, Bella Vista

## 📄 License

MIT License - Feel free to use and modify for your own projects.

## 🤝 Contributing

Contributions welcome! This project is designed to be extended:

- Add new event sources
- Improve scraping accuracy
- Enhance category classification
- Add new tool capabilities

## 👤 Author

Built as a portfolio project demonstrating:
- Modern MCP server development
- AI agent infrastructure
- Product thinking for local discovery
- TypeScript best practices

---

*Made with ❤️ for Philadelphia*
