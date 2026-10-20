# Test Report · Public Portfolio Edition

执行日期：2026-10-20  
执行环境：Windows PowerShell、Python 3.12.10、Node.js v24.19.0

## 结果总览

| 检查 | 结果 |
| --- | --- |
| Python 服务端测试 | 11 / 11 通过 |
| Node 分析与对话测试 | 6 / 6 通过 |
| Python / JavaScript 语法检查 | 通过 |
| 合成数据确定性复现 | 通过，SHA-256 未变化 |
| 独立进程 HTTP 冒烟测试 | 通过 |
| 项目自带启停脚本 | 通过 |
| 私密文件静态阻断 | 4 / 4 返回 404 |
| 默认实时 AI 状态 | 关闭，返回 `liveAIEnabled: false` |
| CORS | 未启用 |
| 安全响应头 | CSP 等响应头存在 |
| 公开安全检查脚本 | 通过，扫描 25 个文本文件，0 个问题 |

## 实际执行

### Python 测试

```powershell
python -m unittest discover -s tests -v
```

覆盖并通过：

- 健康检查、CSP 和默认演示模式。
- `/api/config` 不返回任何凭证。
- 合成数据类别与 4 个基础商圈。
- 实时 AI 默认禁用。
- 请求体大小限制。
- `.env`、源码、运行时日志、工具脚本和目录穿越路径不可访问。
- 静态首页、数据集和图标可访问。
- OPTIONS 不返回 CORS 许可。
- 未知 API 返回 JSON 404。
- 查询参数和 Authorization 头不会写入请求日志。
- 旧版带凭证的 GET 聊天路径不再支持，返回 404。

### Node 测试

```powershell
node --test tests\engine.test.js
```

覆盖并通过：

- 数据集 schema、42 家门店及 `synthetic` 标记。
- 单商圈分析确定性、五维指标和核心圈划分。
- 多商圈排名与最优值一致性。
- 导入校验拒绝 HTML 字符和超限门店。
- 示例导入文件可被接受。
- 本地对话返回结构化建议和意图相关证据。

### 语法与确定性

```powershell
python -m py_compile .\server.py .\tools\generate_demo_data.py .\tools\check_public_safety.py
node --check .\js\engine.js
node --check .\js\advisor.js
node --check .\js\app.js
python .\tools\generate_demo_data.py
```

结果：

- 语法检查通过。
- 数据生成前后 SHA-256 均为 `60A7CADD75707FC9B956A91021B58E8A3815434EC6853F98604C399A04A6E8DF`。
- 生成器输出 4 个虚构商圈、42 家虚构门店。

### 公开安全检查

```powershell
python tools\check_public_safety.py
```

结果：`PASS`。检查 25 个文本文件，未发现凭证模式、个人文件系统路径、非允许外部 URL 主机、旧版私有状态键、`.git`、`.env`、运行日志或缓存目录。

### HTTP 冒烟测试

以独立临时端口启动 `server.py`，实际请求结果：

- `/api/health`：200。
- `/index.html`：200。
- `/api/config`：`{"liveAIEnabled": false}`。
- `/api/districts`：200，返回合成数据集。
- `POST /api/chat`：409 `live_disabled`。
- `/server.py`、`/.env`、`/runtime/server.log`、`/tools/generate_demo_data.py`：均 404。
- 响应包含 CSP；未包含 `Access-Control-Allow-Origin`。

### 项目自带启停脚本

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\run_demo.ps1 -NoBrowser
powershell -ExecutionPolicy Bypass -File .\scripts\stop_demo.ps1
```

结果：

- 启动脚本输出 `Demo service ready`。
- `/api/health` 返回 `ok: true`、`mode: demo`、`liveAIEnabled: false`。
- 停止脚本只停止本项目记录的服务进程，并输出 `Demo service stopped`。

## 人工检查

- 检查了 3 张随项目提供的截图：桌面单商圈、桌面多商圈、移动端单商圈。
- 截图中的品牌、商圈、地址、地图点位和指标均为合成内容。
- 未发现真实品牌、真实地址、真实门店、个人姓名、电话或账号信息。
- 三张 PNG 均未包含 `tEXt`、`zTXt`、`iTXt` 或 `eXIf` 元数据块。
- 页面静态资源只引用同源文件；SVG 命名空间使用标准 `www.w3.org` URI，不产生网络请求。

## 未覆盖

- 未启用或调用真实 AI 接口；该能力默认关闭，且需要使用者自行提供服务端配置。
- 当前沙箱环境未能稳定运行无头浏览器截图回归，因此浏览器自动化 E2E 未作为通过项记录；页面资源、接口、分析逻辑和交互代码由上述测试覆盖，视觉资产已人工检查。
- 未做不同浏览器版本的视觉回归、无障碍审计、压力测试或生产级渗透测试。
- 未验证远程仓库、GitHub Actions、Fork 或 Release 附件的状态。

## 复现命令

```powershell
cd portfolio-ready\district-health-studio-public
python -m unittest discover -s tests -v
node --test tests\engine.test.js
python tools\check_public_safety.py
powershell -ExecutionPolicy Bypass -File .\scripts\run_demo.ps1
```
