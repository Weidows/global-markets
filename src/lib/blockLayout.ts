export type Block = {
  code: string
  /** 真实地理锚点（投影点） */
  ax: number
  ay: number
  /** 避让后的中心 */
  x: number
  y: number
  w: number
  h: number
  moved: boolean
}

/**
 * 柱状图块的避让。每个市场是一块「名称 + 七根柱 + 涨跌幅」的矩形，
 * 东亚、西欧的块会叠在一起（上海/深圳/香港、伦敦/巴黎/法兰克福都在几百像素内），
 * 所以按 AABB 沿"重叠更轻的那根轴"推开，再向锚点回拉。
 */
export function layoutBlocks(
  input: { code: string; x: number; y: number; ax: number; ay: number; w: number; h: number }[],
  W: number,
  H: number,
  gap = 6,
): Block[] {
  const nodes: Block[] = input.map((b) => ({
    code: b.code,
    ax: b.ax,
    ay: b.ay,
    x: b.x,
    y: b.y,
    w: b.w,
    h: b.h,
    moved: false,
  }))
  const n = nodes.length

  for (let iter = 0; iter < 700; iter++) {
    for (let i = 0; i < n; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const ox = (a.w + b.w) / 2 + gap - Math.abs(dx)
        const oy = (a.h + b.h) / 2 + gap - Math.abs(dy)
        if (ox <= 0 || oy <= 0) continue
        if (ox < oy) {
          const s = dx >= 0 ? 1 : -1
          a.x -= (s * ox) / 2
          b.x += (s * ox) / 2
        } else {
          const s = dy >= 0 ? 1 : -1
          a.y -= (s * oy) / 2
          b.y += (s * oy) / 2
        }
      }
    }
    for (const t of nodes) {
      t.x += (t.ax - t.x) * 0.01
      t.y += (t.ay - t.y) * 0.01
      t.x = Math.max(t.w / 2, Math.min(W - t.w / 2, t.x))
      t.y = Math.max(t.h / 2, Math.min(H - t.h / 2, t.y))
    }
  }

  for (const t of nodes) {
    t.x = Math.round(t.x * 10) / 10
    t.y = Math.round(t.y * 10) / 10
    t.moved = Math.hypot(t.x - t.ax, t.y - t.ay) > 8
  }
  return nodes
}
