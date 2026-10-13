# 白潮 · 鸣潮资料站

蓝白色鸣潮角色、武器和声骸资料站，使用GitHub Pages发布。原生HTML/CSS/JavaScript，无网页编译依赖，支持手机、仓库子路径和自定义域名。

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
python3 tools/check_data.py
node tools/test_core.mjs
node tools/test_render.mjs
python3 -m http.server 8080 --directory web
```

打开 http://localhost:8080/。程序渲染检查使用简化DOM替身，不能替代浏览器布局验收。

## 数据来源

资料与图片来自nanoka页面实际使用的公开JSON和资源地址，保留原页面链接。更上游的采集来源及开放再发布许可尚未确认。游戏文字与素材版权归原权利方所有，本站并非官方资料站。LICENSE仅适用于本站原创代码、脚本和配置，不覆盖导入的游戏资料和图片。

参考：https://ww.nanoka.cc/
