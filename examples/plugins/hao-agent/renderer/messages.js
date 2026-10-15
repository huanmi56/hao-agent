window.HAO_MESSAGES = {
  en: {
    subtitle: "Your models. One measured workflow.", decision: "Decision", execution: "Execution", review: "Report review", text: "Text",
    scheduler: "Local scheduler", schedulerHint: "Dependencies, writer serialization, checkpoints and call budgets run without model requests.",
    connect: "First connect ChatGPT using the host's vendor sign-in and OpenCode Go using your Go key in Settings > Models. Credentials stay with the host.",
    roles: "Model assignments", select: "Select a connected model", save: "Save assignments", suggest: "Suggest connected models", refresh: "Refresh", saved: "Assignments saved.",
    budget: "Budget discipline", budgetHint: "Per coding job: at most 1 Astra plan, 1 Go report review and 1 Go summary. Text-only jobs skip Astra. Failed requests also consume a reservation. These are call caps, not subscription quota measurements.",
    context: "Astra receives only the focused request and selected context, never the full session. Output length is requested in the prompt; the host API does not expose a hard output-token cap.",
    start: "Start in the main chat with /hao-agent and your task. The parent should use a Go model. The panel never starts work or consumes model quota.",
    jobs: "Recent jobs", empty: "No jobs yet.", calls: "Completion calls", privacy: "No credentials are stored here. Existing host permissions and per-model delegation opt-ins apply.",
    missing: "No connected models found. Connect your providers in the host first.", offline: "Preview only. Open this panel inside PI-Desktop to connect models.",
  },
  zh: {
    subtitle: "你的模型，一套可追踪的工作流。", decision: "决策模型", execution: "执行模型", review: "报告审阅模型", text: "文本模型",
    scheduler: "本地调度器", schedulerHint: "任务依赖、写操作串行、检查点和调用预算由本地程序处理，不消耗模型调用。",
    connect: "先在宿主「设置 → 模型」登录 ChatGPT 订阅，再添加 OpenCode Go 并填写 Go 密钥。凭据由宿主保存，不填到本面板。",
    roles: "模型分工", select: "选择已连接模型", save: "保存分工", suggest: "推荐已连接模型", refresh: "刷新", saved: "模型分工已保存。",
    budget: "额度控制", budgetHint: "每个编程任务最多：1 次 Astra 规划、1 次 Go 报告审阅、1 次 Go 总结。纯文本任务跳过 Astra；失败请求也占用调用预算。这不是订阅剩余额度的测量值。",
    context: "Astra 只接收聚焦的需求和所选上下文，不接收整段会话。输出长度通过提示词约束；宿主接口目前不提供硬性输出 token 上限。",
    start: "在主聊天中输入 /hao-agent 和任务开始使用。父会话建议使用 Go 模型。本面板不启动任务，也不消耗模型额度。",
    jobs: "最近任务", empty: "暂无任务。", calls: "补充模型调用", privacy: "此处不保存密钥。执行仍遵守宿主权限，以及各模型的委派授权。",
    missing: "未发现已连接模型，请先在宿主中连接订阅。", offline: "当前仅为预览；请在 PI-Desktop 中打开本面板来配置模型。",
  },
};
