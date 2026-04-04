const { connectToTab, evaluate, sleep } = require('../core/cdp');

async function connect() {
  return connectToTab('reddit.com');
}

// --- JSON API helpers ---

async function fetchJSON(client, url) {
  const result = await evaluate(client, `
    fetch('${url}', { headers: { 'Accept': 'application/json' } })
      .then(function(r) { return r.json(); })
      .then(function(d) { return JSON.stringify(d); })
  `);
  return JSON.parse(result);
}

function formatPost(data, index) {
  return {
    index,
    id: data.name,
    title: data.title || '',
    score: data.score || 0,
    author: data.author || '',
    subreddit: data.subreddit_name_prefixed || '',
    comments: data.num_comments || 0,
    type: data.post_hint || (data.is_self ? 'text' : 'link'),
    permalink: data.permalink || '',
    created: new Date(data.created_utc * 1000).toISOString(),
    url: data.url || '',
    selftext: data.selftext || '',
    domain: data.domain || '',
    upvoteRatio: data.upvote_ratio || 0,
  };
}

// --- Commands ---

async function feed(client, limit = 5, subreddit = null) {
  // サブレディット指定 → JSON API (ページネーション対応、大量取得OK)
  // ホームフィード → DOM (現在表示分のみ)
  if (subreddit) {
    return feedJSON(client, limit, subreddit);
  }

  // ホームフィードはまずDOMから取得を試みる
  const domPosts = await feedDOM(client, limit);
  return domPosts;
}

async function feedJSON(client, limit, subreddit) {
  const posts = [];
  let after = null;

  while (posts.length < limit) {
    const batchSize = Math.min(100, limit - posts.length);
    let url = `https://www.reddit.com/r/${subreddit}.json?limit=${batchSize}`;
    if (after) url += `&after=${after}`;

    const data = await fetchJSON(client, url);
    if (!data.data || !data.data.children || data.data.children.length === 0) break;

    data.data.children.forEach(c => {
      if (posts.length < limit) {
        posts.push(formatPost(c.data, posts.length));
      }
    });

    after = data.data.after;
    if (!after) break;
  }

  printPosts(posts);
  return posts;
}

async function feedDOM(client, limit) {
  const result = await evaluate(client, `
    (function() {
      var posts = document.querySelectorAll('shreddit-post');
      var out = [];
      for (var i = 0; i < posts.length; i++) {
        var p = posts[i];
        out.push({
          id: p.id,
          title: p.getAttribute('post-title') || '',
          score: p.getAttribute('score') || '0',
          author: p.getAttribute('author') || '',
          subreddit: p.getAttribute('subreddit-prefixed-name') || '',
          comments: p.getAttribute('comment-count') || '0',
          type: p.getAttribute('post-type') || '',
          permalink: p.getAttribute('permalink') || '',
          created: p.getAttribute('created-timestamp') || '',
        });
      }
      return JSON.stringify(out);
    })()
  `);
  const posts = JSON.parse(result).slice(0, limit).map((p, i) => ({ ...p, index: i }));
  printPosts(posts);
  return posts;
}

function printPosts(posts) {
  console.log(`📜 ${posts.length} posts:`);
  posts.forEach(p => {
    console.log(`  [${p.index}] ⬆${p.score} 💬${p.comments} ${p.subreddit}`);
    console.log(`       ${p.title.slice(0, 80)}`);
    console.log(`       by ${p.author} | ${p.type}`);
  });
}

async function search(client, query, limit = 10, subreddit = null) {
  const posts = [];
  let after = null;

  while (posts.length < limit) {
    const batchSize = Math.min(100, limit - posts.length);
    let url = subreddit
      ? `https://www.reddit.com/r/${subreddit}/search.json?q=${encodeURIComponent(query)}&restrict_sr=on&limit=${batchSize}`
      : `https://www.reddit.com/search.json?q=${encodeURIComponent(query)}&limit=${batchSize}`;
    if (after) url += `&after=${after}`;

    const data = await fetchJSON(client, url);
    if (!data.data || !data.data.children || data.data.children.length === 0) break;

    data.data.children.forEach(c => {
      if (posts.length < limit) {
        posts.push(formatPost(c.data, posts.length));
      }
    });

    after = data.data.after;
    if (!after) break;
  }

  console.log(`🔍 ${posts.length} results for "${query}":`);
  posts.forEach(p => {
    console.log(`  [${p.index}] ⬆${p.score} 💬${p.comments} ${p.subreddit}`);
    console.log(`       ${p.title.slice(0, 80)}`);
    console.log(`       by ${p.author}`);
  });
  return posts;
}

