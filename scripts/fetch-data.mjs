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
}

main().catch((e) => {
  console.error('抓取失败:', e.message)
  process.exit(1)
})
