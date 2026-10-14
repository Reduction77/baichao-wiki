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

支持搜索、分类筛选、技能独立等级、简易说明、共鸣模态、突破前后属性、共鸣链、材料、武器谐振、声骸品质与合鸣效果、浏览器收藏。配队视频入口已经实现，当前尚无已核实记录；结构见 `tools/teams.example.json`。

旧链接 `#character/1304?source=github` 保留今汐试验页兼容入口；普通角色页现已全部使用 GitHub 数据。`#lab` 展示全站迁移范围与历史对照结果。

## Pages 与域名

在 Settings → Pages 将发布来源设为 GitHub Actions。推送 main 自动恢复、检查并发布。

绑定 `wiki.winboard.top`：在 Pages 的 Custom domain 填入该域名，在 DNS 添加 CNAME，名称 `wiki`，目标 `reduction77.github.io`，验证后启用 HTTPS。域名解析由站长配置。

## 版权

本站不是鸣潮官方网站，游戏文字与图片版权归原权利方所有。公开资源不等同于开放再发布许可。LICENSE 仅覆盖本站原创代码、脚本与配置，不覆盖导入的游戏资料与素材。

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
