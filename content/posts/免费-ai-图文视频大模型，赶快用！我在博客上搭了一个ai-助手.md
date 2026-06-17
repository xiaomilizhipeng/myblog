---
title: "免费 AI 图文视频大模型，赶快用！我在博客上搭了一个AI 助手"
date: 2026-06-17
author: "小鹏视界"
categories: ["转载"]
tags: ["微信公众号"]
description: "我用免费 AI 模型，在自己的博客上搭了一个全功能 AI 助手大家好，我是小鹏，一个喜欢折腾技术的全栈开发工"
original_url: "https://mp.weixin.qq.com/s/-0HtGlU3F7amMXQp8QDhCw"
---

# 我用免费 AI 模型，在自己的博客上搭了一个全功能 AI 助手

大家好，我是小鹏，一个喜欢折腾技术的全栈开发工程师。

今天给大家分享一下我最近搞的一个项目——在自己的个人博客上集成了一套 AI 助手，支持智能对话、图片生成、视频生成，而且用的是目前免费的 Agnes AI 模型，零成本就能跑起来。

## 先说说我的博客

我的博客地址是 https://jiapeng.tech，用 Hugo 搭建的，部署在阿里云服务器上，通过 nginx 托管，已经完成了 ICP 备案（鄂ICP备2025147544号-3）。文章底部，点击阅读原文即可查看。

