import { useMemo } from 'react'
import { BORDER_PATH, GRATICULE_PATH, LAND_PATH, MAP_HEIGHT, MAP_WIDTH, POINTS, VIEW_BOX } from '../data/geo.generated'
import { layoutBubbles } from '../lib/layout'
import { fmtPct, radiusOf, toneOf, type Market } from '../lib/market'

type Props = {
  markets: Market[]
  hovered: string | null
  selected: string | null
  /** 全量视图：气泡缩成小圆点，只保留悬停详情，避免五十多个大气泡糊成一片 */
  compact: boolean
  onHover: (code: string | null, pos?: { x: number; y: number }) => void
  onSelect: (code: string | null) => void
}

export default function WorldMap({ markets, hovered, selected, compact, onHover, onSelect }: Props) {
  const bubbles = useMemo(() => {
    const nodes = markets
      .filter((m) => POINTS[m.code])
      .map((m) => {
        const p = POINTS[m.code]
        const nx = m.nudge?.[0] ?? 0
        const ny = m.nudge?.[1] ?? 0
        return {
          code: m.code,
          ax: p[0],
          ay: p[1],
          x: p[0] + nx,
          y: p[1] + ny,
          r: compact ? 15 : radiusOf(m.quote?.pct),
        }
      })
    return layoutBubbles(nodes, MAP_WIDTH, MAP_HEIGHT)
  }, [markets, compact])

  const byCode = useMemo(() => new Map(markets.map((m) => [m.code, m])), [markets])

  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label="全球主要股指当日涨跌地图">
      <defs>
        <radialGradient id="g-down" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#3fbf87" stopOpacity="0.96" />
          <stop offset="62%" stopColor="#1e7a53" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#12523a" stopOpacity="0.94" />
        </radialGradient>
        <radialGradient id="g-up" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#ff8b8b" stopOpacity="0.96" />
          <stop offset="62%" stopColor="#c93b3b" stopOpacity="0.94" />
          <stop offset="100%" stopColor="#8d2424" stopOpacity="0.94" />
        </radialGradient>
        <radialGradient id="g-flat" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#a9b8bf" stopOpacity="0.92" />
          <stop offset="62%" stopColor="#6e7d84" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#4b575d" stopOpacity="0.9" />
        </radialGradient>
        <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g>
        <path d={GRATICULE_PATH} className="graticule" />
        <path d={LAND_PATH} className="land" />
        <path d={BORDER_PATH} className="border" />
      </g>

      <g>
        {bubbles
          .filter((b) => b.moved)
          .map((b) => (
            <g key={`lead-${b.code}`}>
              <line className="leader" x1={b.ax} y1={b.ay} x2={b.x} y2={b.y} />
              <circle className="anchor-dot" cx={b.ax} cy={b.ay} r={1.8} />
            </g>
          ))}
      </g>

      <g>
        {bubbles.map((b) => {
          const m = byCode.get(b.code)
          if (!m) return null
          const pct = m.quote?.pct ?? null
          const tone = toneOf(pct)
          const showName = !compact && b.r >= 32
          const name = m.short
          // 中文字宽≈1em，英文/数字≈0.56em，按视觉宽度反算字号，避免文字冲出气泡
          const visual = [...name].reduce((s, ch) => s + (/[\u4e00-\u9fa5]/.test(ch) ? 1 : 0.56), 0)
          const nameSize = Math.max(8, Math.min(16, b.r * 0.31, (b.r * 1.72) / Math.max(2, visual)))
          const pctSize = Math.max(11, Math.min(25, b.r * 0.42, (b.r * 1.5) / 6.4))
          const dot = compact && !showName
          const handleMove = (e: React.MouseEvent) => onHover(b.code, { x: e.clientX, y: e.clientY })
          return (
            <g
              key={b.code}
              className={`bubble tone-${tone}`}
              transform={`translate(${b.x} ${b.y})`}
              data-bubble={b.code}
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
              <circle className="halo" r={compact ? b.r * 1.5 : b.r * 1.14} />
              <circle className="core" r={b.r} filter="url(#softGlow)" />
              {showName ? (
                <>
                  <text className="name" textAnchor="middle" fontSize={nameSize} y={-pctSize * 0.42}>
                    {name}
                  </text>
                  <text className="pct" textAnchor="middle" fontSize={pctSize} y={pctSize * 0.86}>
                    {fmtPct(pct)}
                  </text>
                </>
              ) : dot ? null : (
                <text className="pct" textAnchor="middle" fontSize={pctSize} y={pctSize * 0.36}>
                  {fmtPct(pct)}
                </text>
              )}
            </g>
          )
        })}
      </g>
    </svg>
  )
}
