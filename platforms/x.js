const { connectToTab, evaluate, sleep } = require('../core/cdp');

async function connect() {
  return connectToTab('x.com');
}

async function tweet(client, text) {
  await evaluate(client, `
    document.querySelector('[data-testid="SideNav_NewTweet_Button"]').click();
  `);
  await sleep(1000);

  await evaluate(client, `
    const editor = document.querySelector('[data-testid="tweetTextarea_0"]');
    editor.focus();
    document.execCommand('insertText', false, ${JSON.stringify(text)});
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await sleep(500);

  await evaluate(client, `
    document.querySelector('[data-testid="tweetButton"]').click();
  `);
  await sleep(1000);

  console.log('✅ tweeted:', text.slice(0, 50) + (text.length > 50 ? '...' : ''));
}

async function like(client, index = 0) {
  const result = await evaluate(client, `
    (function() {
      var btns = document.querySelectorAll('[data-testid="like"]');
      if (btns[${index}]) {
        var text = btns[${index}].closest('article').querySelector('[data-testid="tweetText"]');
        btns[${index}].click();
        return JSON.stringify({ ok: true, tweet: text ? text.textContent.slice(0, 50) : '' });
      }
      return JSON.stringify({ error: 'like button not found at index ${index}' });
    })()
  `);
  const res = JSON.parse(result);
  if (res.ok) {
    console.log('❤️  liked:', res.tweet);
  } else {
    console.error('❌', res.error);
  }
}

async function unlike(client, index = 0) {
  const result = await evaluate(client, `
    (function() {
      var btns = document.querySelectorAll('[data-testid="unlike"]');
      if (btns[${index}]) {
        btns[${index}].click();
        return JSON.stringify({ ok: true });
      }
      return JSON.stringify({ error: 'unlike button not found at index ${index}' });
    })()
  `);
  const res = JSON.parse(result);
  if (res.ok) {
    console.log('💔 unliked');
  } else {
    console.error('❌', res.error);
  }
}

async function reply(client, text, index = 0) {
  await evaluate(client, `
    document.querySelectorAll('[data-testid="reply"]')[${index}].click();
  `);
  await sleep(1000);

  await evaluate(client, `
    const editor = document.querySelector('[data-testid="tweetTextarea_0"]');
    editor.focus();
    document.execCommand('insertText', false, ${JSON.stringify(text)});
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  `);
  await sleep(500);

  await evaluate(client, `
    document.querySelector('[data-testid="tweetButton"]').click();
  `);
  await sleep(1000);

  console.log('💬 replied:', text.slice(0, 50));
}

async function notifications(client, limit = 10) {
  await evaluate(client, `
    document.querySelector('[data-testid="AppTabBar_Notifications_Link"]').click();
  `);
  await sleep(2000);

  const result = await evaluate(client, `
    (function() {
      var articles = document.querySelectorAll('[data-testid="notification"]');
      var notifs = [];
      articles.forEach(function(a, i) {
        if (i < ${limit}) notifs.push({ index: i, text: a.textContent.slice(0, 200) });
      });
      return JSON.stringify(notifs);
    })()
  `);
  const notifs = JSON.parse(result);
  console.log(`📬 ${notifs.length} notifications:`);
  notifs.forEach(n => {
    console.log(`  [${n.index}] ${n.text.slice(0, 100)}`);
  });
}

async function timeline(client, limit = 5) {
  const result = await evaluate(client, `
    (function() {
      var articles = document.querySelectorAll('article');
      var tweets = [];
      articles.forEach(function(a, i) {
        if (i < ${limit}) {
          var text = a.querySelector('[data-testid="tweetText"]');
          var user = a.querySelector('[data-testid="User-Name"]');
          var liked = !!a.querySelector('[data-testid="unlike"]');
          tweets.push({ index: i, user: user ? user.textContent.slice(0, 50) : '', text: text ? text.textContent.slice(0, 150) : '', liked: liked });
        }
      });
      return JSON.stringify(tweets);
    })()
  `);
  const tweets = JSON.parse(result);
  console.log(`📜 ${tweets.length} tweets:`);
  tweets.forEach(t => {
    console.log(`  [${t.index}] ${t.liked ? '❤️' : '  '} ${t.user}`);
    console.log(`       ${t.text?.slice(0, 80)}`);
  });
}

async function navigate(client, path) {
  const { Page } = client;
  await Page.enable();
  await Page.navigate({ url: 'https://x.com' + (path.startsWith('/') ? path : '/' + path) });
  await sleep(2000);
  console.log('🔗 navigated to:', path);
}

async function eval_(client, js) {
  const result = await evaluate(client, js);
  console.log(result);
}

const commands = {
  tweet:         { fn: (c, args) => tweet(c, args.join(' ')),                   usage: 'tweet <text>' },
  like:          { fn: (c, args) => like(c, parseInt(args[0]) || 0),            usage: 'like [index]' },
  unlike:        { fn: (c, args) => unlike(c, parseInt(args[0]) || 0),          usage: 'unlike [index]' },
  reply:         { fn: (c, args) => reply(c, args.slice(0, -1).join(' ') || args[0], parseInt(args[args.length - 1]) || 0), usage: 'reply <text> [index]' },
  notifications: { fn: (c, args) => notifications(c, parseInt(args[0]) || 10),  usage: 'notifications [limit]' },
  timeline:      { fn: (c, args) => timeline(c, parseInt(args[0]) || 5),        usage: 'timeline [limit]' },
  navigate:      { fn: (c, args) => navigate(c, args[0]),                       usage: 'navigate <path>' },
  eval:          { fn: (c, args) => eval_(c, args.join(' ')),                   usage: 'eval <js>' },
};

module.exports = { connect, commands };
