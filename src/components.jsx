import { useEffect, useId, useRef } from 'react'
import { formatDate, formatNumber } from './lib'
const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  dumbbell: <><path d="m6 6 12 12M5 3l-2 2 4 4 2-2m6 10 2-2 4 4-2 2M3 10l7-7m4 18 7-7" /></>,
  chart: <><path d="M4 3v17h17M7 14l4-5 4 3 5-7" /></>,
  history: <><path d="M3 10a9 9 0 1 1 2 8M3 4v6h6M12 7v5l3 2" /></>,
  book: <><path d="M4 4h13a3 3 0 0 1 3 3v14H7a3 3 0 0 1-3-3zm0 14a3 3 0 0 1 3-3h13M8 8h8" /></>,
  weight: <><path d="M4 6h16v15H4zM8 6a4 4 0 0 1 8 0M12 11l2 3" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  trophy: <><path d="M8 3h8v6a4 4 0 0 1-8 0zM8 5H4v3a4 4 0 0 0 5 4m7-7h4v3a4 4 0 0 1-5 4M12 13v7m-4 1h8" /></>,
  download: <path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5" />,
  trash: <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />,
  edit: <><path d="m4 15-1 6 6-1L20 9l-5-5zM13 6l5 5" /></>,
  close: <path d="m6 6 12 12M6 18 18 6" />,
  search: <><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></>,
  bolt: <path d="m13 2-9 12h7l-1 8 10-12h-7z" />,
}
export function Icon({ name, size = 20, ...props }) { return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.dumbbell}</svg> }
export function Empty({ icon = 'dumbbell', title, children, action }) { return <div className="empty"><span className="empty-icon"><Icon name={icon} size={28} /></span><h3>{title}</h3><p>{children}</p>{action}</div> }
export function Modal({ title, children, onClose }) {
  const ref = useRef(null); const titleId = useId()
  useEffect(() => { const dialog = ref.current; dialog.showModal(); return () => dialog.close() }, [])
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === ref.current) onClose() }}><div className="modal-head"><h2 id={titleId}>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close" /></button></div>{children}</dialog>
}
export function Chart({ points, unit = 'kg', label = 'Progress' }) {
  const id = useId().replaceAll(':', '')
  if (!points.length) return <Empty icon="chart" title="Your progress starts here">Log a completed set to see your progress.</Empty>
  const width = 700, height = 220, pad = 34
  const values = points.map((p) => p.value); const min = Math.max(0, Math.min(...values) - Math.max(2, Math.max(...values) * .08)); const max = Math.max(...values) + Math.max(2, Math.max(...values) * .08)
  const positions = points.map((p, i) => ({ x: points.length === 1 ? width / 2 : pad + i * (width - 2 * pad) / (points.length - 1), y: height - pad - (p.value - min) / (max - min) * (height - 2 * pad) }))
  const line = positions.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ')
  return <div className="chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label}: ${points.map((p) => `${formatDate(p.date)} ${formatNumber(p.value)} ${unit}`).join('; ')}`}><defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b9f587" stopOpacity=".2" /><stop offset="100%" stopColor="#b9f587" stopOpacity="0" /></linearGradient></defs>{[0, .5, 1].map((fraction) => { const y = pad + fraction * (height - 2 * pad); return <g key={fraction}><line x1={pad} x2={width - pad} y1={y} y2={y} stroke="#2c342e" strokeDasharray="4 6" /><text x={pad} y={y - 7} fill="#88988e" fontSize="11">{formatNumber(max - fraction * (max - min))} {unit}</text></g> })}<path d={`${line} L${positions.at(-1).x},${height - pad} L${positions[0].x},${height - pad} Z`} fill={`url(#${id})`} /><path d={line} fill="none" stroke="#b9f587" strokeWidth="3" />{positions.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill="#b9f587"><title>{formatDate(points[i].date)}: {formatNumber(points[i].value)} {unit}</title></circle>)}</svg><div className="chart-dates"><span>{formatDate(points[0].date)}</span><span>{formatDate(points.at(-1).date)}</span></div>{points.length === 1 && <p className="hint">One entry so far. More sessions will reveal your trend.</p>}</div>
}
