---
name: 设施设备移动端
description: 天蓝色、简洁清爽的移动作业界面
colors:
  primary: "#0874bb"
  accent: "#1689d8"
  sky-soft: "#eaf5ff"
  ink: "#203448"
  muted: "#5a6f83"
  line: "#e6edf3"
  canvas: "#f3f7fb"
  surface: "#ffffff"
  warning: "#a85412"
  danger: "#bf3535"
  success: "#19845e"
typography:
  login-title:
    fontSize: "28px"
  login-brand:
    fontSize: "18px"
  field-control:
    fontSize: "16px"
  icon-small:
    fontSize: "21px"
  icon-brand:
    fontSize: "22px"
  headline:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "23px"
    fontWeight: 650
    lineHeight: 1.4
  section:
    fontSize: "17px"
    fontWeight: 650
    lineHeight: 1.5
  title:
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.55
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, Microsoft YaHei, sans-serif"
    fontSize: "14px"
    lineHeight: 1.6
  supporting:
    fontSize: "13px"
  label:
    fontSize: "12px"
rounded:
  captcha: "4px"
  tag: "5px"
  photo: "8px"
  choice: "9px"
  control: "10px"
  panel: "12px"
  summary: "14px"
  drawer: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  gutter: "16px"
  lg: "20px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.surface}"
    rounded:
  captcha: "4px" "{rounded.control}"
    height: "44px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded:
  captcha: "4px" "{rounded.control}"
    height: "42px"
  task-row:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded:
  captcha: "4px" "{rounded.panel}"
    padding: "14px 16px"
  check-item:
    backgroundColor: "{colors.surface}"
    rounded:
  captcha: "4px" "{rounded.panel}"
    padding: "18px 16px"
---

# Design System: 设施设备移动端

## Overview

**Creative North Star: "清爽作业台"**

天蓝色标识可操作对象，白色紧凑分区承载现场作业内容。视觉沿用独立员工 H5 的导航气质与安全区布局，让任务、状态和填写内容保持清楚。

界面以工作台、紧凑列表和独立执行页展开。图标用于识别入口与动作，照片服务于现场证据；内容优先于装饰。

**Key Characteristics:**
- 天蓝色操作强调
- 白色紧凑分区
- 手机单列、桌面居中
- 检查填写优先

## Colors

### Primary

主操作蓝用于主按钮、链接、选中导航和扫码按钮；天空蓝用于选择边框、焦点与图标强调。浅天空蓝承载选中和摘要背景。

### Neutral

墨蓝用于主内容，灰蓝用于辅助信息。白色分区置于浅蓝灰画布之上，细分隔线辅助组织信息。

警示、危险和成功色表达业务状态。状态标签同时显示文字，不单独依赖颜色。

**The Action Blue Rule.** 主操作使用 primary；accent 用于交互强调，浅蓝底用于选中反馈。

## Typography

全界面使用系统无衬线字体栈，中文回退至 Microsoft YaHei。页面标题、分区标题、任务标题、正文、辅助信息和标签分别采用 frontmatter 中的层级。任务详情标题单独收敛至（21px），摘要计数使用（30px）和等宽数字；窄屏计数收敛至（26px）。

**The Readable Detail Rule.** 任务名称、设备名称和长文允许换行；时间和计数使用等宽数字，不以裁切隐藏作业内容。

## Layout

单列容器全宽，最大宽度（480px），桌面居中。页面左右留白固定（16px），页面上下内边距（20px / 28px）。列表间距（12px），检查区内边距（18px 16px）。宽度不超过（350px）时缩紧部分内部间距，左右 gutter 仍为（16px）。

顶部导航粘性定位，高度包含（58px）及顶部安全区。底部主导航基础高度（64px），包含底部安全区；独立执行页采用固定操作栏，按钮高（44px），主按钮与次按钮的伸缩比为（1.6:1）。页面底部预留（96px）加安全区，避免操作栏遮挡内容。

**The Work First Rule.** 执行页先呈现任务摘要与检查要求，人员信息折叠在检查区下方；转单和原因填写使用底部抽屉。

## Elevation & Depth

自定义分区以白底、浅色底和细边界形成层次，不添加卡片阴影。粘性页头与底部固定区域采用层级（10 / 20）；抽屉和弹层沿用 Ant Design Vue 的组件层级。

## Shapes

白色任务与详情分区使用柔和面板圆角。控件、照片、状态标签使用更小圆角；摘要容器略宽松。底部抽屉仅上角使用 drawer 圆角。照片以（72px）方形网格排列，裁切方式为 cover。

## Components

- **按钮：** Ant Design Vue 主色由 App 主题提供；执行栏主操作比次操作宽。普通主题控件高度（42px），执行栏按钮高度（44px）。禁用态不接受操作，自定义按钮透明度（0.5）。
- **输入：** 白底、柔和边框和 control 圆角；检查结果就地填写，备注允许自动增高。自定义原生输入最小高度（44px）。
- **任务行：** 上方类型与状态，中间任务和设备项目，末行时间。内边距使用 task-row token；按下变浅蓝，具备鼠标悬停时轻微提亮。
- **状态标签：** 紧凑圆角标签，内边距（2px 8px）；进行中蓝色、完成绿色、异常红色、待接单暖色，并保留状态文字。
- **检查项：** 白底面板，序号与检查要求并列；选择按钮最小高（44px），选中以浅蓝底和蓝边反馈，负向结果切换为暖红。照片、备注接在结果后方。
- **导航：** 底部图标加文字，当前项使用主操作蓝和加重字重；详情页以返回导航替换根页面导航。
- **抽屉：** 底部滑出、容器限宽、内容可滚动，并为底部安全区留白。

交互焦点使用天空蓝（2px）轮廓与（3px）外偏移。任务行背景过渡为（0.18s ease-out）；减少动态效果偏好下缩短动画和过渡。

## Do's and Don'ts

### Do:
- **Do** 保持天蓝色主调、白色分区和清楚的状态文字。
- **Do** 保留固定操作栏与正文的安全区留白。
- **Do** 将检查要求置于人员等辅助信息之前。

### Don't:
- **Don't** 将移动作业列表扩展为后台表格或嵌套大卡片。
- **Don't** 用营销插图挤占任务和检查内容。
- **Don't** 将单设备单次执行拆成外协双工单界面。

登录页沿用天蓝色与 Vant 4：紧凑横排标识、单列顶置字段名、浅底输入框与独立主按钮，不使用嵌套卡片。验证码保留在表单内，密码可切换显示；登录校验、加载和错误状态不遮挡输入。
