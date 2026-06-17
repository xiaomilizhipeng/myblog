/**
 * 小鹏同学 AI 助手 - 后端代理
 * 隐藏 API Key，转发请求到 Agnes AI
 *
 * 对话: Agnes-2.0-Flash → /v1/chat/completions
 * 图片: agnes-image-2.1-flash → /v1/images/generations
 * 视频: agnes-video-v2.0 → /v1/videos (异步任务)
 */

const http = require('http');
const https = require('https');
const url = require('url');

const PORT = process.env.AI_PORT || 3900;

// ========== Rate Limit ==========
const RATE_WINDOW = 60000; // 1 分钟窗口
const RATE_MAX = 20; // 每窗口最多 20 次请求
const rateMap = new Map(); // IP -> { count, resetAt }

function checkRateLimit(ip) {
  const now = Date.now();
  let entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + RATE_WINDOW };
    rateMap.set(ip, entry);
  }
  entry.count++;
  return entry.count <= RATE_MAX;
}

// 定期清理过期条目
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateMap) {
    if (now > entry.resetAt) rateMap.delete(ip);
  }
}, 60000);
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';
const AGNES_BASE = process.env.AGNES_BASE || 'https://apihub.agnes-ai.com';
const CHAT_MODEL = process.env.CHAT_MODEL || 'agnes-2.0-flash';
const IMAGE_MODEL = process.env.IMAGE_MODEL || 'agnes-image-2.1-flash';
const VIDEO_MODEL = process.env.VIDEO_MODEL || 'agnes-video-v2.0';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

function proxyRequest(targetUrl, data, method = 'POST') {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const isGet = method === 'GET';
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGNES_API_KEY}`
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(body) });
        } catch (e) {
          resolve({ status: res.statusCode, data: { raw: body } });
        }
      });
    });

    req.on('error', reject);
    if (!isGet && data) req.write(JSON.stringify(data));
    req.end();
  });
}

// ========== 流式代理函数 ==========
function streamProxy(targetUrl, data, res) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(targetUrl);
    const postData = JSON.stringify(data);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${AGNES_API_KEY}`,
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*'
    });

    const proxyReq = https.request(options, (proxyRes) => {
      proxyRes.on('data', (chunk) => {
        res.write(chunk);
      });
      proxyRes.on('end', () => {
        res.end();
        resolve();
      });
    });

    proxyReq.on('error', (err) => {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
      reject(err);
    });

    proxyReq.write(postData);
    proxyReq.end();
  });
}

// ========== 聊天接口（支持流式） ==========
async function handleChat(req, res) {
  const { messages, stream = false } = await parseBody(req);

  if (!AGNES_API_KEY) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      choices: [{ message: { role: 'assistant', content: '⚠️ 聊天功能需要配置 AGNES_API_KEY 环境变量。' } }]
    }));
    return;
  }

  try {
    if (stream) {
      // 流式输出
      await streamProxy(`${AGNES_BASE}/v1/chat/completions`, {
        model: CHAT_MODEL,
        messages: messages,
        stream: true
      }, res);
    } else {
      // 普通输出
      const result = await proxyRequest(`${AGNES_BASE}/v1/chat/completions`, {
        model: CHAT_MODEL,
        messages: messages
      });
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
    }
  } catch (err) {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  }
}

// ========== 图片生成接口 ==========
async function handleImage(req, res) {
  const { prompt, size = '1024x1024', image } = await parseBody(req);

  if (!AGNES_API_KEY) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      data: [{ url: `https://placehold.co/512x512/1a1a2e/6c63ff?text=${encodeURIComponent('需要配置API Key')}` }]
    }));
    return;
  }

  try {
    const payload = {
      model: IMAGE_MODEL,
      prompt: prompt,
      size: size,
      extra_body: { response_format: 'url' }
    };
    // 有参考图时走 Image-to-Image
    if (image) {
      payload.extra_body.image = [image];
    }
    const result = await proxyRequest(`${AGNES_BASE}/v1/images/generations`, payload);
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ========== 图片编辑接口（Image-to-Image） ==========
async function handleEdit(req, res) {
  const { prompt, image, size = '1024x1024' } = await parseBody(req);

  if (!AGNES_API_KEY) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '图片编辑功能需要配置 AGNES_API_KEY 环境变量' }));
    return;
  }

  if (!image) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '缺少图片参数' }));
    return;
  }

  try {
    const result = await proxyRequest(`${AGNES_BASE}/v1/images/generations`, {
      model: IMAGE_MODEL,
      prompt: prompt,
      size: size,
      extra_body: {
        image: [image],
        response_format: 'url'
      }
    });
    res.writeHead(result.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result.data));
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}


// ========== 视频生成接口（异步） ==========
async function handleVideo(req, res) {
  const { prompt, image_url } = await parseBody(req);

  if (!AGNES_API_KEY) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '视频功能需要配置 AGNES_API_KEY 环境变量' }));
    return;
  }

  try {
    // 1. 创建视频任务
    const payload = { model: VIDEO_MODEL, prompt: prompt };
    if (image_url) payload.image_url = image_url;

    const result = await proxyRequest(`${AGNES_BASE}/v1/videos`, payload);

    if (result.status !== 200 && result.status !== 201) {
      res.writeHead(result.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result.data));
      return;
    }

    const videoId = result.data?.video_id || result.data?.id;
    if (!videoId) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '未获取到 video_id', raw: result.data }));
      return;
    }

    // 2. 轮询等待视频生成完成（最多等 5 分钟）
    let videoUrl = null;
    let status = 'processing';
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 5000)); // 等 5 秒

      const query = await proxyRequest(
        `${AGNES_BASE}/agnesapi?video_id=${videoId}`,
        null, 'GET'
      );

      const data = query.data;
      status = data?.status || data?.task_status || 'unknown';

      if (status === 'completed' || status === 'success' || status === 'done') {
        // Agnes API 返回视频 URL 在 remixed_from_video_id 字段
        videoUrl = data?.video_url || data?.output?.video_url || data?.result?.video_url || data?.remixed_from_video_id;
        break;
      }
      if (status === 'failed' || status === 'error') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: '视频生成失败', detail: data }));
        return;
      }
    }

    if (videoUrl) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ data: [{ url: videoUrl }] }));
    } else {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: '视频生成超时，请稍后重试', video_id: videoId }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// ========== 路由 ==========
const server = http.createServer(async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Rate limit
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  if (!checkRateLimit(clientIp)) {
    res.writeHead(429, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: '请求太频繁，请稍后再试' }));
    return;
  }

  const pathname = url.parse(req.url).pathname;

  try {
    if (pathname === '/api/ai/chat' && req.method === 'POST') {
      await handleChat(req, res);
    } else if (pathname === '/api/ai/image' && req.method === 'POST') {
      await handleImage(req, res);
    } else if (pathname === '/api/ai/edit' && req.method === 'POST') {
      await handleEdit(req, res);
    } else if (pathname === '/api/ai/video' && req.method === 'POST') {
      await handleVideo(req, res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    }
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
});

server.listen(PORT, () => {
  console.log(`🤖 小鹏同学 AI 服务已启动 → http://localhost:${PORT}`);
  console.log(`   API Key: ${AGNES_API_KEY ? '✅ 已配置' : '❌ 未配置（请设置 AGNES_API_KEY）'}`);
  console.log(`   对话模型: ${CHAT_MODEL}`);
  console.log(`   图片模型: ${IMAGE_MODEL}`);
  console.log(`   视频模型: ${VIDEO_MODEL}`);
  console.log(`   端口: ${PORT}`);
});
