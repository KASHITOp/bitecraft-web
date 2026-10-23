/** Where live prices are checked. Quick-commerce prices and stock depend on the nearest dark store. */

export interface Area {
  id: string;
  label: string;
  lat: number;
  lon: number;
  /** Flipkart Minutes needs a pincode as well as coordinates */
  pincode: string;
}

/** A short list of Bangalore areas students live in, with rough centre coordinates. */
export const AREAS: Area[] = [
  { id: "koramangala", label: "Koramangala", lat: 12.9352, lon: 77.6245, pincode: "560034" },
  { id: "hsr", label: "HSR Layout", lat: 12.9116, lon: 77.6474, pincode: "560102" },
  { id: "btm", label: "BTM Layout", lat: 12.9166, lon: 77.6101, pincode: "560076" },
  { id: "indiranagar", label: "Indiranagar", lat: 12.9784, lon: 77.6408, pincode: "560038" },
  { id: "jayanagar", label: "Jayanagar", lat: 12.925, lon: 77.5938, pincode: "560041" },
  { id: "whitefield", label: "Whitefield", lat: 12.9698, lon: 77.75, pincode: "560066" },
  { id: "marathahalli", label: "Marathahalli", lat: 12.9569, lon: 77.7011, pincode: "560037" },
  { id: "electronic-city", label: "Electronic City", lat: 12.8452, lon: 77.6602, pincode: "560100" },
  { id: "hebbal", label: "Hebbal", lat: 13.0358, lon: 77.597, pincode: "560024" },
  { id: "malleshwaram", label: "Malleshwaram", lat: 13.0031, lon: 77.5643, pincode: "560003" },
];

/** Central Bangalore (MG Road), used until the user picks an area. */
export const DEFAULT_AREA: Area = { id: "central", label: "Central Bangalore", lat: 12.9756, lon: 77.605, pincode: "560001" };

export interface UserLocation {
  label: string;
  lat: number;
  lon: number;
  pincode: string;
  source: "gps" | "area" | "default";
}

export const DEFAULT_LOCATION: UserLocation = { ...DEFAULT_AREA, source: "default" };

/** Closest preset area, used to borrow a pincode for a GPS fix. */
export function nearestArea(lat: number, lon: number): Area {
  let best = DEFAULT_AREA;
  let bestD = Infinity;
  for (const a of [...AREAS, DEFAULT_AREA]) {
    const d = (a.lat - lat) ** 2 + ((a.lon - lon) * Math.cos((lat * Math.PI) / 180)) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

export function cleanLocation(v: unknown): UserLocation | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const lat = Number(o.lat);
  const lon = Number(o.lon);
  if (!(lat >= 6 && lat <= 37 && lon >= 68 && lon <= 98)) return null;
  return {
    label: typeof o.label === "string" && o.label ? o.label.slice(0, 60) : "My location",
    lat,
    lon,
    pincode: typeof o.pincode === "string" && /^\d{6}$/.test(o.pincode) ? o.pincode : nearestArea(lat, lon).pincode,
    source: o.source === "gps" || o.source === "area" ? o.source : "default",
  };
}
