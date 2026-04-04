const { connectToTab, evaluate } = require('./core/cdp');

(async () => {
  const client = await connectToTab('x.com');
  const result = await evaluate(client, `
    (function() {
      var links = document.querySelectorAll('a[href*="/status/"]');
      var seen = {};
      var urls = [];
      links.forEach(function(l) {
        var m = l.href.match(/\\/status\\/(\\d+)/);
        if (m && !seen[m[1]]) {
          seen[m[1]] = true;
          urls.push(l.href);
        }
      });
      return JSON.stringify(urls.slice(0, 20));
    })()
  `);
  console.log(result);
  await client.close();
})().catch(e => console.error(e));
