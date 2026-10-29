# ltl-frontend（React + Vite + Tailwind CSS）

## 技术栈

- **React 18 + Vite**：前端框架与构建工具
- **Tailwind CSS**：响应式样式（支持暗色模式）
- **React Router**：页面路由
- **原生 WebSocket**：实时通信

## 目录结构

```
ltl-frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx             # 路由
│   ├── config.js           # API_BASE / WS_BASE 环境变量读取
│   ├── api/                # REST 请求封装（fetch + JWT）
│   │   └── client.js
│   ├── ws/                 # WebSocket 连接管理
│   │   └── client.js
│   ├── hooks/              # 自定义 hooks
│   │   └── useTheme.js
│   ├── pages/
│   │   ├── Login.jsx       # 登录/注册
│   │   └── Chat.jsx        # 聊天主界面
│   ├── components/
│   │   ├── Sidebar.jsx     # 会话列表（移动端为抽屉）
│   │   ├── MessageItem.jsx # 单条消息（文本/图片/语音/文件）
│   │   ├── MessageInput.jsx # 文字 + 图片/语音/文件发送
│   │   ├── VoiceRecorder.jsx # 按住录音
│   │   ├── GroupModal.jsx  # 群聊管理弹窗
│   │   ├── LazyImage.jsx   # 图片懒加载
│   │   └── ...
│   └── index.css           # Tailwind 入口 + 自定义动画
├── public/                 # 静态资源
├── index.html
├── package.json
├── vite.config.js          # 开发代理到后端 :8000
├── vercel.json             # Vercel 部署配置
├── .env                    # 本地开发环境变量（不提交 git）
└── .env.production         # 生产环境变量模板（不提交 git）
```

## 本地开发

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

`.env` 已配好本地开发（留空走 Vite 代理到 `localhost:8000`）：

```ini
VITE_API_BASE=
VITE_WS_BASE=
```

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173。

> 需要先启动后端服务（见后端 README），前端通过 `vite.config.js` 代理到 `localhost:8000`。

---

## 部署到 Vercel

### 1. 前置准备

1. https://vercel.com → **Continue with GitHub** 一键登录
2. 后端已经部署好并拿到地址（如 `https://ltl-chat-backend.onrender.com`）

### 2. 配置环境变量

编辑 `.env.production`，把 `VITE_API_BASE` / `VITE_WS_BASE` 指向你的后端：

```ini
VITE_API_BASE=https://ltl-chat-backend.onrender.com
VITE_WS_BASE=wss://ltl-chat-backend.onrender.com
```

> 这两个变量是 **Vite 构建时**注入到 JS 里的，改完要重新构建/部署才生效。

### 3. 配置文件（已就绪）

仓库里 `vercel.json` 已经配好：

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" }
      ]
    }
  ]
}
```

> `rewrites` 是 SPA 路由的关键：所有路径都回退到 `index.html`，否则刷新 `/chat` 会 404。

### 4. 部署

#### 方式 A：GitHub 集成（推荐，push 自动部署）

1. 把代码 push 到 GitHub
2. Vercel 控制台 → **Add New...** → **Project**
3. 选你的仓库 → **Import**
4. **Configure Project** 页面：
   - **Framework Preset**：自动识别为 **Vite**
   - **Root Directory**：留空（仓库根目录就是前端代码）
   - **Build Command**：`npm run build`（从 `vercel.json` 读）
   - **Output Directory**：`dist`（从 `vercel.json` 读）
5. **Environment Variables** 区块点 **Add**，加两条：
   - `VITE_API_BASE` = 你的后端地址
   - `VITE_WS_BASE` = 你的后端 WS 地址
6. 点 **Deploy**

> 之后每次 `git push` 到主分支，Vercel 都会自动重新构建部署。

#### 方式 B：Vercel CLI（本地一键）

```bash
npm i -g vercel
vercel login        # 浏览器授权
vercel              # 预览部署（测试用）
vercel --prod       # 正式部署
```

> CLI 会自动读 `vercel.json` 和 `.env.production`，不用手动指定参数。

### 5. 验证部署

部署完成后 Vercel 会分配一个域名，形如 `https://ltl-frontend.vercel.app`。

1. 浏览器打开 → 注册账号 → 登录
2. 打开 DevTools → Network 看：
   - `POST https://<你的后端>/api/auth/login` 应 200
   - `wss://<你的后端>/ws?token=...` 应 101 Switching Protocols
3. 发条消息试试实时性

### 6. 自定义域名（可选）

1. Vercel 控制台 → **Project** → **Settings** → **Domains**
2. 输入你的域名（如 `chat.example.com`）→ **Add**
3. 到你的 DNS 服务商那里加一条 **CNAME** 记录指向 `cname.vercel-dns.com`
4. Vercel 会自动申请 Let's Encrypt HTTPS 证书（通常 1-2 分钟生效）

### 7. 环境变量管理

Vercel 控制台 → **Project** → **Settings** → **Environment Variables**：

| 变量 | 示例值 | 说明 |
| --- | --- | --- |
| `VITE_API_BASE` | `https://ltl-chat-backend.onrender.com` | 后端 HTTP API 地址 |
| `VITE_WS_BASE` | `wss://ltl-chat-backend.onrender.com` | 后端 WebSocket 地址 |

> 可以给不同环境配不同值：
> - **Production**：生产域名用的值
> - **Preview**：PR 预览部署用的值（可以指向测试后端）
> - **Development**：本地 `vercel dev` 用的值

改完后到 **Deployments** 标签页点最新部署右侧的 **⋯** → **Redeploy** 强制重新构建。

### 8. 常见问题

| 现象 | 原因 | 解决 |
| --- | --- | --- |
| 刷新页面 404 | 没配 SPA 重写 | 检查 `vercel.json` 里 `rewrites` 是否生效 |
| 构建成功但页面空白 | `VITE_API_BASE` 没注入 | 检查环境变量名是否以 `VITE_` 开头；改完要 **Redeploy** |
| WS 连不上 | 后端不支持 `wss://` 或 CORS | 后端已 `allow_origins=["*"]`，检查后端地址是否写错 |
| 构建失败 | `package-lock.json` 没提交 | 确保仓库里有 `package-lock.json` |

---

## 本地预览生产构建

部署前想本地验证一下：

```bash
npm run build
npm run preview   # 或 npx vite preview
```

默认跑在 http://localhost:4173，可以检查：
- 构建产物是否正常
- `.env.production` 里的变量是否生效
- 刷新任意路由是否不 404（`vite preview` 默认支持 SPA fallback）

---

## 完整环境变量参考

**Vercel 环境变量**：

```ini
VITE_API_BASE=https://ltl-chat-backend.onrender.com
VITE_WS_BASE=wss://ltl-chat-backend.onrender.com
```

**本地开发 `.env`**：

```ini
# 留空走 Vite 代理
VITE_API_BASE=
VITE_WS_BASE=
```