![](https://mmbiz.qpic.cn/mmbiz_png/dgxggcWiaXCBqAulUiay57YZmNVxgseWwUjJhAEibiaKu2ygLL5Bdyl2jTor2rt9icjanusym9k2GsfuoTzd6MrG6Xcazj5PlcOGU3A8GRLia8tTA/640?wx_fmt=png&from=appmsg)

博客主要分享三个方向的内容：

- • AI 前沿：大模型、AI Agent、最新的技术动态
- • 数码科技：小米生态、数码产品评测
- • 生活感悟：跑步、旅行、日常随笔

之前博客就是一个纯静态的内容站点，最近我给它加了一个大杀器——AI 助手。

## 什么是《小鹏同学》AI 助手？

在博客右上角导航栏，有一个「AI 助手」入口，点进去就是一个完整的 AI 聊天界面，我给它起了个名字叫《小鹏同学》。

![](https://mmbiz.qpic.cn/sz_mmbiz_png/dgxggcWiaXCBwwPwnQdT5x4HtnF7DcOibnZKib4n3Z16H8uBICFicJkJr3WibDiamqiaDBmImvficQjQp29KuHURQA6eg8InkiccqPKuWeos1FVloJrM/640?wx_fmt=png&from=appmsg)

它不是简单的聊天机器人，而是一个多功能 AI 工具，支持三大核心功能：

### 💬 智能对话

支持多轮对话，AI 会记住上下文。回复是流式输出的打字机效果，逐字显示，体验很流畅。

而且不只是纯文字聊天——你可以上传图片，让 AI 看图分析内容。比如拍张菜单让它翻译，拍张植物让它识别，都可以。

回复内容支持完整的 Markdown 渲染，标题、代码块、表格、列表都能正常显示，不会看到一堆星号和井号。

### 🖼️ 图片生成

输入一段描述，AI 就能生成对应的图片。支持多种尺寸比例：

- • 1:1 — 正方形，适合头像、社交媒体
- • 4:3 / 3:4 — 横版/竖版，适合文章配图
- • 16:9 / 9:16 — 宽屏/竖屏，适合封面、短视频封面

更厉害的是，你还可以上传一张参考图，让 AI 基于参考图的风格或内容来生成新图片。比如上传一张风景照，告诉它"把天空换成星空"，它就能生成一张保留原图构图、但天空变成星空的新图。

### 🎬 视频生成

输入一段描述，AI 会生成一段视频。这个功能用的是异步接口——提交任务后，系统会自动轮询等待生成完成，你不用手动刷新，等一会儿视频就出来了。

同样支持上传首帧图片，让 AI 基于图片生成视频。

## 技术实现

### 前端

整个 AI 助手是一个独立的 HTML 页面（ai.html），不依赖任何前端框架，纯原生 JavaScript 实现。主要特性：

- • 暗色/亮色主题切换 — 右上角一键切换，记住用户偏好
- • 响应式设计 — 手机、平板、电脑都能用
- • 流式输出 — 基于 SSE（Server-Sent Events）实现打字机效果
- • Markdown 渲染 — 用 marked.js 渲染 AI 回复
- • 图片上传 — 支持拖拽、点击上传，所有模式通用
- • 频率限制 — 前端 3 秒冷却 + 后端每分钟 20 次限制，防止滥用

### 后端

后端是一个轻量的 Node.js 服务，负责：

- • API 代理 — 隐藏 API Key，前端不暴露任何密钥
- • 流式转发 — 对话接口支持 SSE 流式透传
- • 异步轮询 — 视频生成自动轮询结果，前端只需等待
- • 频率限制 — 基于 IP 的 rate limit，保护接口不被刷

后端通过 systemd 管理，开机自启，挂了自动重启。

### 模型：Agnes AI（目前免费！）

重点来了——我用的模型是 Agnes AI，这是一个 AI 模型网关平台，目前提供的模型完全免费！

![](https://mmbiz.qpic.cn/mmbiz_png/dgxggcWiaXCAEQAmNt4TfzE0WibRZPtohsmqbxD8AFN1EIGuhjibPjcUsnJxNsTiak1yDibYCS4hvzdhiamDZXHdlMjR8Pz4GsR4KxdicNZ3zpc1XQ/640?wx_fmt=png&from=appmsg)

功能模型说明对话Agnes-2.0-Flash快速、可靠的对话模型图片Agnes-Image-2.1-Flash文生图 + 图生图视频Agnes-Video-V2.0文生视频，支持首帧图API 兼容 OpenAI 格式，接入非常简单。注册就能拿到 API Key，没有充值门槛，对个人开发者和小项目来说简直是福音。

> 如果后续 Agnes 开始收费了，���为接口是 OpenAI 兼容的，换其他模型也只需要改一下配置文件。

### 部署架构

```
用户浏览器    ↓nginx (jiapeng.tech)    ├── /ai.html → 静态页面    └── /api/ai/* → Node.js 后端 (端口 3900)            ↓        Agnes AI API Gateway
```

整个部署非常轻量，一台 2 核 4G 的阿里云 ECS 就够了。

## 怎么体验？

直接打开 https://jiapeng.tech/ai.html 就能用，不需要注册、不需要登录。

也欢迎关注我的微信公众号《小鹏视界》，我会在上面分享更多 AI 技术文章和实用工具。

如果你也是开发者，想在自己的博客上加一个类似的 AI 助手，源码已经开源在 GitHub：

- • https://github.com/xiaomilizhipeng/myblog

前端就一个 HTML 文件，后端一个 Node.js 服务，改改配置就能跑起来。

## 最后

AI 工具不应该是高高在上的东西，应该是能融入日常、随手可用的助手。我在博客上加这个 AI 助手，就是想让每一个访问我博客的人，都能直接体验到 AI 的能力。

不用注册，不用付费，打开就能用。

欢迎来 https://jiapeng.tech/ai.html 体验，也欢迎关注公众号《小鹏视界》，一起探索 AI 的更多可能。如果你对这些同样感兴趣，欢迎加入小鹏户外科技后花园，聊聊AI科技、聊聊武汉周边户外、聊聊代码之外的生活~

![](https://mmbiz.qpic.cn/mmbiz_jpg/dgxggcWiaXCA0C1V2MQB3Dloe6SoiccIIX3gzexia90RAicff1ooDeLePicc8ADEZZJonMDV1pQoISFdN8ZiczNvowKS7f9iayex9P2lsgRjJeSxd4/640?wx_fmt=jpeg)

> 作者：李志鹏 | 公众号：《小鹏视界》计算机硕士，AI 全栈开发工程师，数码科技爱好者武汉米粉同城会 | 退役大学生士兵