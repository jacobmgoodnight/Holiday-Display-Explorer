import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { hasPoint, type Display, type Point } from "./data";
export function DisplayMap({
  displays,
  selected,
  onSelect,
  onPin,
  pinning,
  center,
}: {
  displays: Display[];
  selected: string;
  onSelect: (id: string) => void;
  onPin: (p: Point) => void;
  pinning: boolean;
  center: Point;
}) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layer = useRef<L.LayerGroup | null>(null);
  const cb = useRef({ onPin, pinning });
  cb.current = { onPin, pinning };
  useEffect(() => {
    if (!el.current) return;
    const m = L.map(el.current, { zoomControl: false }).setView(
      [center.lat, center.lng],
      11,
    );
    map.current = m;
    L.control.zoom({ position: "bottomright" }).addTo(m);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    })
      .addTo(m)
      .on("tileerror", () =>
        el.current?.setAttribute("data-map-error", "true"),
      );
    layer.current = L.layerGroup().addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => {
      if (cb.current.pinning)
        cb.current.onPin({ lat: e.latlng.lat, lng: e.latlng.lng });
    });
    const observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(el.current);
    return () => {
      observer.disconnect();
      m.remove();
    };
  }, []);
  useEffect(() => {
    const l = layer.current;
    l?.clearLayers();
    for (const d of displays.filter(hasPoint)) {
      const icon = L.divIcon({
        className: "display-pin",
        html: `<span class="${d.season === "Christmas" ? "winter" : ""} ${selected === d.id ? "chosen" : ""}">${d.season === "Christmas" ? "✦" : "⌂"}</span>`,
        iconSize: [38, 42],
        iconAnchor: [19, 42],
      });
      const marker = L.marker([d.lat, d.lng], { icon }).addTo(l!);
      const label = document.createElement("span");
      label.textContent = d.name;
      marker.bindTooltip(label).on("click", () => onSelect(d.id));
      if (selected === d.id) map.current?.panTo([d.lat, d.lng]);
    }
  }, [displays, selected]);
  useEffect(() => {
    map.current?.setView([center.lat, center.lng], 11);
  }, [center.lat, center.lng]);
  return (
    <div
      className={"map-canvas " + (pinning ? "pinning" : "")}
      ref={el}
      aria-label="Display map. Select a marker or use the accessible display list."
    />
  );
}
