// src/pages/EldLogs.tsx

import { useEffect } from 'react'

import { useLocation, useNavigate } from 'react-router-dom'

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'

import L from 'leaflet'

import 'leaflet/dist/leaflet.css'

import { useTheme } from '../Theme/ThemeContext'

type RawCoord = { lat: number; lng: number } | [number, number]

interface LatLng {
  lat: number
  lng: number
}

function toStopLatLng(c: RawCoord): LatLng {
  return Array.isArray(c)
    ? { lat: c[1], lng: c[0] }
    : { lat: c.lat, lng: c.lng }
}

function normalizeStopCoords(
  input: RawCoord | RawCoord[] | undefined | null
): LatLng[] {
  if (!input) return []

  const isSingleCoord =
    (Array.isArray(input) && typeof input[0] === 'number') ||
    (!Array.isArray(input) && 'lat' in (input as object))

  const coords = isSingleCoord
    ? [toStopLatLng(input as RawCoord)]
    : (input as RawCoord[]).map(toStopLatLng)

  return coords.filter(
    (c) => c.lat !== 0 || c.lng !== 0
  )
}

function toLatLng(c: RawCoord): LatLng {
  return Array.isArray(c)
    ? { lat: c[0], lng: c[1] }
    : { lat: c.lat, lng: c.lng }
}

function toLatLngList(list: RawCoord[] | undefined): LatLng[] {
  return (list ?? []).map(toLatLng)
}

function normalizeCoords(
  input: RawCoord | RawCoord[] | undefined | null
): LatLng[] {
  if (!input) return []

  const isSingleCoord =
    (Array.isArray(input) && typeof input[0] === 'number') ||
    (!Array.isArray(input) && 'lat' in (input as object))

  const coords = isSingleCoord
    ? [toLatLng(input as RawCoord)]
    : (input as RawCoord[]).map(toLatLng)

  // Filter out invalid/default [0, 0] coordinates
  return coords.filter((c) => c.lat !== 0 || c.lng !== 0)
}

// Custom Leaflet Pin Icons with visual badges
function createCustomIcon(
  bgColor: string,
  iconSvg: string,
  label: string
) {
  return L.divIcon({
    className: 'custom-leaflet-marker',

    html: `
      <div class="eld-marker" style="
        position: relative;
        width: 42px;
        height: 42px;
        border-radius: 50%;
        background-color: ${bgColor};
        display: flex;
        align-items: center;
        justify-content: center;
        border: 3px solid #ffffff;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
        color: white;
        z-index: 1000;
      ">
        ${iconSvg}

        <span style="
          position: absolute;
          top: 44px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          background: #1e293b;
          color: #ffffff;
          font-size: 11px;
          font-weight: 700;
          line-height: 1;
          padding: 5px 7px;
          border-radius: 5px;
          border: 1px solid #475569;
          box-shadow: 0 2px 6px rgba(0,0,0,0.35);
          pointer-events: none;
        ">
          ${label}
        </span>
      </div>
    `,

    iconSize: [42, 65],
    iconAnchor: [21, 21],
    popupAnchor: [0, -24],

    // VERY IMPORTANT
    tooltipAnchor: [0, -21],
  })
}

const fuelIcon = createCustomIcon(
  '#f59e0b',
  '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 22V4a2 2 0 012-2h8a2 2 0 012 2v18M3 22h12M15 10h4a2 2 0 012 2v7a2 2 0 01-2 2h-4M7 6h4M7 10h4"/></svg>',
  'Fuel Stop'
)

const breakIcon = createCustomIcon(
  '#10b981',
  '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8h1a4 4 0 010 8h-1M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8zM6 1v3M10 1v3M14 1v3"/></svg>',
  '30m Break'
)

const dayOffIcon = createCustomIcon(
  '#ef4444',
  '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z"/></svg>',
  '10h Off-Duty'
)

