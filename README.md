# x-puppet

X/Twitter DOM automation via Chrome DevTools Protocol.
No API key. No Puppeteer. No new browser. Just your Chrome.

## What is this?

A lightweight CLI that automates X (Twitter) by controlling your own Chrome browser through CDP (Chrome DevTools Protocol). It uses the same DOM selectors as [XActions](https://github.com/nirholas/XActions), but without Puppeteer, without launching a new browser, and without any detection risk.

```
XActions: 58,000 lines, 35 dependencies, 118MB, Puppeteer, new Chromium instance
x-puppet: 550 lines, 1 dependency, 100KB, CDP direct, YOUR Chrome
```

## Why?

| | Official API | XActions (Puppeteer) | x-puppet (CDP) |
|---|---|---|---|
| Cost | $100/mo | Free | Free |
| Browser | N/A | New Chromium | **Your Chrome** |
| Login | OAuth | Cookie management | **Already logged in** |
| Detection risk | None | Stealth plugin needed | **None (you ARE the user)** |
| Dependencies | API SDK | 35 packages | **1 package** |

## Quick Start

### 1. Launch Chrome with CDP

```bash
# Quit Chrome first (Cmd+Q), then:
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/.x-puppet-chrome"
```

> First time? Log into X manually in this Chrome window. Cookie persists after that.

### 2. Install

```bash
git clone https://github.com/user/x-puppet.git
cd x-puppet
npm install
```

### 3. Use

```bash
# Post a tweet
node index.js tweet "Hello from x-puppet!"

# Like the first tweet on your timeline
node index.js like

# Read your timeline
node index.js timeline

# Search tweets
node index.js search "Kindle NotebookLM" 5

# Get someone's profile
node index.js profile elonmusk

# Auto-like tweets matching a query
node index.js auto-like "AI reading" 10

# Read notifications
node index.js notifications
```

## All Commands

### Actions
| Command | Description |
|---------|-------------|
| `tweet <text>` | Post a tweet |
| `like [index]` | Like tweet at index (default: 0) |
| `unlike [index]` | Unlike tweet |
| `reply <text> [index]` | Reply to tweet |
| `follow <username>` | Follow a user |
| `unfollow <username>` | Unfollow a user |

### Scraping
| Command | Description |
|---------|-------------|
| `timeline [limit]` | Read your timeline |
| `notifications [limit]` | Read notifications |
| `profile <username>` | Get user profile |
| `tweets <username> [limit]` | Get user's tweets |
| `tweet-detail <tweetId>` | Get tweet details |
| `followers <username> [limit]` | List followers |
| `following <username> [limit]` | List following |
| `search <query> [limit]` | Search tweets |

### Automation
| Command | Description |
|---------|-------------|
| `auto-like <query> [max]` | Auto-like search results |
| `auto-like-user <username> [max]` | Auto-like user's tweets |
| `auto-comment <query> <comment>` | Auto-comment on search results |
| `keyword-follow <query> [max]` | Follow users from search |
| `unfollow-non-followers <username>` | Unfollow non-followers |

### Other
| Command | Description |
|---------|-------------|
| `navigate <path>` | Go to x.com/\<path\> |
| `eval <js>` | Execute JS on the page |

## Architecture

```
Your Chrome (with --remote-debugging-port=9222)
  ↑ CDP (Chrome DevTools Protocol)
  |
x-puppet (Node.js)
  ├── index.js  — CLI interface
  └── shim.js   — Puppeteer API compatibility layer
```

The shim (`shim.js`) reimplements Puppeteer's `page` API on top of raw CDP. This means:

1. **XActions compatibility** — Code from XActions' `puppeteer/*.js` runs on the shim with minimal changes
2. **No Puppeteer dependency** — No headless browser, no stealth plugins
3. **Your session** — Uses your logged-in Chrome, so X sees a real human

## Using as a Library

```js
const { BrowserAutomationShim } = require('./shim');

const ba = new BrowserAutomationShim();
const page = await ba.connect();

// Scrape a profile
const profile = await ba.scrapeProfile(page, 'elonmusk');

// Search and auto-like
const result = await ba.autoLike(page, {
  query: 'AI reading',
  maxLikes: 5,
});

// Post a comment
await ba.postComment(page, 'https://x.com/user/status/123', 'Great post!');

await ba.close();
```

## XActions Compatibility

The `BrowserAutomationShim` class is a drop-in replacement for XActions' `browserAutomation` module. If XActions adds a new feature, you can port it by:

1. Copy the XActions code
2. Replace `browserAutomation` with your `BrowserAutomationShim` instance
3. It works — the shim handles the Puppeteer → CDP translation

## "x" in x-puppet

The "x" is a double meaning:
- **X** the platform (Twitter)
- **x** as in "cross" / "any" — the architecture works for any website with DOM automation

The shim pattern can be extended to automate Amazon, YouTube, Gmail, or any site — just add new selectors.

## Rate Limits & Safety

Built-in delays follow XActions' patterns:
- Like/Follow: 2-5s random delay
- Every 10 actions: 10-20s pause
- Comments: 30-60s delay (X is strict on comments)
- Every 5 comments: 2-3min pause

## License

MIT
