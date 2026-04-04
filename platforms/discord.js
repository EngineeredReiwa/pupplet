const { connectToTab, evaluate, sleep } = require('../core/cdp');

async function connect() {
  return connectToTab('discord.com');
}

// --- Helpers ---

async function typeText(client, text) {
  for (const ch of text) {
    await client.Input.dispatchKeyEvent({ type: 'keyDown', key: ch, text: ch });
    await client.Input.dispatchKeyEvent({ type: 'keyUp', key: ch });
    await sleep(50);
  }
}

async function pressEnter(client) {
  await client.Input.dispatchKeyEvent({ type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await client.Input.dispatchKeyEvent({ type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
}

function parseServerCard(text, name) {
  // "ServerNameDescription123人がオンライン456人" をパース
  var desc = text;
  if (name) desc = desc.replace(name, '');
  var onlineMatch = desc.match(/([\d,]+)人がオンライン/);
  var memberMatch = desc.match(/オンライン([\d,]+)人/);
  // English fallback
  if (!onlineMatch) onlineMatch = desc.match(/([\d,]+)\s*Online/);
  if (!memberMatch) memberMatch = desc.match(/Online\s*([\d,]+)\s*Members/);

  var online = onlineMatch ? onlineMatch[1] : '';
  var members = memberMatch ? memberMatch[1] : '';
  desc = desc.replace(/[\d,]+人がオンライン[\d,]+人/, '').replace(/[\d,]+\s*Online\s*[\d,]+\s*Members/, '').trim();
  return { description: desc.slice(0, 120), online, members };
}

// --- Commands ---

async function discover(client, query, limit = 10) {
  // Discovery ページに遷移
  const { Page } = client;
  await Page.enable();

  const currentUrl = await evaluate(client, 'location.href');
  if (!currentUrl.includes('discord.com/discovery')) {
    await Page.navigate({ url: 'https://discord.com/discovery/servers' });
    await sleep(2000);
  }

  if (query) {
    // 検索欄をクリア＆入力
    await evaluate(client, `
      (function() {
        var input = document.querySelector('input[aria-label="検索"], input[placeholder="検索"], input[type="text"]');
        if (input) { input.focus(); input.value = ''; }
      })()
    `);
    await sleep(300);
    await typeText(client, query);
    await pressEnter(client);
    await sleep(3000);
  }

  // サーバーカード取得
  const result = await evaluate(client, `
    (function() {
      var cards = document.querySelectorAll('[class*="card__84e3e"]');
      var out = [];
      for (var i = 0; i < Math.min(cards.length, ${limit}); i++) {
        var c = cards[i];
        var h2 = c.querySelector('h2');
        var details = c.querySelector('[class*="guildDetails"]');
        var verified = !!c.querySelector('[class*="verified"]');
        var partnered = !!c.querySelector('[class*="partnered"]');
        out.push({
          index: i,
          name: h2 ? h2.textContent.trim() : '',
          fullText: details ? details.textContent.trim() : '',
          verified: verified,
          partnered: partnered,
        });
      }
      return JSON.stringify(out);
    })()
  `);

  const servers = JSON.parse(result).map(s => {
    const parsed = parseServerCard(s.fullText, s.name);
    return {
      index: s.index,
      name: s.name,
      description: parsed.description,
      online: parsed.online,
      members: parsed.members,
      verified: s.verified,
      partnered: s.partnered,
    };
  });

  console.log(`🔍 ${servers.length} servers${query ? ` for "${query}"` : ''}:`);
  servers.forEach(s => {
    const badges = [s.verified ? '✅' : '', s.partnered ? '🤝' : ''].filter(Boolean).join('');
    console.log(`  [${s.index}] ${badges} ${s.name}`);
    console.log(`       ${s.description.slice(0, 80)}`);
    if (s.online || s.members) {
      console.log(`       🟢${s.online || '?'} online | 👥${s.members || '?'} members`);
    }
  });
  return servers;
}

async function joinServer(client, index = 0) {
  // Discovery上のサーバーカードをクリックして詳細ページに遷移
  await evaluate(client, `
    (function() {
      var cards = document.querySelectorAll('[class*="card__84e3e"]');
      if (cards[${index}]) cards[${index}].click();
    })()
  `);
  await sleep(2000);

  // 参加ボタンを探してクリック（まだ参加してない場合）
  const result = await evaluate(client, `
    (function() {
      // サーバー名取得
      var name = '';
      var h1 = document.querySelector('h1, [class*="guildName"], [class*="name"]');
      if (h1) name = h1.textContent.trim().substring(0, 60);

      // 参加ボタン
      var btns = document.querySelectorAll('button');
      var joinBtn = null;
      for (var i = 0; i < btns.length; i++) {
        var txt = btns[i].textContent.trim();
        if (txt === 'サーバーに参加' || txt === 'Join Server' || txt === '参加') {
          joinBtn = btns[i];
          break;
        }
      }
      if (joinBtn) {
        joinBtn.click();
        return JSON.stringify({ ok: true, name: name, action: 'joined' });
      }
      // 既に参加済み
      return JSON.stringify({ ok: true, name: name, action: 'already_joined' });
    })()
  `);
  const res = JSON.parse(result);
  if (res.action === 'joined') {
    console.log(`✅ joined: ${res.name}`);
  } else {
    console.log(`ℹ️  already in: ${res.name}`);
  }
  return res;
}

async function channels(client) {
  const result = await evaluate(client, `
    (function() {
      // チャンネル一覧 — aria-label にチャンネル名が入る
      var items = document.querySelectorAll('[class*="containerDefault"], [data-dnd-name]');
      var out = [];
      items.forEach(function(item, i) {
        var name = item.getAttribute('data-dnd-name') || '';
        var link = item.querySelector('a');
        var href = link ? link.getAttribute('href') : '';
        if (name) {
          out.push({ index: i, name: name, href: href });
        }
      });
      // fallback: aria-label
      if (out.length === 0) {
        document.querySelectorAll('[class*="name_"] [class*="channelName"],' +
          ' [class*="channel-"] a').forEach(function(el, i) {
          out.push({ index: i, name: el.textContent.trim().substring(0, 50), href: '' });
        });
      }
      return JSON.stringify(out);
    })()
  `);
  const chs = JSON.parse(result);
  console.log(`📂 ${chs.length} channels:`);
  chs.forEach(c => {
    console.log(`  [${c.index}] #${c.name}${c.href ? ' → ' + c.href : ''}`);
  });
  return chs;
}

async function messages(client, limit = 20) {
  const result = await evaluate(client, `
    (function() {
      var msgs = document.querySelectorAll('[id^="chat-messages-"]');
      var out = [];
      for (var i = Math.max(0, msgs.length - ${limit}); i < msgs.length; i++) {
        var m = msgs[i];
        var author = m.querySelector('[class*="username_"]');
        var content = m.querySelector('[id^="message-content-"]');
        var timestamp = m.querySelector('time');
        out.push({
          index: out.length,
          author: author ? author.textContent.trim() : '',
          text: content ? content.textContent.trim().substring(0, 300) : '',
          time: timestamp ? timestamp.getAttribute('datetime') : '',
        });
      }
      return JSON.stringify(out);
    })()
  `);
  const msgs = JSON.parse(result);
  console.log(`💬 ${msgs.length} messages:`);
  msgs.forEach(m => {
    const time = m.time ? new Date(m.time).toLocaleTimeString() : '';
    console.log(`  [${m.index}] ${m.author} ${time}`);
    if (m.text) console.log(`       ${m.text.slice(0, 100)}`);
  });
  return msgs;
}

async function send(client, text) {
  // メッセージ入力欄にテキストを入力して送信
  await evaluate(client, `
    (function() {
      var editor = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (editor) editor.focus();
    })()
  `);
  await sleep(200);
  await typeText(client, text);
  await sleep(300);
  await pressEnter(client);
  await sleep(500);
  console.log('✉️  sent:', text.slice(0, 60));
}

async function navigate_(client, path) {
  const { Page } = client;
  await Page.enable();
  const url = path.startsWith('http') ? path : 'https://discord.com' + (path.startsWith('/') ? path : '/' + path);
  await Page.navigate({ url });
  await sleep(2000);
  console.log('🔗 navigated to:', path);
}

async function eval_(client, js) {
  const result = await evaluate(client, js);
  console.log(result);
}

const commands = {
  discover: { fn: (c, args) => discover(c, args[0] || null, parseInt(args[1]) || 10),  usage: 'discover [query] [limit]' },
  join:     { fn: (c, args) => joinServer(c, parseInt(args[0]) || 0),                   usage: 'join [index]' },
  channels: { fn: (c, args) => channels(c),                                             usage: 'channels' },
  messages: { fn: (c, args) => messages(c, parseInt(args[0]) || 20),                    usage: 'messages [limit]' },
  send:     { fn: (c, args) => send(c, args.join(' ')),                                 usage: 'send <text>' },
  navigate: { fn: (c, args) => navigate_(c, args.join(' ')),                             usage: 'navigate <path>' },
  eval:     { fn: (c, args) => eval_(c, args.join(' ')),                                 usage: 'eval <js>' },
};

module.exports = { connect, commands };
