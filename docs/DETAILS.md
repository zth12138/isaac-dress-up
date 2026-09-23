# 以撒暖暖：功能与技术细节

← [返回快速上手](../README.md)

《以撒的结合》二创桌面小摆件 v1.0。项目目标是让角色常驻桌面，并通过 ANM2 动画、PNG 精灵表和可组合的 Costume 实现角色换装。
## 当前进度

当前版本已经完成桌面角色的核心链路：

- Electron 透明、无边框、置顶窗口
- 鼠标拖动改变整个桌面窗口位置
- 右键菜单显示资源根目录并退出程序
- 从 ANM2 XML 读取 FPS、动画、图层、精灵表路径和帧数据
- 从 PNG 精灵表裁剪动画帧
- 使用 Canvas 最近邻绘制，保持像素风格
- 播放 Isaac 的身体动画和方向头部动画
- 默认显示静止的正面 Isaac
- 按方向键或 `WASD` 播放四方向行走动画并移动窗口
- 统一的 Idle/Walk/方向状态机，松开按键后保持最后朝向
- 鼠标悬停窗口时显示左右箭头，点击可循环切换角色
- 支持 18 个基础角色贴图切换，复用通用玩家 ANM2 动画
- Judas 支持通过角色上方的原版头像按钮切换为 Dark Judas；Dark Judas 不单独占用左右角色轮换位置
- Lazarus 支持通过同一位置的原版头像按钮切换为 Lazarus Risen，并使用两种形态各自的原作头发层
- The Forgotten 支持切换为 The Soul，同时补齐原作 Costume 44 的动态身体层
- 支持基础角色与发型、帽子、眼罩等装饰 ANM2 的组合绘制
- Eden 支持在左侧发型面板中以正面预览选择 54 种原作发型，并可同时叠加多个发型
- 外观组合器支持隐藏基础层、按层绘制专属角色 actor，以及同步身体和头部动画轨道
- Apollyon 已使用专属身体动画替换通用身体层，并在通用头部上叠加犄角
- 鼠标悬停时在角色右上角显示道具菜单按钮，点击后向右展开原作风格侧栏
- Eden 时在角色左上角显示发型按钮，点击后向左展开发型图片侧栏
- 道具侧栏支持按数字 ID、中文名和英文名实时搜索
- 支持按外观部件循环分类，以及全部、仅已装备、排除已装备三种循环筛选
- 点击道具图标可装备或移除外观，已装备道具使用绿色道具框标识
- 道具目录由原作 XML 与 ANM2 自动生成，当前支持 357 个兼容道具
- 当前目录包括 225 个头部、91 个身体、26 个头身混合、14 个其他图层道具和硫磺火特例
- 支持道具的原作六色皮肤覆盖，多个颜色道具同时装备时按 Costume 优先级决定最终肤色
- 自动读取原作 `costumes_*` 目录中的角色专属道具贴图，并优先于通用六色皮肤版本
- 生成器会输出道具兼容性审计报告，记录每个暂未支持 Costume 的具体原因
- 支持 `body` 基础身体替换以及 `glow`、`back`、`top0`、`main` 特殊图层
- 外观组合顺序支持基础身体之后、基础头部之前的独立身体装饰层
- 道具组合按角色分别保留
- 每个角色拥有 3 个独立外观配置槽，可持久化保存并恢复当前道具与角色外观选项
- 配置、Chromium 缓存、日志和崩溃转储均保存在程序目录的 `data/` 中
- ZIP 构建将素材库作为程序目录下可见的 `assets/isaac/` 分发
- 道具外观支持原作优先级排序，以及同时替换头部、身体等多轨道效果
- 飞行角色与获得飞行能力的角色移动时保持身体静止，不再播放地面行走腿部动画
- 窗口移动使用高精度坐标累加，支持小步长连续移动
- 项目内资源目录优先，也支持外部完整 `resources` 目录
- 资源路径越界保护和大小写不敏感查找

以下内容不在 v1.0 的当前范围内：

