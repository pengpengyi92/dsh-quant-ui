/**
 * dsh-quant-ui — Jane Street 风格量化工作台。
 * 加载 dsh-quant 的 chart/回测数据（JSON 粘贴、文件或内嵌示例），
 * 渲染 K 线、净值曲线、指标选择器与基金模拟卡。
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AreaSeries,
  CandlestickSeries,
  ColorType,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
} from 'lightweight-charts'

// ── dsh-quant demo 数据模型（与 dsh-quant 的 chart 协议一致） ──
interface Candle { openTime: number; open: number; high: number; low: number; close: number; volume: number }
interface Overlay { name: string; values: (number | null)[] }
interface Trade { entryIndex: number; exitIndex: number | null; exitReason?: string }
interface FundData {
  initialCapital: number; initialNav: number; finalNavNet: number; finalAum: number;
  peakAum: number; netReturnPct: number; grossReturnPct: number;
  managementFeeTotal: number; performanceFeeTotal: number; navNet: number[];
}
interface DemoData {
  symbol?: string; interval?: string; generatedAt?: string; strategy?: string;
  candles: Candle[]; overlays: Overlay[];
  equity: { name: string; values: number[] };
  trades: Trade[];
  metrics: Record<string, number | null>;
  factor?: { ic: number; icir: number; turnover: number };
  fund?: FundData;
}


const METRIC_LABELS: Record<string, string> = {
  totalReturnPct: 'Total Return', maxDrawdownPct: 'Max Drawdown', sharpe: 'Sharpe',
  annualizedVol: 'Ann. Vol', calmar: 'Calmar', sortino: 'Sortino', winRate: 'Win Rate',
  profitFactor: 'Profit Factor', avgPeriodReturnPct: 'Avg Period R',
}
const METRIC_FMT: Record<string, (v: number | null) => string> = {
  totalReturnPct: v => (v! >= 0 ? '+' : '') + v!.toFixed(2) + '%',
  maxDrawdownPct: v => v!.toFixed(2) + '%',
  sharpe: v => v!.toFixed(3),
  annualizedVol: v => v!.toFixed(2) + '%',
  calmar: v => v!.toFixed(3),
  sortino: v => v!.toFixed(3),
  winRate: v => v!.toFixed(1) + '%',
  profitFactor: v => (v === null ? '∞' : v.toFixed(3)),
  avgPeriodReturnPct: v => (v! >= 0 ? '+' : '') + v!.toFixed(3) + '%',
}
const REQUIRED = ['totalReturnPct', 'maxDrawdownPct', 'sharpe']

function Card({ label, value, tone }: { label: string; value: string; tone?: 'pos' | 'neg' }) {
  return (
    <div className={'card' + (tone === 'pos' ? ' pos' : tone === 'neg' ? ' neg' : '')}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
    </div>
  )
}

function useChart(
  containerRef: React.RefObject<HTMLDivElement>,
  data: DemoData | null,
  kind: 'candles' | 'equity' | 'nav',
) {
  const chartRef = useRef<IChartApi | null>(null)
  useEffect(() => {
    const el = containerRef.current
    if (!el || !data) return
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }
    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: '#ffffff' },
        textColor: '#1a1a1a',
        fontFamily: 'SF Mono, Menlo, monospace',
        fontSize: 11,
      },
      grid: { vertLines: { color: '#f0f0ec' }, horzLines: { color: '#f0f0ec' } },
      autoSize: true,
    })
    chartRef.current = chart
    const time = (i: number) => (data.candles[i]?.openTime ?? i) / 1000
    if (kind === 'candles') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: '#1e8449', downColor: '#c0392b', wickUpColor: '#1e8449', wickDownColor: '#c0392b', borderVisible: false,
      })
      s.setData(data.candles.map(c => ({ time: c.openTime / 1000, open: c.open, high: c.high, low: c.low, close: c.close })))
      const palette = ['#ff6a00', '#2563eb', '#7c3aed']
      data.overlays.forEach((o, i) => {
        const line = chart.addSeries(LineSeries, { color: palette[i % 3], lineWidth: 1, priceLineVisible: false })
        line.setData(o.values.map((v, idx) => ({ time: time(idx), value: v })).filter(p => p.value !== null) as never)
      })
      const markers = data.trades.flatMap(t => {
        const m: unknown[] = [{ time: time(t.entryIndex), position: 'belowBar', color: '#1e8449', shape: 'arrowUp', text: 'B' }]
        if (t.exitIndex !== null) m.push({ time: time(t.exitIndex), position: 'aboveBar', color: '#c0392b', shape: 'arrowDown', text: 'S' })
        return m
      })
      createSeriesMarkers(s, markers as never)
    } else if (kind === 'equity') {
      const area = chart.addSeries(AreaSeries, { lineColor: '#ff6a00', topColor: 'rgba(255,106,0,0.18)', bottomColor: 'rgba(255,106,0,0.02)', lineWidth: 2 })
      area.setData(data.equity.values.map((v, i) => ({ time: time(i), value: v })))
    } else if (kind === 'nav' && data.fund) {
      const net = chart.addSeries(LineSeries, { color: '#1a1a1a', lineWidth: 2, priceLineVisible: false })
      net.setData(data.fund.navNet.map((v, i) => ({ time: time(i), value: v })))
      const gross = chart.addSeries(LineSeries, { color: '#b9b9b2', lineWidth: 1, priceLineVisible: false })
      gross.setData(data.equity.values.map((v, i) => ({ time: time(i), value: v })))
    }
    chart.timeScale().fitContent()
    return () => {
      chartRef.current?.remove()
      chartRef.current = null
    }
  }, [containerRef, data, kind])
}

export default function App() {
  const [text, setText] = useState('')
  const [data, setData] = useState<DemoData | null>(null)
  const [shown, setShown] = useState<Set<string>>(new Set(REQUIRED))
  const candlesRef = useRef<HTMLDivElement>(null)
  const equityRef = useRef<HTMLDivElement>(null)
  const navRef = useRef<HTMLDivElement>(null)

  useChart(candlesRef, data, 'candles')
  useChart(equityRef, data, 'equity')
  useChart(navRef, data, 'nav')

  const loadText = useCallback(() => {
    try {
      const d = JSON.parse(text) as DemoData
      setData(d)
    } catch (e) {
      alert('JSON 解析失败：' + (e as Error).message)
    }
  }, [text])

  useEffect(() => {
    fetch('./sample.json')
      .then(r => r.json())
      .then(d => setData(d as DemoData))
      .catch(() => { /* no sample */ })
  }, [])

  const toggle = (k: string) => {
    setShown(prev => {
      const next = new Set(prev)
      if (next.has(k)) next.delete(k); else next.add(k)
      return next
    })
  }

  const fund = data?.fund
  const fmtFund = (v: number) => (v / 1e8).toFixed(3) + ' 亿'

  return (
    <div className="wrap">
      <header>
        <h1>dsh-quant <span className="accent">·</span> Workbench</h1>
        <div className="sub">{data ? `${data.symbol ?? ''} ${data.interval ?? ''} · ${data.generatedAt?.slice(0, 10) ?? ''}` : 'paste dsh-quant data →'}</div>
      </header>

      <div className="section-title">Data Input <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>(JSON from dsh-quant / ui-demo-data.json)</span></div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder='Paste dsh-quant demo JSON here, then Load…'
        style={{ width: '100%', height: 72, fontFamily: 'SF Mono, Menlo, monospace', fontSize: 12, padding: 8, border: '1px solid var(--line)', background: '#fff' }}
      />
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button onClick={loadText} style={btn}>Load JSON</button>
        <label style={{ ...btn, cursor: 'pointer' }}>
          Load file
          <input type="file" accept=".json" style={{ display: 'none' }} onChange={async e => {
            const f = e.target.files?.[0]
            if (!f) return
            setData(JSON.parse(await f.text()))
          }} />
        </label>
      </div>

      {data?.strategy && <><div className="section-title">Strategy</div><p className="strategy">{data.strategy}</p></>}

      {fund && (
        <>
          <div className="section-title">Quant Fund <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>(1 亿起步 · NAV 1.00)</span></div>
          <div className="cards">
            <Card label="Initial Capital" value={(fund.initialCapital / 1e8).toFixed(2) + ' 亿'} />
            <Card label="Final NAV (net)" value={fund.finalNavNet.toFixed(4)} tone={fund.finalNavNet >= 1 ? 'pos' : 'neg'} />
            <Card label="Final AUM" value={fmtFund(fund.finalAum)} />
            <Card label="Peak AUM" value={fmtFund(fund.peakAum)} />
            <Card label="Net Return" value={(fund.netReturnPct >= 0 ? '+' : '') + fund.netReturnPct.toFixed(2) + '%'} tone={fund.netReturnPct >= 0 ? 'pos' : 'neg'} />
            <Card label="Mgmt Fee" value={(fund.managementFeeTotal / 1e4).toFixed(1) + ' 万'} />
            <Card label="Perf Fee" value={(fund.performanceFeeTotal / 1e4).toFixed(1) + ' 万'} />
          </div>
        </>
      )}

      {data?.metrics && (
        <>
          <div className="section-title">Performance <span style={{ textTransform: 'none', letterSpacing: 0, color: 'var(--muted)' }}>(● required)</span></div>
          <div className="cards">
            {Object.keys(METRIC_LABELS).filter(k => shown.has(k)).map(k => {
              const v = data.metrics[k]
              const tone = (k === 'totalReturnPct' || k === 'avgPeriodReturnPct') ? (v! >= 0 ? 'pos' : 'neg') : undefined
              return <Card key={k} label={METRIC_LABELS[k] + (REQUIRED.includes(k) ? ' ●' : '')} value={METRIC_FMT[k](v)} tone={tone} />
            })}
          </div>
          <div className="section-title">Optional Metrics — select</div>
          <div className="selector">
            {Object.keys(METRIC_LABELS).filter(k => !REQUIRED.includes(k)).map(k => (
              <label key={k}><input type="checkbox" checked={shown.has(k)} onChange={() => toggle(k)} />{METRIC_LABELS[k]}</label>
            ))}
            {data.factor && (
              <>
                <label><input type="checkbox" checked={shown.has('ic')} onChange={() => toggle('ic')} />Factor IC</label>
                <label><input type="checkbox" checked={shown.has('icir')} onChange={() => toggle('icir')} />Factor ICIR</label>
                <label><input type="checkbox" checked={shown.has('turnover')} onChange={() => toggle('turnover')} />Factor Turnover</label>
              </>
            )}
          </div>
        </>
      )}

      {data?.candles?.length ? (
        <>
          <div className="section-title">Price & Overlays</div>
          <div className="panel" ref={candlesRef} style={{ height: 360 }} />
          {data.fund && (<><div className="section-title">Fund NAV (net) vs Strategy</div><div className="panel" ref={navRef} style={{ height: 240 }} /></>)}
          <div className="section-title">Equity Curve</div>
          <div className="panel" ref={equityRef} style={{ height: 240 }} />
        </>
      ) : (
        <p className="strategy" style={{ marginTop: 24 }}>No data yet — paste JSON or load the ui-demo-data.json from dsh-quant.</p>
      )}
    </div>
  )
}

const btn: React.CSSProperties = {
  background: '#fff', border: '1px solid var(--line)', padding: '6px 14px',
  fontSize: 13, fontFamily: 'inherit', color: 'var(--ink)',
}
