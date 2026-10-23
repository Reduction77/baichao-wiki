# 白潮 · 鸣潮资料站

深色蓝鸣潮资料站，原生 HTML/CSS/JavaScript，通过 GitHub Pages 发布。

https://reduction77.github.io/baichao-wiki/

## 当前数据来源

全部 64 个角色、133 件武器（含 9 件投影）、187 个声骸，以及合鸣与 148 种相关材料，由 [Arikatsu/WutheringWaves_Data](https://github.com/Arikatsu/WutheringWaves_Data/tree/9218d612ad815e398e064e577e42aaf878899968) 的游戏原始配置直接生成。固定提交为 `9218d612ad815e398e064e577e42aaf878899968`，游戏 3.7.0，资源修订 3.7.8，正式服。

文字与数值转换无需请求 nanoka，也不读取 nanoka 内容补字段。图片继续复用此前归档的 nanoka 本地素材。访问网站不需要连接上游。更新图片或新版本时，需要另行确认上游图像来源与本地覆盖；本次没有宣称图片来自 GitHub。

`tools/github_catalog_scope.json` 只保存本站公开条目的 ID 范围；转换所需内容全部读取固定提交的配置。角色称号缺失或为异常占位时隐藏。声骸改用游戏 ID 显示，旧站特有目录编号不在原始配置中。部分声骸采用上游原始名称。故事、Live2D、伤害拆分与推荐配装尚未提供。

## 本地恢复与检查

```bash
python3 tools/unpack_snapshot.py
python3 tools/unpack_character_icons.py
python3 tools/check_data.py
node tools/test_core.mjs
node tools/test_render.mjs
node tools/test_versions.mjs
node tools/test_beta_render.mjs
python3 -m http.server 8080 --directory web
```

`snapshots/` 中原有分片保留本地图片及旧快照，`snapshots/github-data/` 保存当前 GitHub 生成的 JSON，并在恢复时覆盖网站索引。网站的当前目录和来源声明只指向 GitHub 版本；旧快照仅作历史核对和图片归档，不用于当前页面的文字与数值。

程序渲染检查使用简化 DOM，不能替代浏览器视觉验收。

## 重新生成与保存

```bash
python3 tools/unpack_snapshot.py
python3 tools/unpack_character_icons.py
python3 tools/import_github_archive.py
python3 tools/check_data.py
python3 tools/pack_github_archive.py
git add snapshots/github-data
git commit -m "Rebuild pinned GitHub archive"
git push
```

首次生成会下载 GitHub 固定提交配置并保存输入文件 SHA256；后续使用 `.cache/arikatsu/<commit>/`。在 `#lab` 或当前快照的 `provenance.json` 查看完整来源、覆盖范围与核对结果。传入 `--compare --compare-snapshot <历史快照目录>` 可在独立生成后核对角色内容，核对不参与生成。

Actions 手动勾选 `refresh_data` 会从同一固定提交重新生成资料，**不会自动切换到上游最新提交，也不会提交回仓库**。要更新游戏版本，必须核对上游正式服状态，并同步转换脚本、版本标记、条目范围和图片覆盖，再验证发布。

原 `tools/sync_data.py` 与 `tools/sync_beta.py` 保留为历史工具，不再用于正式服发布刷新。

## 测试服与版本对比

入口 `#beta`。当前没有经过迁移核实的 GitHub 测试快照，测试列表为空。保留版本对比界面，支持属性、技能说明与倍率、共鸣链、突破材料等对比。同一主次版本正式服发布后，隐藏该版本及更早测试资料。测试样例只存在检查进程内存中，未作为真实资料发布。

## 页面功能

支持搜索、分类筛选、技能独立等级、简易说明、共鸣模态、突破前后属性、共鸣链、材料、武器谐振、声骸品质与合鸣效果、浏览器收藏。配队视频页按角色筛选，和角色页、配队工作台共用已收录的组合及攻略来源。

旧链接 `#character/1304?source=github` 保留今汐试验页兼容入口；普通角色页现已全部使用 GitHub 数据。`#lab` 展示全站迁移范围与历史对照结果。

## Pages 与域名

在 Settings → Pages 将发布来源设为 GitHub Actions。推送 main 自动恢复、检查并发布。

绑定 `wiki.winboard.top`：在 Pages 的 Custom domain 填入该域名，在 DNS 添加 CNAME，名称 `wiki`，目标 `reduction77.github.io`，验证后启用 HTTPS。域名解析由站长配置。

## 版权

《鸣潮》相关文字、数据、角色形象、图片及其他游戏素材的版权归库洛游戏（KURO GAMES）所有。本站为非官方资料站，与库洛游戏无官方隶属关系；资料仅作游戏信息展示与交流。数据来源标注不改变游戏内容的版权归属。LICENSE 仅覆盖本站原创代码、脚本与配置，不覆盖导入的游戏资料与素材。

## 核对上游与试导入新版本

选定正式服来源现在统一配置于 `tools/github_source.json`。完整提交 SHA、游戏版本、资源版本及 Release 状态必须与该提交 README 一致，导入会先验证再读取数据。

```bash
python3 tools/check_github_updates.py --output web/data/source-status.json --candidate .cache/candidate-source.json
python3 tools/import_github_archive.py --source-config .cache/candidate-source.json --preview --compare
```

检查器扫描最近 30 条提交，使用提交说明查找候选，再由原始 README 核实正式服状态。仅核对并生成候选配置，不更新来源或发布。来源页显示带时间的最近核对结果。

`--preview` 会生成独立候选目录、`candidate-index.json` 和 `provenance.json`，保留当前网站索引。报告列出新增角色/武器、字段差异与缺失本地图片。新增条目必须先更新范围配置，缺失图片须先补齐；正式导入遇到这些问题会停止。声骸范围仍需在新版本核对，未自动导入试用或活动配置。

确认候选后将配置写入 `tools/github_source.json`，更新条目范围及本地图片，重新导入、检查、打包并提交。无需修改脚本内的版本常量。今汐旧试验链接保留历史固定提交，普通今汐页面随全站配置更新。

Actions 手动运行新增 `check_upstream` 选项，默认核对上游并更新此次部署的核对时间；不切换正式服来源、不新增定时任务。检查器受 GitHub 网络及 API 配额影响，失败时不会发布该次构建。

## 默认发布顺序与测试服优先

首页角色档案与三类图鉴默认使用最新发布顺序，并优先展示尚未转正式服的测试新条目；首页同时提供近期武器、声骸卡片。仍可选择星级、名称或 ID 排序。正式服已存在的条目不被测试调整版重复替换，测试对比入口仍可查看这些调整。

排序记录独立保存在 `web/data/catalog-order.json`，不使用角色、武器或声骸的 ID 大小推断发布时间。角色使用游戏展示顺序并处理漂泊者新增属性；武器结合最早正式服快照和首次唤取配置序列；声骸按最早正式服快照归属版本排序。同版本同批声骸按名称稳定排列，不虚构精确发布日期。所有历史快照提交和输入文件校验值保存在排序记录内。

升级数据后运行 `python3 tools/build_catalog_order.py` 更新并提交排序记录；Actions 勾选 refresh_data 时会同步重建。首次需要下载公开 GitHub 历史配置，后续复用缓存；网页只读取已保存的排序 JSON。

现有测试来源仍为空。前端支持真实未来快照中新增 characters、weapons、echoes；对应的索引为 indexes.character、indexes.weapon、indexes.echo，也兼容旧角色 index。详情文件分别置于该版本目录下的 character、weapon、echo。未提供真实资料时不会生成测试卡片。已发布主次版本的测试资料仍会隐藏。

## 配队工作台

页面顶栏提供中文 / English 切换，语言选择保存在当前浏览器。导航、筛选、详情、配队工作台与站点说明会同步切换；搜索同时支持中文、英文和 ID，收藏及配队状态沿用相同 ID。B站原视频标题和 UP 名称保持原文。声骸卡片左上角显示 COST，编号在详情页显示。

英文游戏文本来自与当前快照相同固定提交的官方 `Textmaps/en`，不请求在线翻译服务。`python3 tools/build_locales.py` 生成 `web/data/locales/en.game.json.gz`，只有英文模式才下载并在浏览器解压；支持现代 Chrome、Edge、Firefox 和 Safari。更新游戏快照后同步运行该脚本并提交生成文件。界面译文位于 `web/assets/i18n-ui.js`，配队说明译文维护在 `tools/localization-editorial-en.json`，修改后重新生成语言包。执行 `node tools/test_i18n.mjs` 验证来源版本、切换、配置条件及 COST。

`core.js` 的 `imageLookupKey` 仅将游戏资源引用转换成已有图片索引使用的历史键。键中保留的 nanoka URL 不作为图片请求地址；实际 `src` 仍由索引解析为本地文件。更名保留了原索引兼容性。

入口 `#team-builder`，侧栏、配队视频页、首页及正式服角色页都可进入。角色页的“用此角色配队”会将该角色加入当前编队；工作台中的档案链接直接跳转现有角色详情。加入编队和打开档案是独立操作。

支持三人编队、位置调整、暂存和编辑多队、角色名称与 ID 搜索、定位和属性筛选、可用角色设置、普通模式去重、矩阵模式固定角色与期次额外角色的两次配额、浏览器自动保存、JSON 导入导出与 PNG 队伍图导出。JSON 导入通过校验后才替换现有内容；清空暂存队伍需要在页面确认。普通模式每角色限用一队，矩阵模式下穗穗、守岸人、维里奈、卜灵、莫宁、白芷每期各可用两次；本期琳奈额外两次，其余角色一次。模式或实际规则更新后保留已有队伍，并标记超过次数的角色，不会静默删除队伍。

角色定位由 `tools/build_team_profiles.py` 从当前游戏快照的 tag 字段生成，保存在 `web/data/team-builder.json`，包含固定提交来源。配队用途另行补充布兰特、尤诺、千咲的主 C 定位，布兰特优先显示为主力输出；游戏原始标签不变。千咲主 C 配队明确标注 3+1 及以上要求，辅助用途不套用此门槛。64 个原始角色 ID 合并同名男女漂泊者为 60 个角色形态；漂泊者所有属性共用可用开关和跨队配额，同队不可重复选用。工作台定位与推荐目前覆盖正式服；不会以无定位的测试资料推断适配关系。

推荐读取 `web/data/team-recommendations.json` 中有 B站来源的完整三人配队，不再按增益或体系标签拼接。单选主 C 或辅助可以双向推荐同队成员，选两人后只推荐同一条组合中的第三人；完整队伍不可用时不推荐其中的孤立候选。每条组合展示来源、作者、已知来源版本、配置待核实说明；旧版本教学和特定环境实战不代表当前最优。同一主 C 的不同体系独立记录，例如心的电磁队与同奏队。

维护推荐：在 `sources` 中填写真实 B站链接、作者、来源版本（未知填 null）、核对方式和日期，在 `teams` 中添加唯一 ID、三名角色的规范 ID、实际主 C 的 `mains`、体系、来源 ID、配置要求及参考类型；不要把未核实的共鸣链或武器条件写成低配保证。`coveredMains` 同步列出已覆盖的主 C。游戏资料刷新不会覆盖此人工维护配置。运行 `node tools/test_team_builder.mjs` 校验来源、角色、覆盖及匹配规则。

Excel 配队资料已合入上述配置：按三人角色集合合并队伍，多个主 C 入口共用同一组合。视频标题、作者与链接在 `sources` 按 BV 唯一保存；`sourceIds` 引用来源，`references` 为各来源补充 `kind`（教学、进阶、实战或特殊配置）及 `note`（共鸣链、充能、章节等条件）。一个视频包含多队时，由各队引用同一来源；未确认的分 P、时间点不生成跳转。只有完整三人组合进入推荐。

综合攻略、双人手法、低链机制等资料保存于 `team-recommendations.json` 的 `guides`：每条包含一个角色 ID、标题和 `references`，在该角色页及工作台显示，不用于凑成三人队。低链千咲机制视频仅作动作参考。配队视频页与角色页直接读取推荐配置，同时兼容管理后台维护的 `web/data/teams.json` 内联视频；相同队伍及同一视频不会重复展示。维护共用来源时修改 `sources`，无需在每支队伍中重复录入标题与链接。

浏览器旧版 schema 1/2/3 会迁移到 schema 4，保留队伍、草稿与可用角色，移除自定义次数、旧指定角色和期次选择，统一采用当前已确认的规则。`matrixPermanent` 定义六名固定两次角色；`matrixCurrent` 只记录本期额外两次角色（琳奈）。固定规则与临时规则不叠加，最多两次。界面仅注明本期规则，不提供期次选项，也不预设未来角色或规则。后续以实际规则为准更新配置。漂泊者共享 `rover`；超额队伍明确提示，不会自动删除。

更新数据、范围或定位转换时，运行 `python3 tools/build_team_profiles.py` 并提交生成结果；Actions 在恢复或刷新后会自动重建，再执行 `node tools/test_team_builder.mjs` 检查来源、双向推荐、配额、导入及界面事件。网页仅加载精简定位文件，不为配队工具额外请求全部角色详情，也不请求外部推荐接口。

迁移核对记录与维护细节见 [数据维护文档](docs/data-maintenance.md)。

## 管理后台与发布资料

管理程序独立维护在 [baichao-panel](https://github.com/Reduction77/baichao-panel)，本仓库只保存公开 Wiki 页面与资料。

- [下载 Windows 与服务器安装包](https://github.com/Reduction77/baichao-panel/releases/latest)：每个 Release 分别附 Windows 便携 ZIP 和服务器 TAR.GZ。
- [服务器部署与 NPM 配置](https://github.com/Reduction77/baichao-panel#服务器部署debian-13--docker-compose)：支持 Debian 13 / Docker Compose、管理员登录和 HTTPS 反向代理。
- Windows 版解压后双击 EXE；服务器版按 Panel README 配置 .env、管理员密码和 GitHub 令牌后部署。

后台只需授权此 Wiki 仓库的 GitHub 细粒度令牌：Contents 读写；如需查看部署进度，再开启 Actions 只读。不需要把管理程序、令牌、.env 或个人草稿提交到本仓库。

使用流程：从 GitHub 同步资料 → 编辑配队/推荐组合/矩阵次数 → 保存草稿 → 预览差异 → 确认发布 → 等待本仓库 Pages 工作流成功。保存草稿不会改变公开页面，后台停止运行也不影响 Wiki 访问。Windows 与服务器端分别保留草稿，发布前应同步最新版本，遇到冲突先导出备份再合并。

## 已审核的资料补充与 3.8.1 版本条目

正式服补充清单保存在 `tools/data/character-completions.json`，来源仍为当前固定 GitHub 提交。构建时在解包后执行 `python3 tools/complete_character_data.py`，补充已审核的 16 项独立参数（含男女漂泊者共 18 行），以及衍射漂泊者强化后的技能说明。原始压缩档案不变；同值参数备选行、声骸名称与分类不在这次补充范围内。脚本校验来源提交，更新固定来源后需重新审核补充清单。

`python3 tools/complete_character_data.py --build` 可根据固定原始配置重新生成并应用清单。`python3 tools/test_character_completions.py` 验证补充范围、重复应用及未授权字段保持一致。

`web/data/beta/3.8.1/` 保存 nanoka 3.8.1 的莉莉、安魂，以及锁暝与沉冥的版本变化，注册表为 `web/data/beta/index.json`。正式服数据不会被后续版本覆盖；入口沿用首页、图鉴及版本资料页，已有条目提供正式服与版本资料跳转。来源摘要与输入文件 SHA-256 记录在注册表中。

维护这些条目时，先下载对应版本的中英文 character、weapon 与 item JSON，文件名使用 `ww__3.8.1__zh__character__1512.json` 等格式，再执行 `python3 tools/import_reviewed_beta.py --source-dir <下载目录>`。该工具仅导入审核过的四个版本条目，不扩展其他栏目；`--retry-missing-images` 可重新尝试尚未提供的图像。已确认借用其他角色或武器的占位图不会展示；缺失的安魂参数显示“待完善”，空缺的英文材料名称以材料编号显示。

补充完成后运行 `python3 tools/build_locales.py` 并提交更新后的英文语言包。`node tools/test_reviewed_content.mjs` 检查跳转、等级/谐振切换、材料、占位参数与正式服隔离。
