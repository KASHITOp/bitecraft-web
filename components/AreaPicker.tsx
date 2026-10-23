"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { AREAS, nearestArea } from "@/lib/location";
import { useLocation } from "@/lib/state";

/** "Use my location" or pick an area. Saved on the phone; used for live prices. */
export function AreaPicker() {
  const [loc, setLoc] = useLocation();
  const [status, setStatus] = useState<"" | "asking" | "denied">("");

  const useGps = () => {
    if (!("geolocation" in navigator)) {
      setStatus("denied");
      return;
    }
    setStatus("asking");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Math.round(pos.coords.latitude * 10000) / 10000;
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        const near = nearestArea(lat, lon);
        setLoc({ label: `My location, near ${near.label}`, lat, lon, pincode: near.pincode, source: "gps" });
        setStatus("");
      },
      () => setStatus("denied"),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000 },
    );
  };

  return (
    <div data-testid="area-picker">
      <p className="text-sm">
        Prices for: <strong data-testid="area-current">{loc.label}</strong>
        {loc.source === "default" && <span className="text-muted"> (default)</span>}
      </p>
      <button type="button" className="btn mt-2 w-full" onClick={useGps} disabled={status === "asking"}>
        <Icon name="search" size={18} />
        {status === "asking" ? "Finding you…" : "Use my location"}
      </button>
      {status === "denied" && (
        <p className="mt-1.5 text-sm text-muted" role="status">
          Couldn&apos;t get your location. Pick your area below instead.
        </p>
      )}
      <label htmlFor="area-select" className="label mt-3 block">
        Or pick your area
      </label>
      <select
        id="area-select"
        className="field mt-1.5"
        value={loc.source === "area" ? (AREAS.find((a) => a.label === loc.label)?.id ?? "") : ""}
        onChange={(e) => {
          const a = AREAS.find((x) => x.id === e.target.value);
          if (a) setLoc({ label: a.label, lat: a.lat, lon: a.lon, pincode: a.pincode, source: "area" });
        }}
      >
        <option value="">Choose an area in Bangalore</option>
        {AREAS.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>
      <p className="mt-1.5 text-xs text-muted">Only kept on this phone. Used to check prices at your nearest stores.</p>
    </div>
  );
}