// Auto bounds adjustment component
function MapBoundsFitter({ points }: { points: LatLng[] }) {
  const map = useMap()

  useEffect(() => {
    if (points.length > 0) {
      const bounds = L.latLngBounds(
        points.map((p) => [p.lat, p.lng])
      )

      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [points, map])

  return null
}

// ---------- Backend ELD timeline ----------

type DutyStatus = 'off' | 'sleeper' | 'driving' | 'onDuty'

interface DaySegment {
  status: DutyStatus
  startInDay: number
  endInDay: number
}

interface EldLogEntry {
  [key: string]: string
}

interface DayGroup {
  dateKey: string
  dateLabel: string
  segments: DaySegment[]
}

const KEY_STATUS: Record<string, DutyStatus> = {
  on_duty_loading: 'onDuty',
  on_duty_driving: 'driving',
  break_after_driving: 'off',
  driving_after_break: 'driving',
  off_duty_mandatory: 'off',
  on_duty_offloading: 'onDuty',
}

const MS_PER_HOUR = 3600000

// Reads the literal wall-clock time out of an ISO string.
//
// We intentionally ignore the timezone offset here.
// The backend timestamps are all based on the same trip-local clock,
// so the frontend keeps the entire ELD calculation in that clock.
function wallClockMs(iso: string): number {
  const m = iso.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/
  )

  if (!m) return NaN

  const [, y, mo, d, h, mi, s] = m

  return Date.UTC(
    +y,
    +mo - 1,
    +d,
    +h,
    +mi,
    +s
  )
}

// Chains trip_start_time through every key of every log entry.
//
// Each key's timestamp represents the END of that duty segment.
// The START is wherever the previous timestamp left off.
function buildSegments(
  eldLogData: EldLogEntry[],
  tripStartIso: string
) {
  const segments: {
    startMs: number
    endMs: number
    status: DutyStatus
  }[] = []

  let cursor = wallClockMs(tripStartIso)

  for (const log of eldLogData) {
    for (const [key, iso] of Object.entries(log)) {
      const status = KEY_STATUS[key]
      const endMs = wallClockMs(iso)

      if (status && Number.isFinite(endMs)) {
        segments.push({
          startMs: cursor,
          endMs,
          status,
        })

        cursor = endMs
      }
    }
  }

  return segments
}

// Splits segments at real midnight boundaries and groups them by
// calendar date.
//
// This means a segment such as:
//
// 10 PM -> 2 AM
//
// becomes:
//
// Day 1: 10 PM -> 12 AM
// Day 2: 12 AM -> 2 AM
function groupByCalendarDay(
  segments: {
    startMs: number
    endMs: number
    status: DutyStatus
  }[]
): DayGroup[] {
  const groups = new Map<string, DaySegment[]>()

  for (const seg of segments) {
    let s = seg.startMs

    while (s < seg.endMs) {
      const dayStart =
        Math.floor(s / (24 * MS_PER_HOUR)) *
        24 *
        MS_PER_HOUR

      const dayEnd = dayStart + 24 * MS_PER_HOUR

      const segEnd = Math.min(
        seg.endMs,
        dayEnd
      )

      const dateKey = new Date(dayStart)
        .toISOString()
        .slice(0, 10)

      const arr = groups.get(dateKey) ?? []

      arr.push({
        status: seg.status,
        startInDay:
          (s - dayStart) / MS_PER_HOUR,
        endInDay:
          (segEnd - dayStart) / MS_PER_HOUR,
      })

      groups.set(dateKey, arr)

      s = segEnd
    }
  }

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateKey, segs]) => ({
      dateKey,

      dateLabel: new Date(
        `${dateKey}T00:00:00Z`
      ).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'UTC',
      }),

      segments: segs,
    }))
}

// ---------- Grid rendering ----------

const ROW_ORDER: DutyStatus[] = [
  'off',
  'sleeper',
  'driving',
  'onDuty',
]

const ROW_LABELS: Record<DutyStatus, string> = {
  off: 'Off duty',
  sleeper: 'Sleeper berth',
  driving: 'Driving',
  onDuty: 'On duty (not driving)',
}

const ROW_HEIGHT = 36
const CHART_TOP = 24
const CHART_WIDTH = 864 // 24 hours * 36px
const HOUR_WIDTH = CHART_WIDTH / 24
const LABEL_WIDTH = 130

function rowY(status: DutyStatus) {
  const idx = ROW_ORDER.indexOf(status)

  return (
    CHART_TOP +
    idx * ROW_HEIGHT +
    ROW_HEIGHT / 2
  )
}

function buildPath(daySegs: DaySegment[]) {
  if (daySegs.length === 0) return ''

  let d = ''

  daySegs.forEach((seg, i) => {
    const x1 = seg.startInDay * HOUR_WIDTH
    const x2 = seg.endInDay * HOUR_WIDTH
    const y = rowY(seg.status)

    d +=
      i === 0
        ? `M ${x1} ${y} L ${x2} ${y}`
        : ` L ${x1} ${y} L ${x2} ${y}`
  })

  return d
}

