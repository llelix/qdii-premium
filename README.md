# QDII基金溢价率查询CLI

从同花顺问财获取 QDII 基金实时溢价率，支持纳指、标普、道琼斯、美国50。

## 安装

```bash
npm install
npm link
```

## 使用方法

```bash
# 查看所有指数溢价率
qdii-premium

# 查看指定指数
qdii-premium --index=nasdaq
qdii-premium --index=sp500
qdii-premium --index=dow
qdii-premium --index=us50

# JSON 输出
qdii-premium --json
```

## 数据来源

- **同花顺问财**: https://www.iwencai.com

## 同花顺问财 API 配置

1. 访问 https://www.iwencai.com/skillhub 注册并获取 API Key
2. 设置环境变量：
   ```bash
   export IWENCAI_API_KEY=your_api_key
   export IWENCAI_BASE_URL=https://openapi.iwencai.com
   ```
3. 或直接写入 `~/.bashrc`：
   ```bash
   echo 'export IWENCAI_API_KEY=your_api_key' >> ~/.bashrc
   echo 'export IWENCAI_BASE_URL=https://openapi.iwencai.com' >> ~/.bashrc
   source ~/.bashrc
   ```

## 支持的基金

### 纳斯达克100
159941, 513100, 513300, 159501, 159632, 159659, 159513, 513110, 159696, 159660, 513390, 513870, 161130

### 标普500
513500, 513650, 159612, 159655, 161125, 161128, 159529, 501312

### 道琼斯
513400, 160140

### 美国50
513850, 159577

### 其他
513030, 159561, 513080, 513520, 513880, 513310



## 定时任务

已配置 crontab，每天 10:00 和 14:00 自动更新数据：

```bash
0 10,14 * * * cd /home/llelix/over-price && /usr/bin/env node src/index.js --update >> /home/llelix/over-price/data/cron.log 2>&1
```