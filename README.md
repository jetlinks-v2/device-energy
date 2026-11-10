# 设施设备能源管理前端

PC 模块由 SaaS 运行端加载，模块名 `facility-energy-ui`。导航与当前报事报修一致：从 Cloud 项目应用卡片进入，`configuration.customDomain` 留空，沿用宿主一级侧栏及内容区下级导航，不要求 `navigationMode: tree`。设备、巡检、维保、故障、能源、预警、客户与报表访问 `/property/facility-energy/**`；组织、用户、空间、客户和字典页面统一复用 `property-base-ui`，访问共享 `/property/**`。

在运行端仓库根目录构建：

```sh
pnpm --filter facility-energy-ui build:with-base
```

类型检查使用 `pnpm exec vue-tsc --noEmit -p modules/facility-energy-ui/tsconfig.json`。模块保留宿主的 `@jetlinks-web-core/*`、`@/*` 和 `@theme-config` 路径别名；主题配置与 Vite 一致，优先使用运行端 `configs/theme/index.ts`，不存在时使用 Web Core 默认配置。共享宿主源码也会参与检查，需分别核对模块及宿主诊断。

`mobile-h5` 是员工及业主共用的独立移动入口，根据真实角色授权显示任务或本人仪表。Node.js 要求 22.18 或更新版本。

```sh
cd mobile-h5
npm ci
npm test
npm run build
```

部署时使用实际 `config.json` 指定 Cloud 项目编码、应用 ID、同源网关和物业电话。员工在线接单下载后可离线执行；缓存和附件按后端确认的账号／应用隔离；联网后使用版本及幂等键提交。业主仅访问有效绑定区间数据，余额过期会明确标注，没有支付操作。

部署定义、角色说明和真实联调验收位于相邻 `property-management/deploy/facility-energy/README.md` 及 `ACCEPTANCE.md`。构建结果不表示实际应用授权、Cloud 设备或短信送达已验收。

## 公共基础前端

宿主同时检出并加载 `modules/property-base-ui`（`2.20`）。本模块不再提供组织、用户、空间、客户、字典的菜单、页面、接口封装或语言副本。公共菜单由公共模块唯一提供给宿主初始化，各应用按职责引用并授权公共 `charging/*` 菜单；不在业务 `baseMenu.json` 中复制公共定义。后端仍由独立基础服务维护统一数据。

在宿主执行 `pnpm --filter facility-energy-ui dev` 联合调试公共和认证模块；`build` 仅构建设施独立模块，`build:with-base` 包含设施、公共基础页面及认证模块，输出宿主 `dist/`，避免菜单存在但组件缺失。部署至独立静态目录时，通过宿主构建所选模式的 `.env.<mode>` 配置 `VITE_PUBLIC_PATH`，并验证生成入口中的资源前缀。正式 SaaS 集成构建还须包含运行端、认证与实际使用的其他模块；宿主 `pnpm build:property-apps` 覆盖报修、品质、设施与公共模块。

设施业务菜单统一位于一级“设施设备”下，保留原页面、按钮编码和隐藏的移动端授权节点；“物业基础管理”由公共模块并列提供。更新已有环境时需重新初始化菜单，并同步应用模板和角色菜单，源码改动不会直接修改已保存的菜单。

已有环境的旧菜单不会因源码删除自动消失，按后端 `deploy/property-base/README.md` 增量迁移模板、套餐、订阅与角色，保留原资产范围，验收后停用旧基础副本。不重置业务菜单，也不全量初始化其他系统。

设备同步状态、应用操作日志为设施业务功能，保留原菜单 ID、URL、权限与组件，归入“设施设备”；设备、员工、业主资格继续通过设施后端的业务接口校验。
