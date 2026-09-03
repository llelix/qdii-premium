const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  brightRed: '\x1b[31;1m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function colorize(text, color) {
  return `${colors[color] || ''}${text}${colors.reset}`;
}

function formatPremium(premium) {
  if (premium === null || premium === undefined) return 'N/A';
  const pct = `${premium >= 0 ? '+' : ''}${premium.toFixed(2)}%`;
  if (premium > 5) return colorize(pct, 'brightRed');
  if (premium > 3) return colorize(pct, 'red');
  if (premium > 1) return colorize(pct, 'yellow');
  if (premium < -1) return colorize(pct, 'green');
  return pct;
}

function displayTable(funds, indices, dataSource = 'HaoETF') {
  const indexNames = {
    nasdaq: '📈 纳斯达克100',
    sp500: '📊 标普500',
    dow: '🏢 道琼斯',
    us50: '🇺🇸 美国50',
  };

  const targetIndices = indices || Object.keys(indexNames);

  console.log('\n' + colorize('═'.repeat(110), 'cyan'));
  console.log(colorize('  QDII基金溢价率查询', 'cyan') + colorize(`  (数据来源: ${dataSource})`, 'gray'));
  console.log(colorize('═'.repeat(110), 'cyan'));

  let hasData = false;

  for (const idx of targetIndices) {
    const idxFunds = funds.filter(f => f.index === idx);
    if (idxFunds.length === 0) continue;

    hasData = true;
    console.log(`\n${colorize(indexNames[idx] || idx, 'yellow')}`);
    console.log(colorize('─'.repeat(110), 'gray'));
    console.log(
      colorize('代码', 'cyan').padEnd(10) +
      colorize('名称', 'cyan').padEnd(20) +
      colorize('现价', 'cyan').padStart(8) +
      colorize('净值', 'cyan').padStart(8) +
      colorize('溢价率', 'cyan').padStart(12) +
      colorize('净值日期', 'cyan').padStart(10) +
      colorize('涨跌', 'cyan').padStart(10)
    );
    console.log(colorize('─'.repeat(110), 'gray'));

    for (const f of idxFunds) {
      const premium = f.realTimePremium !== null ? formatPremium(f.realTimePremium) : 'N/A';
      const price = f.price !== null && f.price !== undefined ? f.price.toFixed(3) : 'N/A';
      const nav = f.nav !== null && f.nav !== undefined ? f.nav.toFixed(4) : 'N/A';
      const navDate = f.navDate || '-';
      let indexChg = '-';
      if (f.indexChange !== null && f.indexChange !== undefined) {
        const val = Number(f.indexChange);
        if (!isNaN(val)) {
          const pct = (val * 100).toFixed(2);
          indexChg = (val >= 0 ? '+' : '') + pct + '%';
        }
      }

      console.log(
        f.code.padEnd(10) +
        f.name.substring(0, 18).padEnd(20) +
        price.padStart(8) +
        nav.padStart(8) +
        premium.padStart(12) +
        navDate.padStart(10) +
        indexChg.padStart(10)
      );
    }
  }

  if (!hasData) {
    console.log(colorize('\n未找到匹配的基金数据', 'yellow'));
  }

  console.log('\n' + colorize('═'.repeat(110), 'cyan'));
  console.log(colorize('提示: 溢价率 > 3% 为偏高, > 5% 为高溢价风险', 'yellow'));
  console.log(colorize('═'.repeat(110), 'cyan') + '\n');
}

function displayJson(funds) {
  console.log(JSON.stringify(funds, null, 2));
}

module.exports = { displayTable, displayJson, formatPremium };
