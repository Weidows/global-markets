// 生成 src/data/geo.generated.ts：世界陆地轮廓 path、经纬网、各市场城市的投影坐标
// 运行: node scripts/gen-map.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { geoNaturalEarth1, geoPath, geoGraticule } from 'd3-geo'
import { feature, mesh } from 'topojson-client'

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, '..')

// 画布尺寸（viewBox），以及为了裁掉极地空白而额外放大的投影尺寸
const W = 1000
const H = 520
const ZOOM = 1.07

const topo = JSON.parse(fs.readFileSync(path.join(root, 'node_modules/world-atlas/countries-110m.json'), 'utf8'))
const land = feature(topo, topo.objects.land)
const borders = mesh(topo, topo.objects.countries, (a, b) => a !== b)

const projection = geoNaturalEarth1().fitSize([W * ZOOM, H * ZOOM], { type: 'Sphere' })
const vbX = Math.round(((W * ZOOM - W) / 2) * 100) / 100
const vbY = Math.round(((H * ZOOM - H) / 2) * 100) / 100
const pathGen = geoPath(projection).digits(2)

const landPath = pathGen(land)
const borderPath = pathGen(borders)
const graticulePath = pathGen(geoGraticule().step([20, 20])())

const places = JSON.parse(fs.readFileSync(path.join(root, 'src/data/places.json'), 'utf8'))
const points = {}
for (const p of places) {
  const xy = projection([p.lon, p.lat])
  if (!xy) throw new Error('投影失败: ' + p.code)
  points[p.code] = [Math.round(xy[0] * 100) / 100, Math.round(xy[1] * 100) / 100]
}

const banner = `// 由 scripts/gen-map.mjs 自动生成，请勿手改。
// 投影: d3 geoNaturalEarth1, viewBox ${W}x${H}, 数据源 world-atlas countries-110m (Natural Earth)
`
const out = `${banner}export const MAP_WIDTH = ${W}
export const MAP_HEIGHT = ${H}
export const VIEW_BOX = "${vbX} ${vbY} ${W} ${H}"

export const LAND_PATH = ${JSON.stringify(landPath)}

export const BORDER_PATH = ${JSON.stringify(borderPath)}

export const GRATICULE_PATH = ${JSON.stringify(graticulePath)}

export const POINTS: Record<string, [number, number]> = ${JSON.stringify(points, null, 0)}
`
fs.writeFileSync(path.join(root, 'src/data/geo.generated.ts'), out)
console.log(
  `geo.generated.ts 已生成: land ${landPath.length}B, borders ${borderPath.length}B, graticule ${graticulePath.length}B, points ${Object.keys(points).length}`,
)
