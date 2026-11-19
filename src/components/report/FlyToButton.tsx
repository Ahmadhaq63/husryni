"use client";

import { flyToItem } from "@/components/three/flyTo";

/** "Show on the house": scrolls to the 3D condition map and flies its drone camera to the item. */
export default function FlyToButton({ itemKey, label, className = "fly-btn" }: { itemKey: string; label: string; className?: string }) {
  return (
    <button type="button" className={`${className} no-print`} onClick={() => flyToItem(itemKey)}>
      <i className="bi bi-crosshair" aria-hidden="true" />
      {label}
    </button>
  );
}
