import { CENTER } from "./constants.js";

export function svgEventToRadarPoint(e, svg, viewBox) {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const parts = viewBox.split(" ").map(Number);
  return {
    x: parts[0] + ((e.clientX - rect.left) / rect.width) * parts[2],
    y: parts[1] + ((e.clientY - rect.top) / rect.height) * parts[3],
  };
}

export function svgEventTo3DGroundPoint(e, { svg, view3D, aircraft }) {
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  const sx = ((e.clientX - rect.left) / rect.width) * 900;
  const sy = ((e.clientY - rect.top) / rect.height) * 900;
  const yaw = (view3D.yaw * Math.PI) / 180;
  const pitch = (view3D.pitch * Math.PI) / 180;
  const s = view3D.scale * 1.32;
  const cx = 450;
  const cy = 645;
  const focus = aircraft.find((a) => a.id === view3D.focusId);
  const ox = focus ? focus.x : (view3D.centerX ?? CENTER);
  const oy = focus ? focus.y : (view3D.centerY ?? CENTER);
  const y2 = (cy - sy) / s;
  const x1 = (sx - cx) / s;
  const sinPitch = Math.sin(pitch);
  if (Math.abs(sinPitch) < 0.08 || s <= 0) return null;
  const z1 = -y2 / sinPitch;
  const X = x1 * Math.cos(yaw) + z1 * Math.sin(yaw);
  const Z = -x1 * Math.sin(yaw) + z1 * Math.cos(yaw);
  return { x: ox + X, y: oy + Z };
}
