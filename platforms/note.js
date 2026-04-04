// puppet - note.com platform module
// DOM automation for note.com via CDP

const { connectToTab, evaluate, sleep } = require('../core/cdp');

async function connect() {
  return connectToTab('note.com');
}

// --- Actions ---

async function suki(client, index = 0) {
  const btns = await evaluate(client, `
    const btns = document.querySelectorAll('.o-noteLikeV3__iconButton');
    Array.from(btns).map((b, i) => ({
      index: i,
      liked: b.getAttribute('aria-pressed') === 'true',
      count: b.closest('.o-noteLikeV3')?.querySelector('.o-noteLikeV3__count')?.textContent?.trim(),
    }));
  `);

  if (!btns[index]) {
    console.error('❌ suki button not found at index', index);
    return;
  }

  if (btns[index].liked) {
    console.log(`💚 already liked (count: ${btns[index].count})`);
    return;
  }

  await evaluate(client, `document.querySelectorAll('.o-noteLikeV3__iconButton')[${index}]?.click()`);
  await sleep(1000);

  const after = await evaluate(client, `
    document.querySelectorAll('.o-noteLikeV3__count')[${index}]?.textContent?.trim()
  `);
  console.log(`💚 スキ! (${btns[index].count} → ${after})`);
}

async function unsuki(client, index = 0) {
  const liked = await evaluate(client, `
    document.querySelectorAll('.o-noteLikeV3__iconButton')[${index}]?.getAttribute('aria-pressed')
  `);

  if (liked !== 'true') {
    console.log('🤍 not liked');
    return;
  }

  await evaluate(client, `document.querySelectorAll('.o-noteLikeV3__iconButton')[${index}]?.click()`);
  await sleep(1000);
  console.log('🤍 unsuki');
}

// --- Scraping ---

async function feed(client, limit = 10) {
  const articles = await evaluate(client, `
    Array.from(document.querySelectorAll('.m-noteBody, article, [class*="note-card"]')).slice(0, ${limit}).map((a, i) => {
      const title = a.querySelector('h3, [class*="title"]')?.textContent?.trim();
      const author = a.querySelector('[class*="creator"], [class*="author"]')?.textContent?.trim();
      const likes = a.querySelector('.o-noteLikeV3__count, [class*="like"] [class*="count"]')?.textContent?.trim();
      const link = a.querySelector('a[href*="/n/"]')?.href;
      return { index: i, title: title?.slice(0, 60), author: author?.slice(0, 30), likes, url: link };
    });
  `);

  if (!articles || articles.length === 0) {
    console.log('📝 No articles found on current page');
    return;
  }

  console.log(`📝 ${articles.length} articles:`);
  articles.forEach(a => {
    console.log(`  [${a.index}] ${a.title || '(no title)'}`);
    console.log(`       ${a.author || ''} | 💚${a.likes || '?'}`);
  });
}

async function articleDetail(client) {
  const detail = await evaluate(client, `
    const title = document.querySelector('h1, .o-noteTitle')?.textContent?.trim();
    const author = document.querySelector('.o-noteContentHeader__name, [class*="creatorName"]')?.textContent?.trim();
    const body = document.querySelector('.note-common-styles__textnote-body, .p-article__content')?.textContent?.trim();
    const likes = document.querySelector('.o-noteLikeV3__count')?.textContent?.trim();
    const liked = document.querySelector('.o-noteLikeV3__iconButton')?.getAttribute('aria-pressed') === 'true';
    JSON.stringify({ title, author, body: body?.slice(0, 500), likes, liked });
  `);

  if (!detail) {
    console.log('❌ No article found on current page');
    return;
  }

  const d = JSON.parse(detail);
  console.log(`📖 ${d.title}`);
  console.log(`   by ${d.author} | 💚${d.likes} ${d.liked ? '(liked)' : ''}`);
  console.log(`   ${d.body?.slice(0, 200)}...`);
}

async function search(client, query, limit = 10) {
  await evaluate(client, `window.location.href = 'https://note.com/search?q=${encodeURIComponent(query)}&context=note'`);
  await sleep(3000);

  const results = await evaluate(client, `
    Array.from(document.querySelectorAll('a[href*="/n/"]')).slice(0, ${limit}).map((a, i) => {
      const container = a.closest('[class*="card"], [class*="item"], article') || a;
      const title = container.querySelector('h3, [class*="title"]')?.textContent?.trim() || a.textContent?.trim();
      return { index: i, title: title?.slice(0, 60), url: a.href };
    }).filter(r => r.title);
  `);

  console.log(`🔍 ${results?.length || 0} results for "${query}":`);
  (results || []).forEach(r => {
    console.log(`  [${r.index}] ${r.title}`);
    console.log(`       ${r.url}`);
  });
}

async function navigate(client, path) {
  const url = path.startsWith('http') ? path : `https://note.com/${path}`;
  await evaluate(client, `window.location.href = '${url}'`);
  await sleep(3000);
  const title = await evaluate(client, 'document.title');
  console.log(`🔗 ${title}`);
}

// --- Command Router ---

const commands = {
  suki:     { fn: (c, args) => suki(c, parseInt(args[0]) || 0),                  usage: 'suki [index]' },
  unsuki:   { fn: (c, args) => unsuki(c, parseInt(args[0]) || 0),                usage: 'unsuki [index]' },
  feed:     { fn: (c, args) => feed(c, parseInt(args[0]) || 10),                 usage: 'feed [limit]' },
  detail:   { fn: (c, args) => articleDetail(c),                                  usage: 'detail' },
  search:   { fn: (c, args) => search(c, args[0], parseInt(args[1]) || 10),      usage: 'search <query> [limit]' },
  navigate: { fn: (c, args) => navigate(c, args[0]),                              usage: 'navigate <path|url>' },
  eval:     { fn: async (c, args) => { console.log(await evaluate(c, args.join(' '))); }, usage: 'eval <js>' },
};

module.exports = { connect, commands };
