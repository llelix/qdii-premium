const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  brightRed: '\x1b[31;1m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

const ANSI_RE = /\u001b\[[0-9;]*m/g;

function stripAnsi(text) {
  return String(text).replace(ANSI_RE, '');
}

function visibleWidth(text) {
  return stripAnsi(text).length;
}

function pad(text, width, align = 'left') {
  const visible = stripAnsi(text);
  const padWidth = Math.max(0, width - visible.length);
  if (align === 'right') return `${' '.repeat(padWidth)}${text}`;
  return `${text}${' '.repeat(padWidth)}`;
}

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

function displayTable(funds, indices, dataSource = '同花顺问财') {
  const indexNames = {
    nasdaq: '📈 纳斯达克100',
    sp500: '📊 标普500',
    dow: '🏢 道琼斯',
    us50: '🇺🇸 美国50',
  };

  const targetIndices = indices || Object.keys(indexNames);

  console.log('\n' + colorize('═'.repeat(120), 'cyan'));
  console.log(colorize('  QDII基金溢价率查询', 'cyan') + colorize(`  (数据来源: ${dataSource})`, 'gray'));
  console.log(colorize('═'.repeat(120), 'cyan'));

  let hasData = false;

  for (const idx of targetIndices) {
    const idxFunds = funds.filter(f => f.index === idx);
    if (idxFunds.length === 0) continue;

    hasData = true;
    console.log(`\n${colorize(indexNames[idx] || idx, 'yellow')}`);
    console.log(colorize('─'.repeat(120), 'gray'));

    const header =
      pad(colorize('代码', 'cyan'), 10) +
      pad(colorize('名称', 'cyan'), 22) +
      pad(colorize('现价', 'cyan'), 10, 'right') +
      pad(colorize('净值', 'cyan'), 10, 'right') +
      pad(colorize('溢价率', 'cyan'), 12, 'right') +
      pad(colorize('净值日期', 'cyan'), 12, 'right') +
      pad(colorize('涨跌', 'cyan'), 10, 'right');

    console.log(header);
    console.log(colorize('─'.repeat(120), 'gray'));

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

      const row =
        pad(f.code, 10) +
        pad(f.name.substring(0, 20), 22) +
        pad(price, 10, 'right') +
        pad(nav, 10, 'right') +
        pad(premium, 12, 'right') +
        pad(navDate, 12, 'right') +
        pad(indexChg, 10, 'right');

      console.log(row);
    }
  }

  if (!hasData) {
    console.log(colorize('\n未找到匹配的基金数据', 'yellow'));
  }

  console.log('\n' + colorize('═'.repeat(120), 'cyan'));
  console.log(colorize('提示: 溢价率 > 3% 为偏高, > 5% 为高溢价风险', 'yellow'));
  console.log(colorize('═'.repeat(120), 'cyan') + '\n');
}

function displayJson(funds) {
  console.log(JSON.stringify(funds, null, 2));
}

module.exports = { displayTable, displayJson, formatPremium };
