function routeStyle(route) {
  if (route.navSpec?.toUpperCase().includes("RNAV")) return { stroke: "#79e2ed", dasharray: undefined };
  return { stroke: "#71bbc6", dasharray: "6 5" };
}

export function ProcedurePlaybackLayer({ route, machine, showLabels = true, uiScale = 1 }) {
  if (!route?.points?.length) return null;
  const style = routeStyle(route);
  const pointTextOffset = 7 * uiScale;
  const activeTarget = machine?.activePointIndex != null ? route.points[machine.activePointIndex] : null;
  const traversedPoints = machine?.aircraft
    ? [...route.points.slice(0, Math.max(1, machine.routeProgress.currentPointIndex + 1)), machine.aircraft]
    : [];

  return (
    <g id="procedure-playback-layer" data-procedure-id={route.procedureId} pointerEvents="none">
      <polyline
        points={route.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke={style.stroke}
        strokeWidth={1.4}
        strokeDasharray={style.dasharray}
        opacity={0.84}
        vectorEffect="non-scaling-stroke"
      />
      {traversedPoints.length > 1 && (
        <polyline
          points={traversedPoints.map((point) => `${point.x},${point.y}`).join(" ")}
          fill="none"
          stroke="#e2fbff"
          strokeWidth={1.8}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {route.points.map((point) => {
        const active = activeTarget?.id === point.id;
        return (
          <g key={point.id}>
            <circle
              cx={point.x}
              cy={point.y}
              r={(active ? 4.2 : 2.4) * uiScale}
              fill={active ? "#071c20" : "#79e2ed"}
              stroke={active ? "#ffe28a" : "#79e2ed"}
              strokeWidth={active ? 1.4 : 0.8}
              vectorEffect="non-scaling-stroke"
            />
            {showLabels && (
              <text x={point.x + pointTextOffset} y={point.y - pointTextOffset} fill={active ? "#ffe28a" : "#a6dde5"} fontSize={10 * uiScale} fontFamily="monospace">
                {point.label}
              </text>
            )}
          </g>
        );
      })}
      {machine?.aircraft && (
        <g
          data-testid="playback-aircraft"
          transform={`translate(${machine.aircraft.x} ${machine.aircraft.y}) rotate(${machine.aircraft.headingDeg}) scale(${uiScale})`}
        >
          <path d="M 0 -7 L 4.5 5 L 0 3 L -4.5 5 Z" fill="#ffe28a" stroke="#071c20" strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
          <line x1="0" y1="-8" x2="0" y2="-19" stroke="#ffe28a" strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        </g>
      )}
    </g>
  );
}