function EldLogGrid({
  daySegments,
  dayLabel,
}: {
  daySegments: DaySegment[]
  dayLabel: string
}) {
  const chartHeight =
    ROW_ORDER.length * ROW_HEIGHT

  const svgHeight =
    CHART_TOP +
    chartHeight +
    24

  const svgWidth =
    LABEL_WIDTH +
    CHART_WIDTH +
    16

  return (
    <div className="bg-[var(--color-cards)] border border-[var(--color-borders)] rounded-2xl p-4 shadow-md overflow-x-auto">
      <p className="text-sm font-bold mb-2 text-[var(--color-mainHeadings)]">
        {dayLabel}
      </p>

      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ minWidth: svgWidth }}
      >
        <g transform={`translate(${LABEL_WIDTH}, 0)`}>
          {Array.from({ length: 25 }, (_, h) => (
            <line
              key={h}
              x1={h * HOUR_WIDTH}
              x2={h * HOUR_WIDTH}
              y1={CHART_TOP}
              y2={CHART_TOP + chartHeight}
              stroke="var(--color-borders)"
              strokeWidth={h % 6 === 0 ? 1.5 : 0.5}
            />
          ))}

          {Array.from({ length: 25 }, (_, h) => (
            <text
              key={h}
              x={h * HOUR_WIDTH}
              y={CHART_TOP - 8}
              fontSize={10}
              textAnchor="middle"
              fill="var(--color-text)"
            >
              {h === 0 || h === 24
                ? '12A'
                : h === 12
                  ? '12P'
                  : h % 12}
            </text>
          ))}

          {ROW_ORDER.map((status, i) => (
            <rect
              key={status}
              x={0}
              y={CHART_TOP + i * ROW_HEIGHT}
              width={CHART_WIDTH}
              height={ROW_HEIGHT}
              fill={
                i % 2 === 0
                  ? 'var(--color-textFieldBg)'
                  : 'transparent'
              }
              stroke="var(--color-borders)"
              strokeWidth={0.5}
            />
          ))}

          <path
            d={buildPath(daySegments)}
            fill="none"
            stroke="var(--color-button)"
            strokeWidth={2.5}
          />
        </g>

        {ROW_ORDER.map((status, i) => (
          <text
            key={status}
            x={LABEL_WIDTH - 8}
            y={
              CHART_TOP +
              i * ROW_HEIGHT +
              ROW_HEIGHT / 2 +
              4
            }
            fontSize={12}
            textAnchor="end"
            fill="var(--color-text)"
            fontWeight={600}
          >
            {ROW_LABELS[status]}
          </text>
        ))}
      </svg>
    </div>
  )
}

// ---------- Backend response ----------

interface LeafletMapData {
  leaflet_lat_lng?: RawCoord[]
  fuel_cordinates?: RawCoord | RawCoord[]
  break_cordinates?: RawCoord | RawCoord[]
  day_off_cordinates?: RawCoord | RawCoord[]
  total_distance_miles?: number
  total_duration_hours?: number
}

interface BackendResult {
  leaflet_map_data?: LeafletMapData
  eld_log_data?: EldLogEntry[]
}

// ---------- Page ----------

