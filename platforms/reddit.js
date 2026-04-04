const { connectToTab, evaluate, sleep } = require('../core/cdp');

async function connect() {
  return connectToTab('reddit.com');
}

async function feed(client, limit = 5) {
  const result = await evaluate(client, `
    (function() {
      var posts = document.querySelectorAll('shreddit-post');
      var out = [];
      for (var i = 0; i < Math.min(posts.length, ${limit}); i++) {
        var p = posts[i];
        out.push({
          index: i,
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
  const posts = JSON.parse(result);
  console.log(`📜 ${posts.length} posts:`);
  posts.forEach(p => {
    console.log(`  [${p.index}] ⬆${p.score} 💬${p.comments} ${p.subreddit}`);
    console.log(`       ${p.title.slice(0, 80)}`);
    console.log(`       by ${p.author} | ${p.type}`);
  });
  return posts;
}

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
  const result = await evaluate(client, `
    (function() {
      var posts = document.querySelectorAll('shreddit-post');
      if (!posts[${index}]) return JSON.stringify({ error: 'post not found at index ${index}' });
      var p = posts[${index}];
      var attrs = {};
      for (var j = 0; j < p.attributes.length; j++) {
        var a = p.attributes[j];
        if (['post-title','score','author','subreddit-prefixed-name','comment-count',
             'permalink','post-type','created-timestamp','id','domain'].indexOf(a.name) !== -1) {
          attrs[a.name] = a.value;
        }
      }
      // テキスト本文があれば取得
      var textBody = p.querySelector('[slot="text-body"]');
      if (textBody) attrs['text-body'] = textBody.textContent.trim().substring(0, 500);
      return JSON.stringify(attrs);
    })()
  `);
  const post = JSON.parse(result);
  if (post.error) {
    console.error('❌', post.error);
    return;
  }
  console.log(`📖 ${post['post-title']}`);
  console.log(`   ${post['subreddit-prefixed-name']} | by ${post.author}`);
  console.log(`   ⬆${post.score} 💬${post['comment-count']} | ${post['post-type']} | ${post.domain || ''}`);
  console.log(`   ${post.permalink}`);
  if (post['text-body']) {
    console.log(`\n   ${post['text-body'].slice(0, 300)}`);
  }
  return post;
}

async function comments(client, index = 0) {
  // 投稿のpermalinkに遷移してコメントを読み取る
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

  const { Page } = client;
  await Page.enable();
  await Page.navigate({ url: 'https://www.reddit.com' + permalink });
  await sleep(3000);

  const result = await evaluate(client, `
    (function() {
      var comments = document.querySelectorAll('shreddit-comment');
      var out = [];
      for (var i = 0; i < Math.min(comments.length, 20); i++) {
        var c = comments[i];
        out.push({
          index: i,
          author: c.getAttribute('author') || '',
          score: c.getAttribute('score') || '0',
          depth: c.getAttribute('depth') || '0',
          text: (function() {
            var tb = c.querySelector('[slot="comment"]');
            return tb ? tb.textContent.trim().substring(0, 200) : '';
          })(),
        });
      }
      return JSON.stringify(out);
    })()
  `);
  const cmts = JSON.parse(result);
  console.log(`💬 ${cmts.length} comments:`);
  cmts.forEach(c => {
    const indent = '  '.repeat(parseInt(c.depth) + 1);
    console.log(`${indent}[${c.index}] ${c.author} (⬆${c.score})`);
    console.log(`${indent}  ${c.text.slice(0, 100)}`);
  });
  return cmts;
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
  feed:     { fn: (c, args) => feed(c, parseInt(args[0]) || 5),      usage: 'feed [limit]' },
  upvote:   { fn: (c, args) => upvote(c, parseInt(args[0]) || 0),    usage: 'upvote [index]' },
  downvote: { fn: (c, args) => downvote(c, parseInt(args[0]) || 0),  usage: 'downvote [index]' },
  read:     { fn: (c, args) => read(c, parseInt(args[0]) || 0),      usage: 'read [index]' },
  comments: { fn: (c, args) => comments(c, parseInt(args[0]) || 0),  usage: 'comments [index]' },
  navigate: { fn: (c, args) => navigate_(c, args.join(' ')),          usage: 'navigate <subreddit>' },
  eval:     { fn: (c, args) => eval_(c, args.join(' ')),              usage: 'eval <js>' },
};

module.exports = { connect, commands };