async function postDetail(client, permalink) {
  // permalink or post ID
  let url;
  if (permalink.startsWith('/r/')) {
    url = `https://www.reddit.com${permalink}.json`;
  } else if (permalink.startsWith('t3_')) {
    // IDからURLを構築できないのでJSON APIの info endpoint を使う
    url = `https://www.reddit.com/api/info.json?id=${permalink}`;
  } else {
    url = `https://www.reddit.com/r/${permalink}.json`;
  }

  const data = await fetchJSON(client, url);

  // commentsエンドポイントは配列を返す [post, comments]
  if (Array.isArray(data)) {
    const post = data[0].data.children[0].data;
    const cmts = data[1].data.children
      .filter(c => c.kind === 't1')
      .slice(0, 20)
      .map((c, i) => ({
        index: i,
        author: c.data.author,
        score: c.data.score,
        text: (c.data.body || '').slice(0, 200),
        depth: c.data.depth || 0,
      }));

    console.log(`📖 ${post.title}`);
    console.log(`   ${post.subreddit_name_prefixed} | by ${post.author}`);
    console.log(`   ⬆${post.score} 💬${post.num_comments} | ${post.domain || 'self'}`);
    if (post.selftext) console.log(`\n   ${post.selftext.slice(0, 300)}`);
    console.log(`\n💬 ${cmts.length} comments:`);
    cmts.forEach(c => {
      const indent = '  '.repeat(c.depth + 1);
      console.log(`${indent}[${c.index}] ${c.author} (⬆${c.score})`);
      console.log(`${indent}  ${c.text.slice(0, 100)}`);
    });
    return { post: formatPost(post, 0), comments: cmts };
  }

  return data;
}

// --- DOM actions (upvote/downvote require browser interaction) ---

async function upvote(client, index = 0) {
  const result = await evaluate(client, `
    (function() {
      var posts = document.querySelectorAll('shreddit-post');
      if (!posts[${index}]) return JSON.stringify({ error: 'post not found at index ${index}' });
      var p = posts[${index}];
      var sr = p.shadowRoot;
      if (!sr) return JSON.stringify({ error: 'no shadow root' });
      var btn = sr.querySelectorAll('button')[0];
      if (!btn) return JSON.stringify({ error: 'upvote button not found' });
      btn.click();
      return JSON.stringify({ ok: true, title: p.getAttribute('post-title').substring(0, 60) });
    })()
  `);
  const res = JSON.parse(result);
  if (res.ok) {
    console.log('⬆️  upvoted:', res.title);
  } else {
    console.error('❌', res.error);
  }
}

async function downvote(client, index = 0) {
  const result = await evaluate(client, `
    (function() {
      var posts = document.querySelectorAll('shreddit-post');
      if (!posts[${index}]) return JSON.stringify({ error: 'post not found at index ${index}' });
      var p = posts[${index}];
      var sr = p.shadowRoot;
      if (!sr) return JSON.stringify({ error: 'no shadow root' });
      var btn = sr.querySelectorAll('button')[1];
      if (!btn) return JSON.stringify({ error: 'downvote button not found' });
      btn.click();
      return JSON.stringify({ ok: true, title: p.getAttribute('post-title').substring(0, 60) });
    })()
  `);
  const res = JSON.parse(result);
  if (res.ok) {
    console.log('⬇️  downvoted:', res.title);
  } else {
    console.error('❌', res.error);
  }
}

async function read(client, index = 0) {
  // DOM上の投稿からpermalinkを取得してJSON APIで詳細取得
  const permalink = await evaluate(client, `
    (function() {
      var posts = document.querySelectorAll('shreddit-post');
      if (!posts[${index}]) return '';
      return posts[${index}].getAttribute('permalink') || '';
    })()
  `);
  if (!permalink) {
    console.error('❌ post not found at index', index);
    return;
  }
  return postDetail(client, permalink);
}

async function navigate_(client, path) {
  const { Page } = client;
  await Page.enable();
  const url = path.startsWith('http') ? path : 'https://www.reddit.com/' + (path.startsWith('r/') ? path : 'r/' + path);
  await Page.navigate({ url });
  await sleep(2000);
  console.log('🔗 navigated to:', path);
}

async function eval_(client, js) {
  const result = await evaluate(client, js);
  console.log(result);
}

const commands = {
  feed:     { fn: (c, args) => feed(c, parseInt(args[0]) || 5, args[1] || null),  usage: 'feed [limit] [subreddit]' },
  search:   { fn: (c, args) => search(c, args[0], parseInt(args[1]) || 10),       usage: 'search <query> [limit]' },
  read:     { fn: (c, args) => read(c, parseInt(args[0]) || 0),                   usage: 'read [index]' },
  detail:   { fn: (c, args) => postDetail(c, args.join(' ')),                      usage: 'detail <permalink>' },
  upvote:   { fn: (c, args) => upvote(c, parseInt(args[0]) || 0),                 usage: 'upvote [index]' },
  downvote: { fn: (c, args) => downvote(c, parseInt(args[0]) || 0),               usage: 'downvote [index]' },
  navigate: { fn: (c, args) => navigate_(c, args.join(' ')),                       usage: 'navigate <subreddit>' },
  eval:     { fn: (c, args) => eval_(c, args.join(' ')),                           usage: 'eval <js>' },
};

module.exports = { connect, commands };
