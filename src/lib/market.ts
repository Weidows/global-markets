export type Region = 'asia' | 'europe' | 'americas' | 'oceania' | 'africa-me'

export type Place = {
  code: string
  market: string
  name: string
  short: string
  city: string
  country: string
  lat: number
  lon: number
  region: Region
  core: boolean
  /** 同一城市多个指数时的手工初始偏移（viewBox 单位），缓解避让算法把气泡推太远 */
  nudge?: [number, number]
}

export type Quote = {
  code: string
  market: string
  name: string
  price: number
  change: number
  pct: number
  quoteTime: string | null
}

export type Snapshot = {
  generatedAt: string
  source: { name: string; url: string }
  counts: { total: number; up: number; down: number; flat: number }
  stats: {
    worst: { code: string; pct: number } | null
    best: { code: string; pct: number } | null
    avgPct: number | null
  }
  quotes: Quote[]
}

export type Market = Place & { quote: Quote | null }

export type Tone = 'up' | 'down' | 'flat'

export const REGION_LABEL: Record<Region, string> = {
  asia: '亚太',
  europe: '欧洲',
  americas: '美洲',
  oceania: '大洋洲',
  'africa-me': '中东非洲',
}

export function toneOf(pct: number | null | undefined): Tone {
  if (pct == null || !Number.isFinite(pct)) return 'flat'
  if (pct > 0.0001) return 'up'
  if (pct < -0.0001) return 'down'
  return 'flat'
}

/** 气泡半径：随 |涨跌幅| 线性放大，避免极值把地图撑爆 */
export function radiusOf(pct: number | null | undefined): number {
  const a = Math.min(Math.abs(pct ?? 0), 9)
  return Math.round(Math.max(29, Math.min(84, 30 + 13.5 * Math.sqrt(a))))
}

export function fmtPct(pct: number | null | undefined): string {
  if (pct == null || !Number.isFinite(pct)) return '—'
  const sign = pct > 0 ? '+' : pct < 0 ? '' : '±'
  return `${sign}${pct.toFixed(2)}%`
}

export function fmtNum(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return '—'
  return v.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export async function loadSnapshot(): Promise<Snapshot> {
  const url = `${import.meta.env.BASE_URL}data/snapshot.json?t=${Date.now()}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`snapshot ${res.status}`)
  return (await res.json()) as Snapshot
}

/** 北京时间的相对/绝对显示 */
export function fmtBeijing(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const p = (n: number) => String(n).padStart(2, '0')
  // 直接取 +08:00 的墙钟时间，避免受本机时区影响
  const t = new Date(d.getTime() + 8 * 3600 * 1000)
  return `${t.getUTCMonth() + 1}/${t.getUTCDate()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`
}

export function weekdayZh(iso: string): string {
  const d = new Date(iso)
  const t = new Date(d.getTime() + 8 * 3600 * 1000)
  return '日一二三四五六'[t.getUTCDay()]
}
