const fs = require('fs');
const path = require('path');

function setApiKey(apiKey) {
  const envPath = path.join(__dirname, '..', '.env');
  let content = '';
  
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const regex = /^IWENCAI_API_KEY=.*$/m;
  if (regex.test(content)) {
    content = content.replace(regex, `IWENCAI_API_KEY=${apiKey}`);
  } else {
    if (content && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `IWENCAI_API_KEY=${apiKey}\n`;
  }

  fs.writeFileSync(envPath, content);
  console.log('✅ 同花顺 API Key 已保存到 .env 文件');
}

function getApiKey() {
  const envPath = path.join(__dirname, '..', '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ .env 文件不存在');
    console.log('   请先运行: qdii-premium config set-api-key <your-api-key>');
    process.exit(1);
  }

  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^IWENCAI_API_KEY=(.*)$/m);
  
  if (match && match[1]) {
    console.log('当前同花顺 API Key:', match[1]);
  } else {
    console.log('❌ .env 文件中未找到 IWENCAI_API_KEY');
    console.log('   请先运行: qdii-premium config set-api-key <your-api-key>');
    process.exit(1);
  }
}

module.exports = { setApiKey, getApiKey };
