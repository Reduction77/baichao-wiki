# 白潮 · 鸣潮资料站

深色蓝鸣潮角色、武器和声骸资料站，使用GitHub Pages发布。原生HTML/CSS/JavaScript，无网页编译依赖，支持手机、仓库子路径和自定义域名。

当前资料包含64个共鸣者、133件武器、187个声骸、137种突破材料和571张本地WebP图片。支持搜索筛选、技能等级与倍率、共鸣链、突破前后属性、武器谐振、声骸品质和浏览器收藏。配队视频入口已实现，目前没有已核实的队伍记录。

## 首次上线

在仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。

然后在 **Actions → Publish Baichao Wiki → Run workflow** 运行一次，首次不勾选refresh_data。也可以在开启Pages后重新运行之前失败的工作流。成功后地址为：

https://reduction77.github.io/baichao-wiki/

该地址在部署成功前可能返回404。实际发布状态以GitHub Actions和Pages设置页为准。

## 绑定wiki.winboard.top

在仓库 **Settings → Pages → Custom domain** 填入 `wiki.winboard.top` 并保存，再在域名DNS中添加：

| 类型 | 名称 | 目标 |
| --- | --- | --- |
| CNAME | wiki | reduction77.github.io |

目标不包含协议或仓库路径，冲突的旧wiki记录需替换。等待验证后启用Enforce HTTPS。无需Nginx Proxy Manager。域名解析由站长配置，本仓库不会自动修改DNS。

## 资料快照与更新

`snapshots/`保存经过校验的压缩分片，发布时由 `tools/unpack_snapshot.py` 解压为 `web/data/`。图片和JSON均从本地快照提供，首次发布不依赖nanoka网络响应。原始网页和脚本保留为普通源码文件，数据分片用于可靠传输与校验。

手动更新并把资料保存回源码仓库：

```bash
python3 tools/unpack_snapshot.py
python3 tools/sync_data.py --keep 1
python3 tools/check_data.py
python3 tools/pack_snapshot.py
git add snapshots
git commit -m "Update live-version data"
git push
```

同步脚本需要Python3与curl。默认导入来源manifest的正式服版本，图片下载缺失时有占位图，详情下载失败不会切换完整快照。

也可在Actions手动运行时勾选refresh_data。该方式更新本次部署，**不会提交回源码仓库**；下一次不刷新资料的发布会恢复使用仓库中的快照。没有定时任务。

`web/data/teams.json`单独维护，不会被资料导入或解压覆盖。记录结构见 `tools/teams.example.json`。

## 本地预览与检查

```bash
python3 tools/unpack_snapshot.py
python3 tools/unpack_character_icons.py
python3 tools/check_data.py
node tools/test_core.mjs
node tools/test_render.mjs
python3 -m http.server 8080 --directory web
```

打开 http://localhost:8080/。程序渲染检查使用简化DOM替身，不能替代浏览器布局验收。

## 数据来源

资料与图片来自nanoka页面实际使用的公开JSON和资源地址，保留原页面链接。更上游的采集来源及开放再发布许可尚未确认。游戏文字与素材版权归原权利方所有，本站并非官方资料站。LICENSE仅适用于本站原创代码、脚本和配置，不覆盖导入的游戏资料和图片。

参考：https://ww.nanoka.cc/

## GitHub 原始数据试验（今汐）

试验入口：`#lab`；角色页：`#character/1304?source=github`。

本页文字、倍率、共鸣链、突破材料与基础属性由 Arikatsu/WutheringWaves_Data 固定提交 `9218d612ad815e398e064e577e42aaf878899968`（游戏3.7.0，资源3.7.8）直接转换，图片仍使用现有本地nanoka图片快照。其他条目保持原数据来源。

可独立重新生成，无需请求nanoka：

```bash
python3 tools/import_github_character.py
```

可选对照本站保存的资料（仅在转换完成后比较，不参与数据生成）：

