export type Bubble = {
  code: string
  /** 真实地理锚点（投影点） */
  ax: number
  ay: number
  /** 避让后的中心 */
  x: number
  y: number
  r: number
  moved: boolean
}

/**
 * 气泡避让：同一座城市常有多个指数（纽约四个、上海三个），
 * 直接在同一个经纬度上叠气泡会互相遮住。这里用带向心约束的斥力松弛把它们摊开，
 * 摊得远的画一条引线指回真实位置。
 */
export function layoutBubbles(
  input: { code: string; x: number; y: number; ax: number; ay: number; r: number }[],
  W: number,
  H: number,
): Bubble[] {
  const nodes: Bubble[] = input.map((b) => ({
    code: b.code,
    ax: b.ax,
    ay: b.ay,
    x: b.x,
    y: b.y,
    r: b.r,
    moved: false,
  }))
  const n = nodes.length

  for (let iter = 0; iter < 420; iter++) {
    for (let i = 0; i < n; i++) {
      const a = nodes[i]
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j]
        let dx = b.x - a.x
        let dy = b.y - a.y
        let d = Math.hypot(dx, dy)
        const minD = a.r + b.r + 4
        if (d >= minD) continue
        if (d < 0.5) {
          dx = Math.cos((i + 1) * 1.7)
          dy = Math.sin((i + 1) * 1.7)
          d = 1
        }
        const ux = dx / d
        const uy = dy / d
        // 大半径的气泡更"稳"，小气泡让位更多
        const total = a.r + b.r
        const pushA = ((minD - d) * (b.r / total)) / 2
        const pushB = ((minD - d) * (a.r / total)) / 2
        a.x -= ux * pushA
        a.y -= uy * pushA
        b.x += ux * pushB
        b.y += uy * pushB
      }
    }
    // 向锚点回拉，避免散成一团
    for (const t of nodes) {
      t.x += (t.ax - t.x) * 0.045
      t.y += (t.ay - t.y) * 0.045
      t.x = Math.max(t.r * 1, Math.min(W - t.r, t.x))
      t.y = Math.max(t.r * 1, Math.min(H - t.r, t.y))
    }
  }

  for (const t of nodes) {
    t.x = Math.round(t.x * 10) / 10
    t.y = Math.round(t.y * 10) / 10
    t.moved = Math.hypot(t.x - t.ax, t.y - t.ay) > 6
  }
  return nodes
}
