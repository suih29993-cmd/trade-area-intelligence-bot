# District Health Studio · 商圈健康度诊断工作台（公开作品集版）

一个面向公开作品集展示的商圈诊断 Demo：用合成门店数据完成单商圈诊断、多商圈对比、健康度拆解、竞品压力分析、活动力度分析、SVG 地图交互和结构化诊断对话。

> **数据说明**：项目内置 4 个虚构商圈、42 家虚构门店。所有门店名称、地址、订单、配送费、活动、健康度和排名均为合成数据，不代表任何真实品牌、真实门店或真实经营结果。

> **公开版边界**：本目录是独立重建的作品集副本，不包含原项目的源码、真实业务数据、运行日志、本地配置或 Git 历史。原项目的实时地图、实时搜索和在线对话能力未被复制到默认演示流程中；本版本以本地 SVG 地图和确定性规则引擎提供同等可展示的分析链路。

## 项目定位

这个项目展示的是一条完整的分析产品链路，而不是单个图表：

- 把门店级原始记录整理为可复用的指标层。
- 用可解释的多维评分描述商圈健康度。
- 在同一套指标上提供单商圈诊断和多商圈对比。
- 用本地 SVG 地图呈现门店覆盖、3 km 范围和点位详情。
- 用确定性规则引擎生成结构化诊断建议。
- 提供 JSON 导入导出、字段校验、异常提示和本地持久化。
- 用 Python 标准库提供本地服务、静态资源白名单和安全响应头。

## 原始能力映射

| 原始项目能力 | 公开版实现 |
| --- | --- |
| 商圈地图与门店点位 | 本地 SVG 虚构网格地图，不加载地图瓦片或外部脚本 |
| 单商圈诊断 | 合成焦点品牌、竞品结构和五维健康度诊断 |
| 多商圈对比 | 2–5 个虚构商圈的排名、总览表、雷达图和体量图 |
| 竞品压力与活动力度 | 双渠道配送费、活动覆盖、活动深度和竞品密度指标 |
| 在线 AI 对话 | 默认使用浏览器内规则引擎，输出“摘要—证据—风险—建议” |
| 实时数据/实时 AI | 可选、服务端配置、默认关闭，仅发送当前合成商圈的聚合指标 |
| 数据导入导出 | 本地 JSON 导入、schema 校验、异常提示和合成数据导出 |
| Key 配置 | 浏览器不保存凭证；实时模式只读取服务端环境变量 |

## 界面预览

以下截图均由本项目在本地运行时生成，页面数据全部来自合成数据集，不包含真实门店或真实经营记录。

### 单商圈诊断

![单商圈诊断桌面视图](docs/screenshots/dashboard-desktop.png)

### 多商圈对比

![多商圈对比桌面视图](docs/screenshots/compare-desktop.png)

### 移动端布局

![单商圈诊断移动端视图](docs/screenshots/dashboard-mobile.png)

## 功能

### 单商圈诊断

- 商圈总览、健康度仪表盘和五维指标拆解。
- 焦点品牌门店数量、核心圈（≤1 km）与外围（1–3 km）分布。
- 竞品门店数、竞品品牌数、品牌模拟月售和压力标签。
- 双渠道配送费、活动覆盖率和活动深度对比。
- 可点击的合成地图点位、门店详情和列表联动。
- 基于当前商圈指标生成高/中/低优先级建议。

### 多商圈对比

- 选择 2–5 个虚构商圈。
- 健康度排名、覆盖、低竞对压力、活动、销售、配送六维雷达图。
- 对比总览表，自动标记每项指标的最优值。
- 模拟订单体量条形图。
- 从对比卡片或表头直接跳回单商圈详情。

### 诊断对话

- 浏览器内运行的本地规则引擎，不依赖外部 AI 服务。
- 支持竞争、活动、覆盖、配送、销售五类问题意图。
- 输出统一结构：摘要、证据、风险、建议。
- 实时 AI 为可选能力，默认关闭；启用后失败会自动回退本地规则引擎。

### 数据导入导出

- 支持粘贴 JSON 或选择本地 JSON 文件。
- 最多 50 家门店、单文件 60 KB、最多保留 3 个导入商圈。
- 校验字段、字符串长度、坐标范围、订单量、配送费、活动深度和红包值。
- 拒绝包含 HTML 标签或控制字符的字符串。
- 导入数据只写入浏览器 `localStorage`，不上传。

## 技术实现

