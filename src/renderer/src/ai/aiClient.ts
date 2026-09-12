import type { AiProgress, AiRunRequest, AiRunResult } from '@shared/ipc'

/**
 * AI 调用入口。抽一层「可替换的执行器」是为了让自动化测试能在**不配置 API Key、
 * 不联网**的情况下走完整条链路（流式进度 → 校验 → 采纳写回）：
 * 测试用一个假执行器把预置文本按块吐出，其余代码路径完全真实。
 */
export type AiRunner = (
  req: AiRunRequest,
  onProgress: (progress: AiProgress) => void
) => Promise<AiRunResult>

let injected: AiRunner | null = null

export function setAiRunnerForTest(runner: AiRunner | null): void {
  injected = runner
}

/** 真实通道（走 IPC）。自测里用来单独验证「参数能否跨进程传递」 */
export const realRun: AiRunner = (req, onProgress) => {
  // 只转发本任务的进度：同时进行的导入解析不会被这里的进度串台
  const off = window.myresume.ai.onProgress((p) => {
    if (p.taskId === req.taskId) onProgress(p)
  })
  return window.myresume.ai.run(req).finally(off)
}

export const runAi: AiRunner = (req, onProgress) => (injected ?? realRun)(req, onProgress)
