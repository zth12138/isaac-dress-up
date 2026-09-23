# 以撒暖暖

<p align="center">
  <img src="build/app-icon.png" width="128" alt="Isaac 获得 Venus 外观的应用图标">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Platform-Windows-blue" alt="Windows">
  <img src="https://img.shields.io/badge/Built%20with-Electron-47848F" alt="Electron">
  <img src="https://img.shields.io/badge/Code%20License-MIT-green" alt="Code License: MIT">
  <img src="https://img.shields.io/badge/Release-v1.0.0-brightgreen" alt="Release: v1.0.0">
</p>

一个可换角色、叠加道具外观并常驻桌面的《以撒的结合》二创小摆件。

> [!IMPORTANT]
> 本项目是非官方、非商业的同人项目，与《以撒的结合》的开发者、发行商及相关权利人不存在隶属、授权、赞助或认可关系。[MIT License](LICENSE) 仅适用于项目作者原创的程序源代码，不适用于游戏相关名称、美术、动画定义及其衍生内容。详细说明见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。

**快速上手** · [功能与技术细节](docs/DETAILS.md)

## 使用发布版

1. 解压 `Isaac-Dress-Up-1.0.0-win.zip`，不要只单独复制 EXE。
2. 将整个文件夹放在有写入权限的位置，例如桌面或其他个人目录。
3. 运行 `Isaac Dress Up.exe`。

程序会从同目录的 `assets/isaac/` 读取素材，并把配置、缓存和日志写入同目录的 `data/`。移动程序时请保留完整目录结构。

## 基本操作

- `方向键` 或 `WASD`：移动角色；松开后保持最后朝向。
- 鼠标左键拖动：直接移动窗口。
- 鼠标悬停角色：显示角色切换、道具菜单和可用的形态按钮。
- 左右箭头：循环切换 18 个基础角色。
- 书包按钮：展开道具菜单，可按 ID、中英文名搜索并点击装备。
- 道具菜单筛选按钮：循环切换部件分类和装备状态。
- `1/2/3`：保存或加载当前角色的三套外观配置；`Shift+点击`覆盖已有槽位。
- Eden 发型按钮：打开 54 种发型列表，可同时叠加多个发型。
- Judas、Lazarus、The Forgotten 的形态按钮：切换 Dark Judas、Lazarus Risen 或 The Soul。
- 鼠标右键：查看资源与数据目录，或退出程序。

## 当前内容

- 18 个基础角色及 3 个角色内变体。
- 357 个兼容 Costume 道具外观。
- 原作角色专属贴图、六色皮肤和飞行状态处理。
- 道具搜索、分类、装备筛选与三槽外观保存。
- 便携配置和素材目录，适合 ZIP 解压后直接使用。

当前有 2 个空号 Costume（ID `630`、`662`）因原作 `items.xml` 没有对应道具定义而未加入菜单。

## 从源码运行

需要 Node.js 和 npm：

```powershell
cd D:\AI项目2\以撒暖暖
npm install
npm start
```

开发模式也可以通过 `ISAAC_ASSET_ROOT` 指向完整的提取资源目录。项目内的 `assets/isaac/` 始终优先。

## 构建 Windows ZIP

```powershell
npm run dist
```

构建前会重新生成 Isaac + Venus 应用图标，随后输出：

```text
dist/Isaac-Dress-Up-1.0.0-win.zip
```

应用代码封装在 ASAR 中，素材保留为 ZIP 内可见的 `assets/isaac/`。运行后生成的 `data/` 不会打入后续构建。

## 更多信息

完整的功能说明、素材结构、外观组合规则、开发检查和后续计划见 [功能与技术细节](docs/DETAILS.md)。

## 开源许可与免责声明

项目作者原创的程序源代码采用 [MIT License](LICENSE) 开源。游戏相关素材及其衍生内容不属于 MIT 授权范围，具体文件范围和来源见 [THIRD_PARTY_ASSETS.md](THIRD_PARTY_ASSETS.md)。

《以撒的结合》及其相关名称、美术素材、动画和游戏内容的权利归各自权利人所有。如果相关权利人认为仓库中的内容使用不当，可以联系仓库维护者；维护者将配合移除或替换相关素材。
