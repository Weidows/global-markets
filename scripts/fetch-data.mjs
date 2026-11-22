// 抓取全球主要股指 → public/data/snapshot.json
// 数据源: 东方财富行情接口 (push2.eastmoney.com)
// 用法: node scripts/fetch-data.mjs [--out public/data/snapshot.json]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')
const outArg = process.argv.indexOf('--out')
const OUT = outArg > -1 ? path.resolve(process.argv[outArg + 1]) : path.join(root, 'public/data/snapshot.json')

const places = JSON.parse(fs.readFileSync(path.join(root, 'src/data/places.json'), 'utf8'))
const FIELDS = 'f1,f2,f3,f4,f12,f13,f14,f124,f152'

const HOSTS = [
  'https://push2.eastmoney.com',
  'https://push2delay.eastmoney.com',
  'https://82.push2.eastmoney.com',
]

async function fetchBatch(secids) {
  const qs = `fltt=2&invt=2&fields=${FIELDS}&secids=${secids.join(',')}&_=${Date.now()}`
  let lastErr
  for (const host of HOSTS) {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 20000)
      const res = await fetch(`${host}/api/qt/ulist.np/get?${qs}`, {
        signal: ctl.signal,
        headers: {
          Referer: 'https://quote.eastmoney.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        },
      }).finally(() => clearTimeout(timer))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const diff = json?.data?.diff
      if (!Array.isArray(diff) || diff.length === 0) throw new Error('空数据: ' + JSON.stringify(json).slice(0, 160))
      return diff
    } catch (e) {
      lastErr = e
      console.warn(`  ${host} 失败: ${e.message}`)
    }
  }
  throw lastErr
}

const HISTORY_OUT = path.join(root, 'public/data/history.json')
const KLINE_DAYS = 8
const KLINE_HOSTS = ['https://push2his.eastmoney.com', 'https://push2his.eastmoney.com', 'https://push2his.eastmoney.com']

/**
 * 日线：只抓"地图上要画的"核心市场，且每天只抓一次。
 * push2his 对密集请求敏感（连发 50 次会被临时断连），所以这里串行 + 间隔 + 重试。
 */
async function fetchKline(p) {
  const qs = `secid=${p.market}.${p.code}&klt=101&fqt=1&lmt=${KLINE_DAYS}&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f53,f59&_=${Date.now()}`
  let lastErr
  for (const host of KLINE_HOSTS) {
    try {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), 15000)
      const res = await fetch(`${host}/api/qt/stock/kline/get?${qs}`, {
        signal: ctl.signal,
        headers: {
          Referer: 'https://quote.eastmoney.com/',
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
        },
      }).finally(() => clearTimeout(timer))
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      const klines = json?.data?.klines
      if (!Array.isArray(klines) || klines.length === 0) throw new Error('无日线数据')
      return klines.map((line) => {
        const [d, c, pct] = line.split(',')
        return { d: d.slice(5), c: Number(c), p: Number(pct) }
      })
    } catch (e) {
      lastErr = e
    }
  }
  throw lastErr
}

function historyIsFresh() {
  try {
    const h = JSON.parse(fs.readFileSync(HISTORY_OUT, 'utf8'))
    if (!h?.generatedAt) return false
    return h.generatedAt.slice(0, 10) === nowCstIso().slice(0, 10)
  } catch {
    return false
  }
}

async function updateHistory(force) {
  if (!force && historyIsFresh()) {
    console.log('一周日线：今天已抓过，跳过')
    return
  }
  const targets = places.filter((p) => p.core)
  const series = {}
  const failed = []
  for (let i = 0; i < targets.length; i++) {
    const p = targets[i]
    try {
      series[p.code] = await fetchKline(p)
    } catch (e) {
      failed.push(`${p.code}(${e.message})`)
      process.stdout.write(`\r  日线 ${i + 1}/${targets.length} 失败 ${p.code}  `)
    }
    await new Promise((r) => setTimeout(r, 900))
  }
  const okCount = Object.keys(series).length
  console.log(`\r一周日线：成功 ${okCount}/${targets.length}${failed.length ? '，失败 ' + failed.join(' ') : ''}`)
  if (okCount === 0) return
  const payload = { generatedAt: nowCstIso(), days: KLINE_DAYS, series }
  fs.writeFileSync(HISTORY_OUT, JSON.stringify(payload, null, 2) + '\n')
  console.log(`已写入 ${path.relative(root, HISTORY_OUT)}`)
}

function cstIso(unixSec) {
  if (!unixSec || unixSec <= 0) return null
  const d = new Date((unixSec + 8 * 3600) * 1000)
  return d.toISOString().replace('Z', '+08:00')
}

function nowCstIso() {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  return d.toISOString().replace('Z', '+08:00')
}

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

async function main() {
  const secids = places.map((p) => `${p.market}.${p.code}`)
  const batches = []
  for (let i = 0; i < secids.length; i += 30) batches.push(secids.slice(i, i + 30))

  const raw = []
  for (const b of batches) raw.push(...(await fetchBatch(b)))

  const byCode = new Map()
  for (const r of raw) {
    const key = `${r.f13}.${r.f12}`
    byCode.set(key, r)
  }

  const quotes = []
  const missing = []
  for (const p of places) {
    const r = byCode.get(`${p.market}.${p.code}`)
    if (!r || num(r.f2) === null || num(r.f3) === null) {
      missing.push(p.code)
      continue
    }
    quotes.push({
      code: p.code,
      market: p.market,
      name: p.name,
      price: num(r.f2),
      change: num(r.f4),
      pct: num(r.f3),
      quoteTime: cstIso(num(r.f124)),
    })
  }

  const up = quotes.filter((q) => q.pct > 0.0001).length
  const down = quotes.filter((q) => q.pct < -0.0001).length
  const flat = quotes.length - up - down
  const sorted = [...quotes].sort((a, b) => a.pct - b.pct)

  const snapshot = {
    generatedAt: nowCstIso(),
    source: { name: '东方财富', url: 'https://quote.eastmoney.com/center/gridlist.html#global_index' },
    counts: { total: quotes.length, up, down, flat },
    stats: {
      worst: sorted[0] ? { code: sorted[0].code, pct: sorted[0].pct } : null,
      best: sorted.length ? { code: sorted[sorted.length - 1].code, pct: sorted[sorted.length - 1].pct } : null,
      avgPct: quotes.length ? Number((quotes.reduce((s, q) => s + q.pct, 0) / quotes.length).toFixed(3)) : null,
    },
    quotes,
  }

  if (quotes.length < places.length * 0.8) {
    throw new Error(`数据不完整: ${quotes.length}/${places.length}，缺失 ${missing.join(',')}`)
  }
  if (missing.length) console.warn('缺失代码:', missing.join(','))

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(snapshot, null, 2) + '\n')
  console.log(
    `已写入 ${path.relative(root, OUT)} — ${quotes.length} 个指数, 涨 ${up} 跌 ${down} 平 ${flat}, 生成于 ${snapshot.generatedAt}`,
  )
  if (missing.length) console.warn(`未返回: ${missing.join(', ')}`)

  await updateHistory(process.argv.includes('--force-history'))
}

main().catch((e) => {
  console.error('抓取失败:', e.message)
  process.exit(1)
})
