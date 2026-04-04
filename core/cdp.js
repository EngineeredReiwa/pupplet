const CDP = require('chrome-remote-interface');

const CDP_PORT = parseInt(process.env.CDP_PORT || '9222');

async function connectToTab(urlPattern) {
  const targets = await CDP.List({ port: CDP_PORT });
  const target = targets.find(t => t.url.includes(urlPattern) && t.type === 'page');

  if (target) {
    const client = await CDP({ port: CDP_PORT, target });
    await client.Runtime.enable();
    return client;
  }

  // タブが見つからなければ新規作成
  const tmp = await CDP({ port: CDP_PORT });
  const url = urlPattern.includes('://') ? urlPattern : `https://${urlPattern}`;
  await tmp.Target.createTarget({ url });
  await sleep(3000);

  const targets2 = await CDP.List({ port: CDP_PORT });
  const target2 = targets2.find(t => t.url.includes(urlPattern) && t.type === 'page');
  if (target2) {
    await tmp.close();
    const client = await CDP({ port: CDP_PORT, target: target2 });
    await client.Runtime.enable();
    return client;
  }

  await tmp.Runtime.enable();
  return tmp;
}

async function evaluate(client, expression) {
  const result = await client.Runtime.evaluate({
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || 'JS evaluation error');
  }
  return result.result.value;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = { connectToTab, evaluate, sleep, CDP_PORT };
