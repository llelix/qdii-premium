const https = require('https');
const http = require('http');
const crypto = require('crypto');
const { FUNDS } = require('./funds');

const IWENCAI_API_BASE = process.env.IWENCAI_BASE_URL || 'https://openapi.iwencai.com';

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const req = mod.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        let body = Buffer.concat(chunks).toString('utf8');
        if (options.headers && options.headers['Accept'] === 'application/json') {
          try {
            body = JSON.parse(body);
          } catch (e) {
            // keep as text if not json
          }
        }
        resolve({ status: res.statusCode, body });
      });
    });
    req.on('error', reject);
    if (options.timeout) req.setTimeout(options.timeout);
    if (options.body) req.write(options.body);
    req.end();
  });
}

function generateTraceId() {
  return crypto.randomBytes(32).toString('hex');
}

async function queryIwencai(query, apiKey, limit = 50) {
  const url = `${IWENCAI_API_BASE}/v1/query2data`;
  const payload = JSON.stringify({
    query,
    source: 'test',
    page: '1',
    limit: String(limit),
    is_cache: '0',
    expandIndex: 'true'
  });

  const traceId = generateTraceId();

  const { status, body } = await request(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'Accept': 'application/json',
      'X-Claw-Call-Type': 'normal',
      'X-Claw-Skill-Id': 'hithink-usstock-selector',
      'X-Claw-Skill-Version': '1.0.0',
      'X-Claw-Plugin-Id': 'none',
      'X-Claw-Plugin-Version': 'none',
      'X-Claw-Trace-Id': traceId
    },
    body: payload,
    timeout: 15000
  });

  if (status !== 200) {
    throw new Error(`iwencai API HTTP ${status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      throw new Error('iwencai API returned non-JSON response');
    }
  }

  return body;
}

function parseIwencaiFundData(data) {
  if (!data || data.status_code !== 0 || !Array.isArray(data.datas)) {
    return [];
  }

  return data.datas.map((row) => {
    const code = row['基金代码'] || row['code'] || '';
    const name = row['基金简称'] || row['基金名称'] || row['name'] || '';

    let premium = null;
    const premiumFields = ['溢价率', '折溢价率', 'IOPV溢折率', '基金折价率'];
    for (const field of premiumFields) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        premium = parseFloat(String(row[field]).replace('%', '').trim());
        break;
      }
    }

    if (premium === null) {
      const dynamicPremium = Object.keys(row).find(k => /^(基金@)?折溢价\[/.test(k) || /^(基金@)?溢价率\[/.test(k));
      if (dynamicPremium) {
        premium = parseFloat(String(row[dynamicPremium]).trim());
      }
    }

    let price = null;
    const priceFields = ['现价', '最新价', '当前价', '收盘价', '最新收盘价'];
    for (const field of priceFields) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        price = parseFloat(String(row[field]).trim());
        break;
      }
    }

    if (price === null) {
      const dynamicPrice = Object.keys(row).find(k => /^收盘价\[/.test(k) || /^现价\[/.test(k));
      if (dynamicPrice) {
        price = parseFloat(String(row[dynamicPrice]).trim());
      }
    }

    let nav = null;
    const navFields = ['净值', '单位净值', '最新净值', 'T-1日净值'];
    for (const field of navFields) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        nav = parseFloat(String(row[field]).trim());
        break;
      }
    }

    if (nav === null) {
      const dynamicNav = Object.keys(row).find(k => /^单位净值\[/.test(k) || /^最新净值\[/.test(k));
      if (dynamicNav) {
        nav = parseFloat(String(row[dynamicNav]).trim());
      }
    }

    let navDate = null;
    const navDateFields = ['净值日期', '估值日期', 'PDATE'];
    for (const field of navDateFields) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        navDate = String(row[field]).trim();
        break;
      }
    }

    if (navDate === null) {
      const dateMatch = Object.keys(row).find(k => /^(单位净值|收盘价|涨跌|折溢价)\[\d{8}\]$/.test(k));
      if (dateMatch) {
        const dateStr = dateMatch.match(/\[(\d{8})\]/);
        if (dateStr) {
          navDate = dateStr[1];
        }
      }
    }

    let indexChange = null;
    const indexChangeFields = ['指数涨跌', '涨跌', 'indexChange'];
    for (const field of indexChangeFields) {
      if (row[field] !== undefined && row[field] !== null && String(row[field]).trim() !== '') {
        const val = parseFloat(String(row[field]).trim());
        if (!isNaN(val)) {
          indexChange = val;
        }
        break;
      }
    }

    if (indexChange === null) {
      const dynamicIndexChange = Object.keys(row).find(k => /^涨跌\[/.test(k) || /^指数涨跌\[/.test(k));
      if (dynamicIndexChange) {
        const val = parseFloat(String(row[dynamicIndexChange]).trim());
        if (!isNaN(val)) {
          indexChange = val;
        }
      }
    }

    return {
      code: String(code).replace(/\.(SZ|SH|BJ)$/i, ''),
      name: String(name).trim(),
      premium,
      price,
      nav,
      navDate,
      indexChange,
      raw: row
    };
  });
}

async function fetchQDIIPremiumFromIwencai(apiKey) {
  if (!apiKey) {
    throw new Error('IWENCAI_API_KEY is required for iwencai data source');
  }

  const allCodes = Object.values(FUNDS)
    .flat()
    .map(f => f.code);
  
  const queries = [];
  const chunkSize = 8;
  for (let i = 0; i < allCodes.length; i += chunkSize) {
    const chunk = allCodes.slice(i, i + chunkSize).join(',');
    queries.push(`基金代码 ${chunk} 的溢价率 现价 净值`);
  }

  const allFunds = new Map();
  let lastError = null;

  for (const q of queries) {
    try {
      const data = await queryIwencai(q, apiKey, 50);
      const funds = parseIwencaiFundData(data);
      for (const f of funds) {
        if (!allFunds.has(f.code)) {
          allFunds.set(f.code, f);
        }
      }
    } catch (e) {
      lastError = e;
      continue;
    }
  }

  if (allFunds.size === 0 && lastError) {
    throw lastError;
  }

  return Array.from(allFunds.values());
}

module.exports = {
  fetchQDIIPremiumFromIwencai
};
