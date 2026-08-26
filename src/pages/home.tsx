// src/pages/Home.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { toast } from 'react-toastify'

import icon from 'leaflet/dist/images/marker-icon.png'
import iconShadow from 'leaflet/dist/images/marker-shadow.png'
import { useTheme } from '../Theme/ThemeContext'

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
})
L.Marker.prototype.options.icon = DefaultIcon

interface LatLng {
  lat: number
  lng: number
}
interface Suggestion {
  display_name: string
  lat: string
  lon: string
}

const FALLBACK_CENTER: LatLng = { lat: 24.8607, lng: 67.0011 }

function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

async function geocode(query: string): Promise<Suggestion[]> {
  if (query.trim().length < 3) return []
  const res = await fetch(
    `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(
      query
    )}`
  )
  if (!res.ok) return []
  return res.json()
}

function FlyTo({ coords, zoom = 12 }: { coords: LatLng | null; zoom?: number }) {
  const map = useMap()
  useEffect(() => {
    if (coords) map.flyTo([coords.lat, coords.lng], zoom, { duration: 1 })
  }, [coords, zoom, map])
  return null
}

function ClickToSetEnd({ onPick }: { onPick: (c: LatLng) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

function LocationField({
  label,
  placeholder,
  value,
  onChange,
  onSelect,
  extraButton,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  onSelect: (coords: LatLng, label: string) => void
  extraButton?: React.ReactNode
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounced = useDebouncedValue(value, 400)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let active = true
    geocode(debounced).then((results) => {
      if (active) {
        setSuggestions(results)
        setOpen(results.length > 0)
      }
    })
    return () => {
      active = false
    }
  }, [debounced])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={boxRef} className="relative">
      <label className="block text-sm font-semibold mb-1 text-[var(--color-secondaryHeadings)]">
        {label}
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          className="flex-1 px-4 py-2.5 rounded-lg outline-none
                     bg-[var(--color-textFieldBg)] text-[var(--color-textFieldText)]
                     border border-[var(--color-borders)]
                     focus:ring-2 focus:ring-[var(--color-button)]"
        />
        {extraButton}
      </div>

      {open && (
        <ul
          className="absolute z-10 mt-1 w-full max-h-56 overflow-auto rounded-lg
                     bg-[var(--color-cards)] border border-[var(--color-borders)] shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                onClick={() => {
                  onChange(s.display_name)
                  onSelect({ lat: parseFloat(s.lat), lng: parseFloat(s.lon) }, s.display_name)
                  setOpen(false)
                }}
                className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--color-textFieldBg)]
                           text-[var(--color-text)]"
              >
                {s.display_name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
// Formats a Date as the value a <input type="datetime-local"> needs
function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Turns that same "YYYY-MM-DDTHH:mm" value into a full ISO string carrying
// the browser's actual UTC offset, e.g. "2026-08-26T07:00:00-04:00" —
// matches what your backend's trip_start_time field expects.
function toIsoWithOffset(localValue: string): string {
  const offsetMin = -new Date(localValue).getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const abs = Math.abs(offsetMin)
  const hh = String(Math.floor(abs / 60)).padStart(2, '0')
  const mm = String(abs % 60).padStart(2, '0')
  return `${localValue}:00${sign}${hh}:${mm}`
}
export default function Home() {
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [startCoords, setStartCoords] = useState<LatLng | null>(null)
  const [pickupCoords, setPickupCoords] = useState<LatLng | null>(null)
  const [endCoords, setEndCoords] = useState<LatLng | null>(null)

  const [startText, setStartText] = useState('')
  const [pickupText, setPickupText] = useState('')
  const [endText, setEndText] = useState('')
  const [cycleHours, setCycleHours] = useState<number>(0)
  const [tripStartTime, setTripStartTime] = useState(() => toLocalInputValue(new Date()))
  const [loading, setLoading] = useState(false)

  const [mapCenter, setMapCenter] = useState<LatLng>(FALLBACK_CENTER)

  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setMapCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => { }
    )
  }, [])

  const handleUseCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((pos) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setStartCoords(coords)
      setStartText('Current location')
    })
  }, [])

  const allLocationsSet = !!(startCoords && pickupCoords && endCoords)

  const handleGenerateEldLog = async () => {
    if (!startCoords || !endCoords) {
      toast.error('Please set valid start and drop-off coordinates.')
      return
    }

    setLoading(true)

    const payload = {
      start: {
        lng: startCoords.lng,
        lat: startCoords.lat,
      },
      dropoff: {
        lng: endCoords.lng,
        lat: endCoords.lat,
      },
      currentCycleHours: cycleHours,
      trip_start_time: toIsoWithOffset(tripStartTime),
    }

    try {
      const response = await fetch('/api/eld/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.errors && Array.isArray(data.errors)) {
          const firstErr = data.errors[0]
          toast.error(`Validation Error: ${firstErr.loc.join(' -> ')} ${firstErr.msg}`)
        } else {
          toast.error(data.message || 'Failed to generate ELD log.')
        }
        return
      }

      toast.success('ELD Log generated successfully!')

      // Hand the result off to the results page along with the moment the
      // shift started, so the duty-log grid can draw from the right hour.
      navigate('/eld-logs', {
        state: { result: data.data, tripStartIso: toIsoWithOffset(tripStartTime) },
      })
    } catch (error) {
      console.error('API Error:', error)
      toast.error('Network error. Unable to reach backend server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[var(--color-bg)] px-4 py-8 lg:py-12 relative">
      <button
        onClick={toggleTheme}
        aria-label="Switch theme"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20 px-4 py-2.5 rounded-full flex items-center gap-2 cursor-pointer shrink-0
                   bg-[var(--color-cards)] text-[var(--color-text)]
                   border-2 border-[var(--color-borders)]
                   shadow-[0_4px_0_rgba(0,0,0,0.15)]
                   hover:-translate-y-0.5 hover:shadow-[0_6px_0_rgba(0,0,0,0.15)]
                   active:translate-y-1 active:shadow-[0_1px_0_rgba(0,0,0,0.15)]
                   transition-all duration-150"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
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
        <span className="text-sm font-semibold capitalize">{theme}</span>
      </button>

      <div className="max-w-6xl mx-auto flex flex-col lg:flex-row gap-8">
        <div className="lg:w-2/5 flex flex-col gap-6">
          <div>
            <h1 className="text-3xl font-extrabold text-[var(--color-mainHeadings)] mb-2">
              Plan your trip
            </h1>
            <p className="text-[var(--color-text)] leading-relaxed">
              Pick your current location, pickup point, and drop-off destination to generate an ELD log.
            </p>
          </div>

          <div className="bg-[var(--color-cards)] border border-[var(--color-borders)] rounded-2xl p-5 flex flex-col gap-5 shadow-md">
            <LocationField
              label="Current location"
              placeholder="Search start city or address..."
              value={startText}
              onChange={setStartText}
              onSelect={(coords) => setStartCoords(coords)}
              extraButton={
                <button
                  onClick={handleUseCurrentLocation}
                  title="Use GPS current location"
                  className="px-3 py-2.5 rounded-lg font-semibold text-white shrink-0
                             bg-[var(--color-button)] hover:bg-[var(--color-button-hover)]"
                >
                  📍
                </button>
              }
            />

            <LocationField
              label="Pickup location"
              placeholder="Search pickup point..."
              value={pickupText}
              onChange={setPickupText}
              onSelect={(coords) => setPickupCoords(coords)}
            />

            <LocationField
              label="Drop-off location"
              placeholder="Search drop-off city or address..."
              value={endText}
              onChange={setEndText}
              onSelect={(coords) => setEndCoords(coords)}
            />

            <div>
              <label className="block text-sm font-semibold mb-1 text-[var(--color-secondaryHeadings)]">
                Cycle hours used (0–70 hrs)
              </label>
              <select
                value={cycleHours}
                onChange={(e) => setCycleHours(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-lg outline-none cursor-pointer
                           bg-[var(--color-textFieldBg)] text-[var(--color-textFieldText)]
                           border border-[var(--color-borders)]
                           focus:ring-2 focus:ring-[var(--color-button)]"
              >
                {Array.from({ length: 71 }, (_, i) => (
                  <option key={i} value={i}>
                    {i} {i === 1 ? 'hour' : 'hours'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1 text-[var(--color-secondaryHeadings)]">
                Trip start time
              </label>
              <input
                type="datetime-local"
                value={tripStartTime}
                onChange={(e) => setTripStartTime(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg outline-none
               bg-[var(--color-textFieldBg)] text-[var(--color-textFieldText)]
               border border-[var(--color-borders)]
               focus:ring-2 focus:ring-[var(--color-button)]"
              />
            </div>
            <p className="text-xs text-[var(--color-text)] opacity-70">
              Tip: Click anywhere on the map to place/update your drop-off marker directly.
            </p>

            <div className="border-t border-[var(--color-borders)] pt-4 text-sm font-mono text-[var(--color-text)] flex flex-col gap-1">
              <p>Start: {startCoords ? `${startCoords.lat.toFixed(4)}, ${startCoords.lng.toFixed(4)}` : 'Not set'}</p>
              <p>Pickup: {pickupCoords ? `${pickupCoords.lat.toFixed(4)}, ${pickupCoords.lng.toFixed(4)}` : 'Not set'}</p>
              <p>End: {endCoords ? `${endCoords.lat.toFixed(4)}, ${endCoords.lng.toFixed(4)}` : 'Not set'}</p>
            </div>

            <button
              onClick={handleGenerateEldLog}
              disabled={!allLocationsSet || loading}
              className="px-5 py-3 rounded-xl font-bold text-white transition-opacity
                         bg-[var(--color-button)] hover:bg-[var(--color-button-hover)]
                         disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Generating...' : 'Generate ELD log'}
            </button>
          </div>
        </div>

        <div className="lg:w-3/5">
          <div className="h-[420px] lg:mt-52 lg:h-[640px] w-full rounded-2xl overflow-hidden border-2 border-[var(--color-borders)] shadow-md">
            <MapContainer center={[mapCenter.lat, mapCenter.lng]} zoom={11} style={{ height: '100%', width: '100%' }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FlyTo coords={startCoords ?? pickupCoords ?? endCoords} />
              <ClickToSetEnd onPick={setEndCoords} />

              {startCoords && (
                <Marker position={[startCoords.lat, startCoords.lng]}>
                  <Popup>Start Location</Popup>
                </Marker>
              )}
              {pickupCoords && (
                <Marker position={[pickupCoords.lat, pickupCoords.lng]}>
                  <Popup>Pickup Location</Popup>
                </Marker>
              )}
              {endCoords && (
                <Marker position={[endCoords.lat, endCoords.lng]}>
                  <Popup>Drop-off Location</Popup>
                </Marker>
              )}
            </MapContainer>
          </div>
        </div>
      </div>
    </div>
  )
}