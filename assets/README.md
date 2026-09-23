# 素材目录

当前项目包含默认 Isaac、其他基础角色和角色切换 UI 所需的资源：

```text
isaac/
└─ gfx/
   ├─ 001.000_player.anm2
   ├─ characters/
   │  └─ costumes/
   │     ├─ character_001_isaac.png
   │     └─ ghost.png
   └─ ui/
      ├─ buttons.png
      └─ buttons.anm2
```

`characters/costumes/` 中还缓存了从 `D:\AI项目2\以撒资源素材\extracted_resources\resources` 复制的 297 个角色贴图，文件名统一为 `character_*.png`。当前切换功能复用 `001.000_player.anm2`，只替换主角色精灵表。

`characters/` 目录同时缓存了 36 个 `character_*.anm2`。角色配置可以将这些文件作为外观装饰层叠加到通用玩家动画上，例如 Magdalene 的 `character_002_magdalenehead.anm2` 会加载 `character_002_maggiesbeautifulgoldenlocks.png`。

Eden 的 `character_009_edenhair1.png` 到 `character_009_edenhair54.png` 共用同一套头部动画帧布局。项目通过外观选项替换精灵表，无需复制 54 份 ANM2。

Apollyon 使用 `character_015_apollyonbody.anm2` 组合两个动画轨道：`body` 层替换通用角色身体，`head0` 层在通用头部上叠加犄角。它额外依赖 `costumes/costume_apollyon_body.png` 和 `costumes/character_016_apollyonhorns.png`。

`item-catalog.json` 由 `scripts/build-item-catalog.js` 生成。当前目录包括 225 个头部道具、91 个身体道具、26 个头身混合道具、14 个其他图层道具，并保留硫磺火这个头部与身体组合特例，共 357 个。生成器会自动复制对应 ANM2、其中引用的 Costume PNG、角色专属替代贴图和道具图标；菜单读取 `gfx/collectibles/collectibles_*.png`，外观绘制读取 `gfx/characters/` 下的 ANM2 与相对 `costumes/` 贴图。

`item-catalog-report.json` 是同一次构建产生的兼容性审计报告，列出全部被动 Costume 的支持状态。当前只有 ID `630` 和 `662` 两个空号 Costume 因缺少道具定义而未进入菜单。

角色切换 UI 资源归档在：

```text
isaac/gfx/ui/buttons.png
isaac/gfx/ui/buttons.anm2
isaac/gfx/ui/main menu/charactermenu.png
isaac/gfx/ui/main menu/charactermenu.anm2
isaac/gfx/ui/main menu/charactermenu-4x-nearest.png
```

当前可切换角色使用基础角色贴图，并为部分角色叠加装饰动画；Apollyon 与 The Forgotten 已接入专属身体替换，Judas、Lazarus 和 The Forgotten 支持角色内形态切换。角色菜单左右箭头取自 `charactermenu-4x-nearest.png` 的 `y=1088` 精灵帧，并按 2 倍尺寸显示。

`001.000_player.anm2` 中的贴图路径相对于 `gfx/` 解析。后续添加道具时，建议继续保持游戏原始路径结构，例如：

```text
isaac/gfx/characters/001_the_sad_onion.anm2
isaac/gfx/characters/costumes/costume_058_sadonion.png
```

完整资源目录可以通过环境变量 `ISAAC_ASSET_ROOT` 指定，项目内 `assets/isaac` 会优先使用。
