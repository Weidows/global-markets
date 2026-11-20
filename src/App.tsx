import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import WorldMap from './components/WorldMap'
import MarketPanel, { TipCard } from './components/MarketPanel'
import placesRaw from './data/places.json'
import {
  fmtPct,
  loadSnapshot,
  toneOf,
  weekdayZh,
  type Market,
  type Place,
  type Snapshot,
} from './lib/market'

const PLACES = placesRaw as Place[]

type HoverState = { code: string; x: number; y: number } | null

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'core' | 'all'>('core')
  const [hover, setHover] = useState<HoverState>(null)
  const [pinned, setPinned] = useState<HoverState>(null)
  const [showList, setShowList] = useState(false)
  const mouse = useRef({ x: 0, y: 0 })

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const s = await loadSnapshot()
      setSnap(s)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const markets: Market[] = useMemo(() => {
    const q = new Map((snap?.quotes ?? []).map((x) => [x.code, x]))
    return PLACES.map((p) => ({ ...p, quote: q.get(p.code) ?? null }))
  }, [snap])

  const shown = useMemo(() => (view === 'core' ? markets.filter((m) => m.core) : markets), [markets, view])

  const selected = pinned?.code ?? null
  const tipCode = hover?.code ?? pinned?.code ?? null
  const tipPos = hover ?? pinned
  const tipMarket = tipCode ? markets.find((m) => m.code === tipCode) : undefined

  const onHover = useCallback((code: string | null, pos?: { x: number; y: number }) => {
    if (code && pos) {
      mouse.current = pos
      setHover({ code, x: pos.x, y: pos.y })
    } else {
      setHover(null)
    }
  }, [])

  const onSelect = useCallback((code: string | null) => {
    if (!code) {
      setPinned(null)
      return
    }
    setPinned({ code, x: mouse.current.x, y: mouse.current.y })
  }, [])

  const counts = snap?.counts
  const sorted = useMemo(() => [...markets].sort((a, b) => (a.quote?.pct ?? 0) - (b.quote?.pct ?? 0)), [markets])
  const nameOf = (code: string | null | undefined) => markets.find((m) => m.code === code)?.short ?? code ?? '—'
  const gen = snap?.generatedAt ?? ''

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>全球市场地图</h1>
          <span className="sub">
            {gen.slice(0, 10)} 周{weekdayZh(gen)} · {gen.slice(11, 16)} 更新
          </span>
        </div>
        <div className="spacer" />
        <div className="seg" role="group" aria-label="显示范围">
          <button aria-pressed={view === 'core'} onClick={() => setView('core')}>
            主要市场 {markets.filter((m) => m.core).length}
          </button>
          <button aria-pressed={view === 'all'} onClick={() => setView('all')}>
            全部 {markets.length}
          </button>
        </div>
        <button className="iconbtn" data-on={showList} onClick={() => setShowList((v) => !v)} aria-pressed={showList}>
          市场列表
        </button>
        <button className="iconbtn" onClick={() => void reload()} disabled={loading}>
          {loading ? '更新中…' : '刷新'}
        </button>
      </header>

      <main className="stage" onClick={() => setPinned(null)}>
        <div className="mapwrap">
          <div className="mapbox">
            <WorldMap
              markets={shown}
              hovered={tipCode}
              selected={selected}
              compact={view === 'all'}
              onHover={onHover}
              onSelect={onSelect}
            />
          </div>
        </div>

        <div className="legend">
          <div className="scale">
            {[1, 3, 6].map((v) => (
              <span
                key={v}
                className="dot"
                style={{ width: 16 + v * 7, height: 16 + v * 7, marginRight: 6 }}
                aria-hidden
              />
            ))}
            <span style={{ marginLeft: 4 }}>1% · 3% · 6%</span>
          </div>
          <div>气泡越大，当日波动越大 · 绿跌红涨</div>
        </div>

        <div className="hint">
          悬停气泡看详情，点击固定
          <br />
          每 {snap ? '小时' : '—'} 自动更新
        </div>

        {loading && !snap && (
          <div className="loading">
            <div>
              <div className="spin" />
              正在加载行情快照…
            </div>
          </div>
        )}

        {error && !snap && (
          <div className="failed">
            <div>
              行情数据读取失败
              <br />
              <code>{error}</code>
              <br />
              <br />
              先运行 <code>node scripts/fetch-data.mjs</code> 生成快照
            </div>
          </div>
        )}

        {!showList && tipMarket && tipPos && <TipCard m={tipMarket} x={tipPos.x} y={tipPos.y} />}

        {showList && (
          <MarketPanel
            markets={markets}
            selected={selected}
            onSelect={onSelect}
            onClose={() => setShowList(false)}
          />
        )}
      </main>

      <footer className="statbar">
        <div>
          <div className="k">上涨</div>
          <div className="v u">{counts?.up ?? '—'}</div>
        </div>
        <div>
          <div className="k">下跌</div>
          <div className="v d">{counts?.down ?? '—'}</div>
        </div>
        <div>
          <div className="k">平盘</div>
          <div className="v f">{counts?.flat ?? '—'}</div>
        </div>
        <div>
          <div className="k">平均</div>
          <div className="v" style={{ color: toneOf(snap?.stats.avgPct) === 'up' ? 'var(--up)' : 'var(--down)' }}>
            {fmtPct(snap?.stats.avgPct ?? null)}
          </div>
        </div>
        <div>
          <div className="k">最深跌幅</div>
          <div className="v d" style={{ fontSize: 13.5 }}>
            {nameOf(snap?.stats.worst?.code)} {fmtPct(snap?.stats.worst?.pct ?? null)}
          </div>
        </div>

        <div className="distro" aria-hidden>
          {sorted.map((m) => {
            const pct = m.quote?.pct ?? 0
            const tone = toneOf(pct)
            const alpha = Math.min(1, 0.35 + Math.abs(pct) / 6)
            const color =
              tone === 'up' ? `rgba(255,95,95,${alpha})` : tone === 'down' ? `rgba(53,208,138,${alpha})` : `rgba(147,163,171,${alpha})`
            return (
              <i
                key={m.code}
                style={{ background: color }}
                title={`${m.name} ${fmtPct(pct)}`}
                onMouseEnter={() => setHover({ code: m.code, x: window.innerWidth / 2, y: 160 })}
                onMouseLeave={() => setHover(null)}
                onClick={() => setPinned({ code: m.code, x: window.innerWidth / 2, y: 300 })}
              />
            )
          })}
        </div>

        <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted-2)', textAlign: 'right', lineHeight: 1.5 }}>
          {snap?.source.name} · 定时更新
          <br />
          {gen.slice(0, 10)} {gen.slice(11, 16)} 北京时间
        </div>
      </footer>
    </div>
  )
}
