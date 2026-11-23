import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import MarketBars from './components/MarketBars'
import MarketPanel, { TipCard } from './components/MarketPanel'
import placesRaw from './data/places.json'
import {
  fmtPct,
  loadHistory,
  loadSnapshot,
  toneOf,
  weekdayZh,
  type History,
  type Market,
  type Place,
  type Snapshot,
} from './lib/market'

const PLACES = placesRaw as Place[]

type HoverState = { code: string; x: number; y: number } | null

export default function App() {
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [hist, setHist] = useState<History | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [hover, setHover] = useState<HoverState>(null)
  const [pinned, setPinned] = useState<HoverState>(null)
  const [showList, setShowList] = useState(false)
  const mouse = useRef({ x: 0, y: 0 })

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, h] = await Promise.all([loadSnapshot(), loadHistory()])
      setSnap(s)
      setHist(h)
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
    return PLACES.map((p) => ({ ...p, quote: q.get(p.code) ?? null, history: hist?.series[p.code] ?? null }))
  }, [snap, hist])

  const core = useMemo(() => markets.filter((m) => m.core), [markets])
  const weekRange = useMemo(() => {
    const s = hist ? Object.values(hist.series).find((a) => a.length >= 5) : null
    return s && s.length ? `${s[0].d} – ${s[s.length - 1].d}` : null
  }, [hist])

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
          <h1>全球市场 · 一周涨跌</h1>
          <span className="sub">
            {gen.slice(0, 10)} 周{weekdayZh(gen)} · {gen.slice(11, 16)} 更新
            {weekRange ? ` · 周线 ${weekRange}` : ''}
          </span>
        </div>
        <div className="spacer" />
        <button className="iconbtn" data-on={showList} onClick={() => setShowList((v) => !v)} aria-pressed={showList}>
          全部市场 {markets.length}
        </button>
        <button className="iconbtn" onClick={() => void reload()} disabled={loading}>
          {loading ? '更新中…' : '刷新'}
        </button>
      </header>

      <main className="stage" onClick={() => setPinned(null)}>
        <div className="mapwrap">
          <div className="mapbox">
            <MarketBars markets={core} hovered={tipCode} selected={selected} onHover={onHover} onSelect={onSelect} />
          </div>
        </div>

        <div className="legend">
          <div className="lgrow">
            <span className="lgbars">
              <i style={{ height: 5, background: 'var(--down)' }} />
              <i style={{ height: 13, background: 'var(--down)' }} />
              <i style={{ height: 9, background: 'var(--down)' }} />
              <i style={{ height: 4, background: 'var(--up)' }} />
            </span>
            <span>每块 7 根柱 = 最近 7 个交易日，柱高 = 当日涨跌幅</span>
          </div>
          <div className="lgrow dim">绿跌红涨 · 柱高按全图统一刻度，可直接横向比较</div>
        </div>

        <div className="hint">
          悬停看一周明细，点击固定
          <br />
          行情每小时更新，日线每天一次
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
              先运行 <code>node scripts/fetch-data.mjs</code> 生成数据
            </div>
          </div>
        )}

        {!showList && tipMarket && tipPos && <TipCard m={tipMarket} x={tipPos.x} y={tipPos.y} />}

        {showList && (
          <MarketPanel markets={markets} selected={selected} onSelect={onSelect} onClose={() => setShowList(false)} />
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
              tone === 'up'
                ? `rgba(255,95,95,${alpha})`
                : tone === 'down'
                  ? `rgba(53,208,138,${alpha})`
                  : `rgba(147,163,171,${alpha})`
            return (
              <i
                key={m.code}
                style={{ background: color }}
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
