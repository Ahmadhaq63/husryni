/**
 * Asking the condition map for a drone flight from anywhere on the page, and the drone's labels.
 * Plain module (no three.js), so buttons elsewhere in the report stay light.
 */
export const FLY_EVENT = "husryni:fly-to";

/** Ask the condition map on this page to fly its drone camera to an item (the map scrolls into view). */
export function flyToItem(key: string) {
  window.dispatchEvent(new CustomEvent(FLY_EVENT, { detail: { key } }));
}

/** Translated labels for the drone camera (the map works with English defaults). */
export interface DroneUi {
  view: string;
  tour: string;
  stop: string;
  home: string;
  prev: string;
  next: string;
  inReport: string;
  none: string;
  /** "{i} of {n}" */
  step: string;
  hint: string;
}

export const DRONE_UI_EN: DroneUi = {
  view: "Drone view",
  tour: "Fly around the house",
  stop: "Stop",
  home: "Whole house",
  prev: "Previous",
  next: "Next",
  inReport: "See in report",
  none: "No findings.",
  step: "{i} of {n}",
  hint: "Click a marker to fly to that part of the house.",
};