export default function EldLogs() {
  const { theme, toggleTheme } = useTheme()

  const location = useLocation()
  const navigate = useNavigate()

  const rawState = location.state as any

  const rawResult = rawState?.result

  // Unwrap whether the backend result was passed directly
  // or inside a wrapper such as:
  //
  // {
  //   status: ...,
  //   data: {...}
  // }
  const result: BackendResult | undefined =
    rawResult?.data ?? rawResult

  const tripStartIso: string | undefined =
    rawState?.tripStartIso

  const mapData = result?.leaflet_map_data

  useEffect(() => {
    if (!mapData?.leaflet_lat_lng) {
      navigate('/home')
    }
  }, [mapData, navigate])

  if (!mapData?.leaflet_lat_lng) {
    return null
  }

  const totalDistance = Number(
    mapData.total_distance_miles ?? 0
  )

  const totalDuration = Number(
    mapData.total_duration_hours ?? 0
  )

  const pathCoords = toLatLngList(
    mapData.leaflet_lat_lng
  )

  const fuelStops = normalizeStopCoords(
    mapData.fuel_cordinates
  )
  
  const breakStops = normalizeStopCoords(
    mapData.break_cordinates
  )
  
  const dayOffStops = normalizeStopCoords(
    mapData.day_off_cordinates
  )
  const allMapPoints = [
    ...pathCoords,
    ...fuelStops,
    ...breakStops,
    ...dayOffStops,
  ]
  console.log('PATH:', pathCoords)
  console.log('FUEL:', fuelStops)
  console.log('BREAK:', breakStops)
  console.log('DAY OFF:', dayOffStops)
  const mapCenter =
    pathCoords[Math.floor(pathCoords.length / 2)] ??
    pathCoords[0] ??
    { lat: 24.86, lng: 67.0 }

  const dayGroups: DayGroup[] =
    result?.eld_log_data && tripStartIso
      ? groupByCalendarDay(
        buildSegments(
          result.eld_log_data,
          tripStartIso
        )
      )
      : []

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8 lg:py-12 relative">
      <button
        onClick={toggleTheme}
        aria-label="Switch theme"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 px-4 py-2.5 rounded-full flex items-center gap-2 cursor-pointer
                   bg-[var(--color-cards)] text-[var(--color-text)]
                   border-2 border-[var(--color-borders)]
                   shadow-[0_4px_0_rgba(0,0,0,0.15)]
                   hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(0,0,0,0.15)]
                   active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.15)]
                   transition-all duration-150"
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>

        <span className="text-sm font-semibold capitalize">
          {theme}
        </span>
      </button>

      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        <div>
          <h1 className="text-3xl font-extrabold text-[var(--color-mainHeadings)] mb-2">
            ELD logs
          </h1>

          <p className="text-[var(--color-text)] leading-relaxed">
            Here's your route and generated ELD log for this trip —{' '}
            {Math.round(totalDistance)} miles, about{' '}
            {totalDuration.toFixed(1)} hours of driving.
          </p>
        </div>

        <div className="h-[480px] w-full rounded-2xl overflow-hidden border-2 border-[var(--color-borders)] shadow-lg relative">
          <MapContainer
            center={[mapCenter.lat, mapCenter.lng]}
            zoom={7}
            style={{
              height: '100%',
              width: '100%',
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {allMapPoints.length > 0 && (
              <MapBoundsFitter points={allMapPoints} />
            )}
            {pathCoords.length > 1 && (
              <Polyline
                positions={pathCoords.map((c) => [
                  c.lat,
                  c.lng,
                ])}
                pathOptions={{
                  color: '#2563eb',
                  weight: 5,
                  opacity: 0.8,
                }}
              />
            )}

            {fuelStops.map((c, i) => (
              <Marker
              key={`fuel-${i}`}
              position={[c.lat, c.lng]}
              icon={fuelIcon}
              zIndexOffset={1000}
            >
                <Popup>
                  <div className="p-1 max-w-[200px]">
                    <div className="flex items-center gap-1.5 text-amber-600 font-bold text-sm mb-1">
                      <span>⛽ Fuel Stop</span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug">
                      Reaching{' '}
                      <strong>1,000 miles</strong>.
                      Plan to refuel your vehicle at
                      this point.
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {breakStops.map((c, i) => (
              <Marker
              key={`break-${i}`}
              position={[c.lat, c.lng]}
              icon={breakIcon}
              zIndexOffset={1000}
            >
                <Popup>
                  <div className="p-1 max-w-[200px]">
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-sm mb-1">
                      <span>
                        ☕ 30-Minute Rest Break
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug">
                      Required FMCSA rest break after{' '}
                      <strong>8 hours</strong> of
                      continuous driving.
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}

            {dayOffStops.map((c, i) => (
              <Marker
              key={`dayoff-${i}`}
              position={[c.lat, c.lng]}
              icon={dayOffIcon}
              zIndexOffset={1000}
            >
                <Popup>
                  <div className="p-1 max-w-[200px]">
                    <div className="flex items-center gap-1.5 text-rose-600 font-bold text-sm mb-1">
                      <span>
                        🛑 10-Hour Off-Duty Shift
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 leading-snug">
                      Maximum driving limit reached (
                      <strong>11 hours max</strong>).
                      Park and complete mandatory
                      10-hour rest.
                    </p>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div className="flex flex-col gap-6">
          {dayGroups.map((g) => (
            <EldLogGrid
              key={g.dateKey}
              dayLabel={g.dateLabel}
              daySegments={g.segments}
            />
          ))}
        </div>
      </div>
    </div>
  )
}