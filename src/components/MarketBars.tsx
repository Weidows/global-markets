import { useMemo } from 'react'
import { BORDER_PATH, GRATICULE_PATH, LAND_PATH, MAP_HEIGHT, MAP_WIDTH, POINTS, VIEW_BOX } from '../data/geo.generated'
import { layoutBlocks } from '../lib/blockLayout'
import { fmtPct, toneOf, type Market } from '../lib/market'

type Props = {
  markets: Market[]
  hovered: string | null
  selected: string | null
  onHover: (code: string | null, pos?: { x: number; y: number }) => void
  onSelect: (code: string | null) => void
}

const BLOCK_W = 54
const BLOCK_H = 48
const BAR_W = 4.7
const BAR_GAP = 1.5
const BAR_MAX_H = 10
const BARS = 7

function toneClass(p: number) {
  const t = toneOf(p)
  return t === 'up' ? 'u' : t === 'down' ? 'd' : 'f'
}

function toneFill(p: number) {
  const t = toneOf(p)
  return t === 'up' ? '#ff5f5f' : t === 'down' ? '#35d08a' : '#93a3ab'
}

export default function MarketBars({ markets, hovered, selected, onHover, onSelect }: Props) {
  const { blocks, scale } = useMemo(() => {
    const nodes = markets
      .filter((m) => POINTS[m.code])
      .map((m) => {
        const p = POINTS[m.code]
        const nx = m.nudge?.[0] ?? 0
        const ny = m.nudge?.[1] ?? 0
        return { code: m.code, ax: p[0], ay: p[1], x: p[0] + nx, y: p[1] + ny, w: BLOCK_W, h: BLOCK_H }
      })
    // 全局统一刻度：柱高可以直接横向比较，最小刻度 2% 防止微小波动被放大
    let maxAbs = 2
    for (const m of markets) {
      for (const d of m.history ?? []) maxAbs = Math.max(maxAbs, Math.abs(d.p))
      if (m.quote) maxAbs = Math.max(maxAbs, Math.abs(m.quote.pct))
    }
    // 柱高：线性 8px / 1%，封顶 10px（≈1.25%），再大的波动柱子一样高，靠数字区分
    return { blocks: layoutBlocks(nodes, MAP_WIDTH, MAP_HEIGHT, 16), scale: 8 }
  }, [markets])

  const byCode = useMemo(() => new Map(markets.map((m) => [m.code, m])), [markets])

  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label="全球主要股指最近一周涨跌柱状图">
      <g>
        <path d={GRATICULE_PATH} className="graticule" />
        <path d={LAND_PATH} className="land" />
        <path d={BORDER_PATH} className="border" />
      </g>

      <g>
        {blocks
          .filter((b) => b.moved)
          .map((b) => (
            <g key={`lead-${b.code}`}>
              <line className="leader" x1={b.ax} y1={b.ay} x2={b.x} y2={b.y} />
              <circle className="anchor-dot" cx={b.ax} cy={b.ay} r={1.8} />
            </g>
          ))}
      </g>

      <g>
        {blocks.map((b) => {
          const m = byCode.get(b.code)
          if (!m) return null
          const days = (m.history ?? []).slice(-BARS)
          const fallback = m.quote ? [{ d: '今日', c: m.quote.price, p: m.quote.pct }] : []
          const series = days.length ? days : fallback
          if (!series.length) return null
          const last = series[series.length - 1]
          const first = series[0]
          // 一周累计：按各日涨跌幅复合
          const cum = series.reduce((acc, d) => acc * (1 + d.p / 100), 1)
          const week = series.length > 1 ? (cum - 1) * 100 : null
          const totalW = series.length * BAR_W + (series.length - 1) * BAR_GAP
          const startX = -totalW / 2
          const handleMove = (e: React.MouseEvent) => onHover(b.code, { x: e.clientX, y: e.clientY })
          return (
            <g
              key={b.code}
              className="barblock"
              transform={`translate(${b.x} ${b.y})`}
              data-bar={b.code}
              data-selected={selected === b.code}
              data-dim={hovered != null && hovered !== b.code ? 'true' : undefined}
              onMouseMove={handleMove}
              onMouseEnter={handleMove}
              onMouseLeave={() => onHover(null)}
              onClick={(e) => {
                e.stopPropagation()
                onSelect(selected === b.code ? null : b.code)
              }}
            >
              <rect className="hit" x={-BLOCK_W / 2} y={-BLOCK_H / 2} width={BLOCK_W} height={BLOCK_H} rx={5} />
              <text className="bar-name" y={-15} textAnchor="middle">
                {m.short}
              </text>
              <line className="baseline" x1={-totalW / 2 - 2} x2={totalW / 2 + 2} y1={0} y2={0} />
              {series.map((d, i) => {
                const h = Math.max(1.4, Math.min(BAR_MAX_H, Math.abs(d.p) * scale))
                const up = d.p >= 0
                return (
                  <rect
                    key={`${d.d}-${i}`}
                    className="bar"
                    x={startX + i * (BAR_W + BAR_GAP)}
                    y={up ? -h : 0}
                    width={BAR_W}
                    height={h}
                    rx={0.9}
                    fill={toneFill(d.p)}
                  />
                )
              })}
              <text className={`bar-pct ${toneClass(last.p)}`} y={21} textAnchor="middle">
                {fmtPct(last.p)}
              </text>
              <title>{`${m.name} ${first?.d}–${last?.d} 区间 ${fmtPct(week)}`}</title>
            </g>
          )
        })}
      </g>
    </svg>
  )
}