- 窗口移动的边界和跨屏幕行为仍需稳定化
- 已自动接入 357 个兼容 Costume；当前只有 2 个被动 Costume 因原作 `items.xml` 缺少对应道具定义而未纳入
- 当前已实现安全兼容道具的添加、移除和基础优先级，特殊变身的完整冲突规则仍需扩展
- 还没有用户 Mod 导入界面和 `manifest.json` 管理
- 攻击、受击、待机互动、粒子和 Shader 尚未实现
- Azazel、Forgotten 等复杂角色的多身体图层和完整专属行为动画尚未接入
- 还没有宠物和跟随物支持

## 运行

```powershell
cd D:\AI项目2\以撒暖暖
npm install
npm start
```

`npm start` 使用 `scripts/start.js` 启动 Electron。它会优先使用项目内的 Electron；如果本地 Electron 安装没有下载运行时，可以设置环境变量指定可用的 Electron：

```powershell
$env:ELECTRON_PATH = 'D:\path\to\electron.exe'
npm start
```

在当前工作区中，启动器也会自动查找同级 `桌面D6` 项目里的 Electron 运行时。

## 便携数据与打包

开发版和 ZIP 版都使用程序目录内的便携目录，不再把运行数据写入 C 盘的 Electron 用户目录：

```text
assets/isaac/       可见的角色、道具和 UI 素材库
data/config/        外观配置及 Electron 用户配置
data/cache/         Chromium 会话和缓存
data/logs/          Electron 日志
data/crash-dumps/   崩溃转储
```

首次使用新版本时，如果旧的 Electron 用户目录中存在 `appearance-slots.json`，程序会将它复制到 `data/config/`；已有便携配置不会被覆盖。右键菜单会显示当前实际使用的素材、配置和缓存目录。

生成 Windows x64 ZIP：

```powershell
npm run dist
```

构建产物写入 `dist/Isaac-Dress-Up-1.0.0-win.zip`。构建前会从 Isaac 正面静止帧和 Venus 外观生成应用图标。程序代码封装在 ASAR 中，`assets/isaac/` 保持为 ZIP 内可见、可替换的外置素材目录；运行后才生成的 `data/` 不会进入后续构建。

## 操作

- 方向键或 `WASD`：移动窗口并播放对应方向的行走动画
- 松开方向键：停止动画，保持最后朝向
- 鼠标左键拖动：直接移动整个窗口，不触发角色行走
- 鼠标悬停窗口：显示角色下方的左右切换箭头
- 鼠标悬停窗口：显示角色右上角的道具菜单按钮
- 点击道具菜单按钮：向右展开或收起道具选择侧栏
- 道具菜单搜索框：输入数字 ID、中文名或英文名，实时刷新结果
- 道具菜单右侧第一个按钮：循环切换全部、头部、身体和其他装饰
- 道具菜单右侧第二个按钮：循环切换全部、仅已装备和排除已装备
- 点击道具图标：装备或移除，道具框变绿表示已装备
- 点击书包下方的空 `1/2/3` 槽位：保存当前角色的道具组合和外观选项
- 点击已有的配置槽位：加载并应用其中的完整外观
- `Shift+点击`已有配置槽位：用当前外观覆盖保存该槽位
- Eden 状态下鼠标悬停窗口：显示左上角发型菜单按钮
- 点击发型菜单按钮：向左展开或收起 54 种发型的正面预览
- 点击发型预览：叠加或移除该发型，绿色框表示已启用
- Judas 状态下点击角色上方的 Dark Judas 头像：在 Judas 与 Dark Judas 之间切换
- Lazarus 状态下点击角色上方的 Lazarus Risen 头像：在 Lazarus 与复活形态之间切换
- The Forgotten 状态下点击角色上方的共用原版头像：在 The Forgotten 与 The Soul 之间切换
- 点击左箭头：切换到上一个角色
- 点击右箭头：切换到下一个角色
- 鼠标右键：打开菜单

## 目录结构

```text
main.js       Electron 主进程、便携目录、窗口和资源读取
preload.js    暴露给渲染进程的安全 IPC API
renderer.js   ANM2 解析、帧计时、图层绘制和键盘控制
styles.css    透明窗口、像素画布和角色切换控件样式
scripts/
├─ build-app-icon.ps1      合成 Isaac + Venus 的透明 PNG 与 Windows ICO
├─ start.js                Electron 运行时选择和启动脚本
└─ build-item-catalog.js   从原作 XML/ANM2 生成完整安全目录、审计报告并复制依赖
docs/
└─ DETAILS.md  完整功能、素材和开发说明
build/
├─ app-icon.png  Git 页面预览图标
└─ app-icon.ico  Windows 应用图标
assets/
├─ README.md  素材目录规范
└─ isaac/      生成的道具目录及当前角色、道具和 UI 素材集
```

