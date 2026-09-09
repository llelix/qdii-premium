#!/usr/bin/env node
require('dotenv').config();
const { FUNDS } = require('./funds');
const { displayTable, displayJson, displayHistoryTable } = require('./display');
const { fetchQDIIPremiumFromIwencai } = require('./ths_wencai');
const { ensureDb, saveSnapshot, loadLatestFunds, loadFundHistory } = require('./db');

function normalizeIwencaiFund(fund) {
  const name = String(fund.name || '');
  let index = null;
  if (/纳斯达克|纳指|nasdaq/i.test(name)) index = 'nasdaq';
  else if (/标普|sp500|s&p/i.test(name)) index = 'sp500';
  else if (/道琼斯|dow|djia/i.test(name)) index = 'dow';
  else if (/美国50|us50|MSCI美国/i.test(name)) index = 'us50';
  else if (/德国|法国|日经|中韩|其他/i.test(name)) index = 'others';

  return {
    code: fund.code,
    name: fund.name,
    index,
    realTimePremium: fund.premium,
    latestPremium: fund.premium,
    navDate: fund.navDate,
    indexChange: fund.indexChange,
    price: fund.price,
    nav: fund.nav,
    raw: fund.raw
  };
}

function filterFundsByWhitelist(funds) {
  const whitelist = new Map();
  for (const [index, items] of Object.entries(FUNDS)) {
    for (const item of items) {
      whitelist.set(item.code, { ...item, index });
    }
  }

  const seen = new Set();
  return funds
    .map(f => {
      const base = whitelist.get(f.code);
      if (!base) return null;
      return {
        code: base.code,
        name: base.name,
        index: base.index,
        realTimePremium: f.realTimePremium,
        latestPremium: f.latestPremium,
        navDate: f.navDate,
        indexChange: f.indexChange,
        price: f.price,
        nav: f.nav,
        raw: f.raw
      };
    })
    .filter((f, idx, arr) => {
      if (!f) return false;
      const key = `${f.code}-${f.index}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function main() {
  const args = process.argv.slice(2);
  const helpArg = args.includes('-h') || args.includes('--help');

  if (helpArg) {
    console.log(`
QDII基金溢价率查询CLI

用法:
  qdii-premium [选项]

选项:
  -h, --help          显示帮助信息
  --index=<指数>       指定指数: nasdaq, sp500, dow, us50
  --code=<基金代码>     基金代码，配合 --history 使用
  --history           查看单个基金历史记录
  --update            从同花顺问财更新数据并保存到本地数据库
  --sync              同步本地数据到 Cloudflare D1
  --pull              从 Cloudflare D1 读取数据
  --json              JSON 格式输出
  --all               显示所有指数

示例:
  qdii-premium --index=nasdaq
  qdii-premium --code=159659 --history
  qdii-premium --update
  qdii-premium --sync
  qdii-premium --pull --index=sp500
`);
    return;
  }

  const indexArg = args.find(a => a.startsWith('--index='));
  const jsonOutput = args.includes('--json');
  const showAll = args.includes('--all');
  const updateArg = args.includes('--update');
  const syncArg = args.includes('--sync');
  const pullArg = args.includes('--pull');
  const codeArg = args.find(a => a.startsWith('--code='));
  const historyArg = args.includes('--history');

  let indices = null;
  if (indexArg) {
    const val = indexArg.split('=')[1];
    if (FUNDS[val]) {
      indices = [val];
    } else {
      console.log(`\n❌ 不支持的指数: ${val}`);
      console.log(`\n可用指数: ${Object.keys(FUNDS).join(', ')}`);
      process.exit(1);
    }
  }

  console.log('\n⏳ 正在获取QDII基金溢价率数据...');

  let funds = [];
  let dataSource = '同花顺问财';

  if (historyArg && codeArg) {
    const code = codeArg.split('=')[1];
    funds = await loadFundHistory(code);
    dataSource = '本地数据库';
    console.log(`✅ 成功获取基金 ${code} 的 ${funds.length} 条历史记录\n`);
    if (jsonOutput) {
      displayJson(funds);
    } else {
      displayHistoryTable(funds);
    }
    return;
  }

  if (updateArg) {
    const apiKey = process.env.IWENCAI_API_KEY;
    if (!apiKey) {
      console.log('❌ 使用同花顺数据源需要设置 IWENCAI_API_KEY 环境变量');
      console.log('   export IWENCAI_API_KEY=your_api_key');
      process.exit(1);
    }
    const rawFunds = await fetchQDIIPremiumFromIwencai(apiKey);
    const normalized = rawFunds.map(normalizeIwencaiFund);
    funds = filterFundsByWhitelist(normalized);
    await saveSnapshot(funds);
    console.log(`💾 已保存 ${funds.length} 只基金数据到本地数据库`);
  } else {
    funds = await loadLatestFunds();
    dataSource = '本地数据库';
  }

  if (funds.length === 0) {
    console.log('❌ 未能获取到任何基金数据，请检查网络连接或API Key');
    process.exit(1);
  }

  console.log(`✅ 成功获取 ${funds.length} 只基金数据\n`);

  if (jsonOutput) {
    displayJson(funds);
  } else {
    displayTable(funds, indices, dataSource);
  }
}

main().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
