import { fmtBeijing, fmtPct, REGION_LABEL, toneOf, type Market } from '../lib/market'

export default function MarketPanel({
  markets,
  selected,
  onSelect,
  onClose,
}: {
  markets: Market[]
  selected: string | null
  onSelect: (code: string | null) => void
  onClose: () => void
}) {
  const sorted = [...markets].sort((a, b) => (a.quote?.pct ?? 0) - (b.quote?.pct ?? 0))
  const groups = new Map<string, Market[]>()
  for (const m of sorted) {
    const key = REGION_LABEL[m.region]
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(m)
  }

  return (
    <aside className="panel" aria-label="全部市场">
      <header>
        <h2>
          全部市场 <span style={{ color: 'var(--muted-2)', fontWeight: 400, fontSize: 12 }}>{sorted.length} 个</span>
        </h2>
        <button className="iconbtn" onClick={onClose}>
          收起 ✕
        </button>
      </header>
      <div className="rows">
        {[...groups.entries()].map(([label, list]) => (
          <div key={label}>
            <div className="rgroup">{label}</div>
            {list.map((m) => {
              const tone = toneOf(m.quote?.pct)
              return (
                <div
                  key={m.code}
                  className="prow"
                  data-selected={selected === m.code}
                  onClick={() => onSelect(selected === m.code ? null : m.code)}
                >
                  <div className="pn">
                    <b>{m.name}</b>
                    <span>
                      {m.city} · {m.country}
                    </span>
                  </div>
                  <div className={`pp ${tone === 'up' ? 'u' : tone === 'down' ? 'd' : 'f'}`}>{fmtPct(m.quote?.pct)}</div>
                  <div className="pv">{m.quote ? m.quote.price.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'}</div>
                </div>
              )
            })}
          </div>
        ))}
        <div className="rgroup">行情时间</div>
        <div style={{ fontSize: 11, color: 'var(--muted-2)', padding: '0 10px 8px', lineHeight: 1.7 }}>
          每个市场的最新报价时间见气泡悬停卡片；各交易所收盘时间不同，最新价与当日涨跌幅均取自数据源的最近一次报价。
          <br />
          数据源：东方财富 · 仅供观察，不构成投资建议。
        </div>
      </div>
    </aside>
  )
}

export function TipCard({ m, x, y }: { m: Market; x: number; y: number }) {
  const tone = toneOf(m.quote?.pct)
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const flipX = x > vw - 280
  // 靠上的气泡让卡片向下展开，避免压住顶栏
  const below = y < 240
  const top = Math.max(76, Math.min(y, vh - 30))
  const style: React.CSSProperties = {
    left: flipX ? Math.min(x, vw - 12) : x,
    top,
    transform: `translate(${flipX ? 'calc(-100% - 26px)' : '26px'}, ${below ? '0' : '-50%'})`,
  }
  return (
    <div className="tip" style={style} role="tooltip">
      <div className="tname">
        {m.name}
        <span style={{ fontSize: 10.5, color: 'var(--muted-2)', fontWeight: 400 }}>{m.code}</span>
      </div>
      <div className="twhere">
        {m.city} · {m.country} · {REGION_LABEL[m.region]}
      </div>
      <div className={`tpct ${tone === 'up' ? 'u' : tone === 'down' ? 'd' : 'f'}`}>{fmtPct(m.quote?.pct)}</div>
      <div className="trow">
        <span>最新点位</span>
        <b>{m.quote ? m.quote.price.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'}</b>
      </div>
      <div className="trow">
        <span>涨跌点数</span>
        <b>
          {m.quote
            ? `${m.quote.change > 0 ? '+' : ''}${m.quote.change.toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`
            : '—'}
        </b>
      </div>
      {m.history && m.history.length > 1 && (
        <div className="wk">
          {m.history.slice(-7).map((d) => {
            const t = toneOf(d.p)
            return (
              <div className="wkr" key={d.d}>
                <span>{d.d}</span>
                <span className={t === 'up' ? 'u' : t === 'down' ? 'd' : 'f'}>{fmtPct(d.p)}</span>
              </div>
            )
          })}
          <div className="wkr total">
            <span>区间累计</span>
            <span
              className={
                m.history.slice(-7).reduce((a, d) => a * (1 + d.p / 100), 1) >= 1
                  ? 'u'
                  : 'd'
              }
            >
              {fmtPct((m.history.slice(-7).reduce((a, d) => a * (1 + d.p / 100), 1) - 1) * 100)}
            </span>
          </div>
        </div>
      )}
      <div className="ft">报价时间 {fmtBeijing(m.quote?.quoteTime ?? null)}（北京时间）</div>
    </div>
  )
}