```bash
python3 tools/import_github_character.py --compare web/data/20261013T031747-2/character/1304.json
```

输出包含上游提交和各输入文件SHA256。首次下载固定提交配置，后续使用缓存；改用其他提交需要同时更换缓存目录与版本标记，并重新核对。正常Pages部署使用已提交的试验JSON，不请求上游。未覆盖伤害拆分、战斗标签、故事、Live2D与推荐配装。脚本只处理今汐，目前不是全角色通用导入器。

当前比较：技能文字51/51、倍率字段110/111、共鸣链18/18、突破6/6、属性288/288。一处差异为回路参数名称，GitHub「同奏持续时间」与现有快照「游龙廻光持续时间」均为5秒。

## 深色模式与阅读布局

全站使用深色蓝主题，白色技能与共鸣链图标放在深色底板上。今汐试验页按技能逐条排列，在宽屏上将说明和倍率分栏；窄屏自动改为上下排列。倍率表使用交替行底色与醒目的数值，保留独立等级及简易说明功能。

## 全角色布局与测试服对比

64 个正式服角色使用统一的深色阅读布局，保留共鸣模态、技能独立等级、属性节点、配队入口与收藏。所有角色的技能和共鸣链图标由额外压缩包恢复，访问时不使用外部图片热链。正式服角色目前仍使用原本的资料快照；今汐的 GitHub 数据版仍是单独的数据试验，未把其他角色冒充为 GitHub 来源。

入口：`#beta`，测试角色详情：`#beta/<ID>?version=<新版本>&from=<旧版本>`。可比较档案、选定等级的基础属性、技能文字和倍率、共鸣模态、共鸣链和突破材料，支持类别筛选及仅显示变化。图片、故事、伤害拆分与推荐配装不参与对比。只有一份快照时会说明暂不能对比两个版本。

### 版本规则

- 同一主次游戏版本正式服发布后，隐藏该版本及更早版本的测试快照，旧测试链接也不会读取对应数据。
- 游戏版本与资源修订号分开判定。Arikatsu 固定提交标明 `Status: Release`、游戏 `3.7.0`、资源 `3.7.8`，属于正式服资源修订。不能因资源号末位非零就把它标为测试服。
- `web/data/beta/index.json` 明确声明 `channel: beta`；正式服页面不提供混入测试服的版本选项。前端以正式服索引的 live 版本作为筛选下限，正式快照更新后无需改页面代码就能隐藏已发布版本的测试资料。
- 当前来源 manifest 仅有正式服3.7，测试列表为空。用于检查对比行为的合成样本只在测试进程内存中，未作为网站资料发布。

### 更新未来测试快照

```bash
python3 tools/unpack_snapshot.py
python3 tools/unpack_character_icons.py
python3 tools/sync_beta.py
node tools/test_versions.mjs
node tools/test_beta_render.mjs
git add web/data/beta
git commit -m "Update eligible beta snapshots"
git push
```

脚本读取 nanoka 游戏快照 manifest，仅导入比已发布正式服更高主次版本的测试游戏条目，不把资源修订号当作测试版本。版本索引、详情和图片一起保存，运行失败不发布不完整版本。若上游以后改用不同的测试版本命名，需要确认其发布状态并调整导入规则。Actions 勾选 refresh_data 时先更新正式服，再更新测试索引；与原刷新方式一样，这只影响本次部署，不提交回源码。没有新增定时任务。

图标包还原：`python3 tools/unpack_character_icons.py`；额外版本检查：`node tools/test_versions.mjs` 和 `node tools/test_beta_render.mjs`。

重新生成角色图标包：`python3 tools/pack_character_icons.py`。下载器复用每个线程的HTTPS连接，已有有效WebP无需重复下载；全部成功后生成带SHA256校验的分片。提交 `snapshots/character-icons/` 后，Pages发布与网页访问均无需向上游请求图标。资料检查同时核对每个角色技能和共鸣链图标是否可从本地映射解析。