## 当前素材

v1.0 当前使用：

```text
assets/isaac/gfx/001.000_player.anm2
assets/isaac/gfx/characters/costumes/character_001_isaac.png
assets/isaac/gfx/characters/costumes/ghost.png
assets/isaac/gfx/characters/costumes/character_002_magdalene.png
assets/isaac/gfx/characters/character_002_magdalenehead.anm2
assets/isaac/gfx/ui/buttons.png
assets/isaac/gfx/ui/buttons.anm2
assets/isaac/gfx/ui/main menu/charactermenu.png
assets/isaac/gfx/ui/main menu/charactermenu.anm2
assets/isaac/gfx/ui/main menu/charactermenu-4x-nearest.png
```

当前角色切换以 `001.000_player.anm2` 作为通用身体动画，并按角色配置叠加独立的发型、帽子、眼罩等 ANM2。组合器也可以隐藏通用 actor 的指定层，再将专属 ANM2 按层插入到基础角色之前或之后。Apollyon 会用 `character_015_apollyonbody.anm2` 的 `body` 层替换通用身体，同时将 `head0` 犄角层绘制在基础头部之上。项目内会缓存当前角色、道具和皮肤替代所需的原作 PNG/ANM2；角色切换按钮使用 `charactermenu-4x-nearest.png` 中的上采样左右箭头帧，资源归档在 `gfx/ui/main menu/`。

Dark Judas 作为 Judas 的角色内变体处理，不加入左右箭头的基础角色列表。切换按钮使用原作 `playerportrait_darkjudas.png`，角色本体使用 `character_013_blackjudas.png`，并优先读取 `costumes_shadow` 中的原作专属道具外观。离开 Judas 再切换回来时会记住当前变体；Judas 与 Dark Judas 的已装备道具和三个外观配置槽按各自角色名称独立保存。

Lazarus Risen 同样作为 Lazarus 的角色内变体处理。普通形态使用 Costume 32 的 `character_lazarushair1.anm2`，复活形态使用 `character_010_lazarus2.png` 和 Costume 33 的 `character_lazarushair2.anm2`；两种形态支持原作六色皮肤，并分别保留道具组合和外观配置槽。

The Forgotten 与 The Soul 使用原作共用的 `playerportrait_theforgotten.png` 作为形态按钮。The Forgotten 会隐藏通用身体层并改用 Costume 44 的 `character_016_theforgottenbody.anm2` 动态骨骼身体；The Soul 使用 `character_018_thesoul.png`、蓝色皮肤和 `forgottensoul` 外观后缀。两种形态分别保留道具组合和外观配置槽，相关 `ghost.png`、`chain.png` 也会随素材生成器复制，供后续灵魂专属动画使用。

外观选项由角色配置声明。目前 Eden 声明了 `1-54` 的多选发型，所有发型复用 `character_009_edenhair1.anm2` 的动画结构，仅替换对应的 `character_009_edenhairN.png` 精灵表。每个已选发型作为独立覆盖层参与合成，按发型编号稳定叠加。

道具菜单从 `assets/isaac/item-catalog.json` 读取目录，并直接使用 `gfx/collectibles/` 下的独立道具图标。目录由 `scripts/build-item-catalog.js` 从 `items.xml`、`costumes2.xml` 和对应 ANM2 自动生成，同时复制所需的 ANM2、Costume PNG、角色六色皮肤变体和图标。当前目录包含 225 个头部道具、91 个身体道具、26 个头身混合道具、14 个其他图层道具，以及硫磺火这个多层特例，共 357 个。`body` 会替换基础身体，`glow/back` 在角色主体之前绘制，`body0/body1` 位于基础身体之后，`head` 至 `head5` 按原作插槽顺序合成，`top0/main` 位于最前方。缺少部分方向动画的 Costume 会回退到自身已有方向。窗口使用固定透明画布和动态窗口形状避免侧栏开关闪烁；道具菜单向右展开，Eden 发型菜单向左展开，两个侧栏可以同时使用。每个道具配置同时声明数字 ID、中英文名、部件分类、图标、外观 ANM2、优先级和动画轨道；硫磺火会隐藏基础 `head/body` 层，并作为基础变身层优先绘制，使其他角色装饰和道具能够覆盖在它上面。装备组合以角色名称为键保存在当前运行状态中。

