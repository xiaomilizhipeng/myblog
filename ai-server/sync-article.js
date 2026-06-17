/**
 * 公众号文章同步脚本
 * 接收微信文章链接 → 抓取内容 → 转 Markdown → 保存到博客
 */

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const BLOG_POSTS_DIR = path.join(__dirname, '..', 'content', 'posts');

// 请求页面内容
function fetchPage(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      }
    }, (res) => {
      // 处理重定向
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchPage(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('请求超时')); });
  });
}

// HTML 转 Markdown（简单实现）
function htmlToMarkdown(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  // 微信文章内容在 #js_content 里
  let content = $('#js_content').html() || $('article').html() || $('body').html() || '';

  // 重新 load 内容
  const $c = cheerio.load(content);

  // 移除脚本和样式
  $c('script, style, meta, link').remove();

  let md = '';

  function processNode(el) {
    const $el = $c(el);
    const tag = el.tagName?.toLowerCase();

    if (!tag) {
      const text = $el.text().trim();
      if (text) md += text;
      return;
    }

    // 标题
    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1]);
      md += '\n' + '#'.repeat(level) + ' ' + $el.text().trim() + '\n\n';
      return;
    }

    // 段落
    if (tag === 'p') {
      const text = $el.text().trim();
      if (text) {
        // 检查是否包含图片
        const imgs = $el.find('img');
        if (imgs.length > 0) {
          imgs.each((_, img) => {
            const src = $c(img).attr('data-src') || $c(img).attr('src') || '';
            if (src) md += '\n![](' + src + ')\n\n';
          });
        } else {
          md += text + '\n\n';
        }
      }
      return;
    }

    // 图片
    if (tag === 'img') {
      const src = $el.attr('data-src') || $el.attr('src') || '';
      if (src && !src.includes('data:image')) {
        md += '\n![](' + src + ')\n\n';
      }
      return;
    }

    // 列表
    if (tag === 'ul' || tag === 'ol') {
      $el.children('li').each((i, li) => {
        const prefix = tag === 'ol' ? `${i + 1}. ` : '- ';
        md += prefix + $c(li).text().trim() + '\n';
      });
      md += '\n';
      return;
    }

    // 引用
    if (tag === 'blockquote') {
      const lines = $el.text().trim().split('\n');
      lines.forEach(line => {
        if (line.trim()) md += '> ' + line.trim() + '\n';
      });
      md += '\n';
      return;
    }

    // 代码块
    if (tag === 'pre') {
      const code = $el.find('code').text() || $el.text();
      md += '\n```\n' + code.trim() + '\n```\n\n';
      return;
    }

    // 行内代码
    if (tag === 'code') {
      md += '`' + $el.text() + '`';
      return;
    }

    // 加粗
    if (tag === 'strong' || tag === 'b') {
      md += '**' + $el.text().trim() + '**';
      return;
    }

    // 斜体
    if (tag === 'em' || tag === 'i') {
      md += '*' + $el.text().trim() + '*';
      return;
    }

    // 链接
    if (tag === 'a') {
      const href = $el.attr('href') || '';
      const text = $el.text().trim();
      if (href && text) {
        md += '[' + text + '](' + href + ')';
      } else if (text) {
        md += text;
      }
      return;
    }

    // 分割线
    if (tag === 'hr') {
      md += '\n---\n\n';
      return;
    }

    // section / div / span 等容器 - 递归处理子节点
    $el.contents().each((_, child) => {
      processNode(child);
    });
  }

  $c('body').children().each((_, el) => {
    processNode(el);
  });

  // 清理多余空行
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

// 提取文章元信息
function extractMeta(html) {
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);

  const title = $('h1.rich_media_title').text().trim()
    || $('h1').first().text().trim()
    || $('title').text().trim()
    || '未命名文章';

  // 发布时间
  let date = '';
  const dateText = $('em#publish_time').text().trim()
    || $('span#publish_time').text().trim()
    || '';
  if (dateText) {
    // 格式: 2026-06-17
    const match = dateText.match(/(\d{4}-\d{2}-\d{2})/);
    if (match) date = match[1];
  }
  if (!date) {
    // 用今天日期
    const now = new Date();
    date = now.toISOString().split('T')[0];
  }

  // 作者
  const author = $('a#js_name').text().trim()
    || $('span.rich_media_meta_nickname').text().trim()
    || '小鹏';

  // 摘要
  const desc = $('meta[name="description"]').attr('content') || '';

  return { title, date, author, desc };
}

// 生成安全的文件名
function safeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 80)
    .toLowerCase();
}

// 主函数：同步文章
async function syncArticle(articleUrl) {
  console.log(`📥 正在抓取: ${articleUrl}`);

  // 1. 抓取页面
  const html = await fetchPage(articleUrl);
  console.log(`   页面大小: ${(html.length / 1024).toFixed(1)} KB`);

  // 2. 提取元信息
  const meta = extractMeta(html);
  console.log(`   标题: ${meta.title}`);
  console.log(`   日期: ${meta.date}`);

  // 3. 转 Markdown
  const content = htmlToMarkdown(html);
  console.log(`   内容长度: ${content.length} 字符`);

  if (content.length < 50) {
    throw new Error('抓取内容过少，可能是页面需要登录或被限制');
  }

  // 4. 生成 Hugo 文章
  const filename = safeFilename(meta.title);
  const filepath = path.join(BLOG_POSTS_DIR, `${filename}.md`);

  // 检查是否已存在
  if (fs.existsSync(filepath)) {
    console.log(`   ⚠️ 文件已存在，跳过: ${filepath}`);
    return { status: 'exists', filepath, title: meta.title };
  }

  const frontmatter = `---
title: "${meta.title.replace(/"/g, '\\"')}"
date: ${meta.date}
author: "${meta.author}"
categories: ["转载"]
tags: ["微信公众号"]
description: "${meta.desc.replace(/"/g, '\\"').substring(0, 200)}"
original_url: "${articleUrl}"
---

`;

  fs.writeFileSync(filepath, frontmatter + content, 'utf-8');
  console.log(`   ✅ 已保存: ${filepath}`);

  // 5. 重新部署 Hugo
  const { execSync } = require('child_process');
  try {
    execSync('cd ' + path.join(__dirname, '..') + ' && hugo --minify', { timeout: 30000 });
    console.log('   ✅ Hugo 重新部署完成');
  } catch (e) {
    console.log('   ⚠️ Hugo 部署失败:', e.message);
  }

  return { status: 'ok', filepath, title: meta.title };
}

// 导出
module.exports = { syncArticle };

// 命令行直接运行
if (require.main === module) {
  const url = process.argv[2];
  if (!url) {
    console.log('用法: node sync-article.js <公众号文章链接>');
    process.exit(1);
  }
  syncArticle(url)
    .then(r => console.log('\n完成:', JSON.stringify(r, null, 2)))
    .catch(e => console.error('\n失败:', e.message));
}