- **前端**：原生 HTML、CSS、JavaScript；无框架、无 CDN、无第三方地图。
- **可视化**：手写 SVG 仪表盘、条形图、雷达图和虚构网格地图。
- **分析层**：`js/engine.js`，浏览器与 Node 测试共用同一套指标逻辑。
- **对话层**：`js/advisor.js`，确定性意图识别与结构化建议生成。
- **服务端**：`server.py`，Python 标准库 `ThreadingHTTPServer`。
- **测试**：Python `unittest` + Node 内置 `node:test`。

## 快速开始

### 环境要求

- Python 3.10+
- Node.js 18+（仅运行 JavaScript 测试时需要）
- PowerShell 5.1+（Windows 启动脚本）

### 启动

```powershell
cd portfolio-ready\district-health-studio-public
powershell -ExecutionPolicy Bypass -File .\scripts\run_demo.ps1
```

脚本会在 `127.0.0.1:8137` 启动本地服务并打开浏览器。也可以手动启动：

```powershell
python server.py --port 8137
```

访问 `http://127.0.0.1:8137/index.html`。不要直接双击 `index.html`，因为页面需要通过本地服务读取合成数据集。

### 停止

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop_demo.ps1
```

停止脚本只读取本项目 `runtime/server.pid`，并核对进程命令行是否指向本项目的 `server.py`；不会按端口误杀其他程序。

## 测试

```powershell
cd portfolio-ready\district-health-studio-public
python -m unittest discover -s tests -v
node --test tests\engine.test.js
python tools\check_public_safety.py
```

测试覆盖：

- 合成数据 schema、数量、坐标范围和角色分布。
- 分析结果确定性、五维指标和核心圈划分。
- 多商圈排名与最优值一致性。
- 导入校验、超大输入、危险 HTML 字符和示例文件。
- 诊断助手结构化输出。
- 本地 API、静态文件白名单、目录穿越拦截、CSP、请求体上限和无 CORS。
- 公开安全检查：无凭证模式、无个人信息路径、无外部资源地址、无运行时敏感目录，并验证合成数据边界。

完整结果见 `TEST_REPORT.md`，审计结论见 `SECURITY_AUDIT.md`。

## 数据模型

数据文件：`data/demo_districts.json`

```json
{
  "schemaVersion": 1,
  "dataClass": "synthetic",
  "channels": ["Marketplace A", "Marketplace B"],
  "districts": [
    {
      "id": "harbor-central",
      "name": "Harbor Central",
      "shortName": "Harbor",
      "description": "Fictional waterfront district.",
      "center": { "x": 0, "y": 0 },
      "coverageRadiusKm": 3,
      "stores": [
        {
          "id": "harbor-central-ns-01",
          "role": "focus",
          "brand": "Northstar Tea",
          "name": "Northstar Tea · Harbor Core 1",
          "x": 0.42,
          "y": -0.18,
          "distanceKm": 0.46,
          "address": "Unit 12, Harbor Walk (fictional)",
          "monthlyOrders": 640,
          "channels": {
            "Marketplace A": {
              "deliveryFee": 2.5,
              "promotionPct": 16,
              "promotionLabel": "Spend 25 save 4",
              "couponValue": 3
            }
          }
        }
      ]
    }
  ]
}
```

### 坐标约定

项目不使用真实经纬度。每个商圈使用以中心点为原点的局部平面坐标：

- `x`、`y` 单位为 km。
- 取值范围 `-3.1` 到 `3.1`。
- 距离中心不超过 3 km 才允许进入演示数据。
- 页面上的网格地图只表达相对位置，不代表真实地理位置。

### 重新生成合成数据

```powershell
python tools\generate_demo_data.py
```

生成器使用固定种子、虚构商圈参数和确定性公式，不读取任何外部数据、数据库或 API。重复运行会得到同一份数据。

数据来源、合成规则、边界和复现实验见 `docs/DATA_CARD.md`。

## 健康度模型

五个维度均归一化到 0–100，分数越高越好：

| 维度 | 权重 | 计算思路 |
| --- | ---: | --- |
| 门店覆盖 | 20% | 焦点门店数、核心圈门店数、与竞品门店数的差距 |
| 低竞对压力 | 20% | 竞品门店数、头部竞品门店数，焦点门店数做反向修正 |
| 活动力度 | 20% | 焦点品牌与竞品的活动覆盖率差、活动深度差 |
| 销售体量 | 25% | 焦点品牌模拟订单占商圈模拟总订单的比例 |
| 配送体验 | 15% | 焦点品牌平均配送费、与竞品平均配送费的差距 |

综合健康度是五维加权和。评分用于演示“如何把业务问题拆成可解释维度”，不是行业标准，也不能用于真实经营决策。

完整公式与解释见 `docs/METHODOLOGY.md`。

## 默认安全运行

- 首次启动即进入演示模式，页面不调用地图搜索、网页搜索或 AI API。
- 页面不包含 Key、`securityJsCode`、Authorization 头或供应商凭证。
- 导入数据只保存在当前浏览器的 `localStorage`，不会上传到外部服务。
- 本地服务仅绑定 `127.0.0.1`，不启用 CORS，不监听局域网或公网。
- 请求日志只记录时间、来源、方法、脱敏路径和状态码，不记录查询字符串、请求体或请求头。
- `.env.example` 只是占位模板，服务端不会自动读取 `.env`；实时模式必须由使用者在启动前显式设置进程环境变量。

## 诊断对话与可选实时 AI

默认情况下，对话完全在浏览器内完成：

- 不调用地图服务。
- 不调用网页搜索。
- 不调用任何 AI API。
- 不读取或保存 API Key。

如果需要在本地演示中接入自己的兼容接口，可在启动服务前设置服务端环境变量：

```powershell
$env:ENABLE_LIVE_AI = "1"
$env:LIVE_AI_BASE_URL = "<your-https-base-url>"
$env:LIVE_AI_API_KEY = "<your-server-side-key>"
$env:LIVE_AI_MODEL = "<your-model-name>"
python server.py --port 8137
```

约束：

- 必须同时设置 `ENABLE_LIVE_AI=1` 和三个配置项才会启用。
- Key 只存在服务端进程环境变量中，不进入浏览器、源码、示例文件或日志。
- 服务端只发送当前虚构商圈的聚合指标和用户问题。
- 导入的本地商圈不会发送到实时接口，始终使用本地规则引擎。
- 接口失败时返回通用错误码，并回退本地规则引擎。
- 仅接受 HTTPS 基础地址，拒绝 localhost、私网地址和 URL 内嵌账号密码。
- 该模式不会读取浏览器中的任何凭证，也不会发送导入的数据。

## 安全设计

- 服务只绑定 `127.0.0.1`，不监听公网地址。
- 静态文件使用后缀白名单和目录白名单，阻断 `.env`、源码、测试、工具和运行时目录。
- 解析后的路径必须仍位于项目根目录内，防止目录穿越。
- 不启用 CORS，不返回 `Access-Control-Allow-Origin`。
- 统一设置 CSP、`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy` 和 `Permissions-Policy`。
- 请求体上限 16 KB，消息长度上限 500 字符。
- 日志只记录时间、来源地址、方法、路径、状态码，不记录查询字符串、请求体、请求头或凭证。
- 页面不加载外部脚本、样式、字体、地图瓦片或图片。
- 前端不使用 `innerHTML`，所有数据通过 `textContent` 渲染。
- 导入数据拒绝 HTML 标签和控制字符。

更多说明见 `SECURITY.md`、`SECURITY_AUDIT.md` 和 `docs/DATA_CARD.md`。

## 目录结构

```text
district-health-studio-public/
  index.html
  css/style.css
  js/engine.js
  js/advisor.js
  js/app.js
  data/demo_districts.json
  examples/import_example.json
  tools/generate_demo_data.py
  tools/check_public_safety.py
  server.py
  scripts/run_demo.ps1
  scripts/stop_demo.ps1
  tests/engine.test.js
  tests/test_server.py
  docs/METHODOLOGY.md
  docs/DATA_CARD.md
  docs/PORTFOLIO_NOTES.md
  README.md
  SECURITY.md
  SECURITY_AUDIT.md
  TEST_REPORT.md
  .env.example
  .gitignore
```

## 适用边界

- 这是一个公开演示项目，不是生产级 BI、选址系统或经营决策系统。
- 合成数据只用于验证指标计算、交互和工程实现。
- 没有真实用户体系、权限系统、数据库或多租户隔离。
- 本地服务不应直接暴露到公网。
- 如果接入真实数据，需要重新做合规评估、访问控制、审计和密钥管理。

## 简历描述

见 `docs/PORTFOLIO_NOTES.md`。描述只强调实现能力和工程范围，不包含真实业务成果或未经验证的量化收益。