颜色覆盖读取 Costume 的 `skinColor`、`overwriteColor`、`forceBodyColor` 和 `forceHeadColor` 字段。普通角色直接切换原作提供的 `_white/_black/_blue/_red/_green/_grey` 完整底图；Blue Baby、Azazel、The Lost、Lilith、Keeper、Apollyon 和 The Forgotten 等没有六套独立底图的角色，使用同一套原作皮肤色板精确替换。`hasSkinAlt` 只控制 Costume 自身的六色贴图；角色专属外观则直接扫描原作 `costumes_*` 目录，只要对应贴图存在就加入目录。运行时按照“角色专属且匹配当前肤色、角色专属基础版、通用肤色版、通用版”的顺序选择贴图。当前 222 个道具包含角色专属版本，共 567 条基础映射，其中 Blue Baby 44 个、Keeper 193 个、Apollyon 80 个、Forgotten 96 个，另预留 150 个 Shadow 版本；Apollyon 等目录内的二级六色专属版本也会单独记录。多个颜色道具同时装备时，由优先级最高者覆盖；卸下后会自动回退到下一个覆盖或角色默认肤色。

飞行状态优先读取原作 Costume 的 `isFlying` 标记，当前目录包含超凡升天、深渊领主、夜之魂、命运、圣杯等 11 个飞行外观道具；Azazel、The Lost 和 The Soul 则由角色定义提供天生飞行。飞行状态下方向键仍会移动窗口并切换朝向，角色腿部和普通身体替换固定在第 0 帧；提供飞行能力的 Costume 仍会推进自己的移动时间轴，因此命运的翅膀等效果可以继续播放。卸下最后一个飞行道具后，行走动画会立即恢复。

外观配置槽位按角色名称独立管理，并写入 Electron `userData` 目录下的 `appearance-slots.json`。每个槽位保存排序后的道具 ID 和 Eden 多选发型数组等角色外观选项；已填充槽位在 UI 中显示为绿色，单击会加载完整外观，`Shift+点击`则使用当前外观覆盖保存。

生成器还会写入 `assets/isaac/item-catalog-report.json`。报告覆盖 `costumes2.xml` 中全部 359 个被动 Costume，并记录各专属角色目录的外观覆盖数量：357 个已支持，2 个暂未支持。未支持的 ID `630` 和 `662` 在当前原作 `items.xml` 中没有对应道具定义。

重新生成完整安全道具目录和兼容性报告：

```powershell
npm run build:items
```

生成器默认读取项目同级的 `以撒资源素材/extracted_resources/resources`，也可以通过 `ISAAC_SOURCE_ROOT` 指定其他提取资源目录。

ANM2 中的贴图路径相对于 `gfx/` 解析。开发时可以设置 `ISAAC_ASSET_ROOT` 指向完整的提取资源目录：

```powershell
$env:ISAAC_ASSET_ROOT = 'D:\AI项目2\以撒资源素材\extracted_resources\resources'
npm start
```

正式发布前需要根据原作素材和第三方 Mod 的授权情况清理发行包。项目代码和用户自备素材的加载机制，与素材本身的版权许可分开处理。

## 开发检查

当前改动完成后使用 Node.js 语法检查，不自动启动 Electron：

```powershell
node --check main.js
node --check renderer.js
node --check preload.js
```

## 计划中的模块

后续会按职责拆分为以下模块：

```text
AssetResolver        资源目录、路径映射和 manifest
Anm2Player           ANM2 解析、动画时序和单个 ANM2 绘制
AppearanceComposer   基础角色、Costume 和道具图层合成
ItemSystem           道具数据、外观效果和冲突规则
SaveSystem           角色、道具和用户资源配置保存
DesktopShell         透明窗口、置顶、拖动和桌面输入
```

当前实现已经包含 `DesktopShell`、`AssetResolver`、`Anm2Player` 和基础 `CharacterSwitcher`。后续换装系统会在这些边界上继续扩展。
