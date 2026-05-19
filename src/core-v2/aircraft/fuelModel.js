export const DEFAULT_FUEL_FLOW_KG_PER_HOUR = {
  idle: 350,
  taxi: 500,
  approach: 900,
  descent: 700,
  cruise: 1400,
  climb: 2200,
  goAround: 2600,
  holding: 1100,
};

export function computeFuelBurnKg({ phase, seconds, flowModel = DEFAULT_FUEL_FLOW_KG_PER_HOUR }) {
  const flow = Number(flowModel?.[phase] ?? 0);
  const durationSeconds = Number(seconds ?? 0);
  if (!Number.isFinite(flow) || !Number.isFinite(durationSeconds) || durationSeconds <= 0) return 0;
  return (flow / 3600) * durationSeconds;
}
