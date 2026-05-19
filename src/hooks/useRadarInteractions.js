export function useRadarInteractions({
  svgRef,
  viewBox,
  mouseVectorMode,
  selected,
  radarView,
  viewSize,
  followSelected,
  getRadarPointFromEvent,
  headingToPoint,
  applyVectorHeading,
  setMouseVectorMode,
  setVectorPreview,
  setRadarView,
  setZoom,
  clamp,
}) {
  function svgEventToRadarPoint(e) {
    return getRadarPointFromEvent(e, svgRef.current, viewBox);
  }

  function handleRadarMove(e) {
    if (!mouseVectorMode) return;
    const p = svgEventToRadarPoint(e);
    if (p) setVectorPreview({ ...p, heading: headingToPoint(selected.x, selected.y, p) });
  }

  function handleRadarClick(e) {
    if (!mouseVectorMode) return;
    const p = svgEventToRadarPoint(e);
    if (!p) return;
    applyVectorHeading(headingToPoint(selected.x, selected.y, p));
    setMouseVectorMode(false);
    setVectorPreview(null);
  }

  function handleRadarMouseDown(e) {
    if (e.button !== 0 || mouseVectorMode || followSelected) return;
    e.preventDefault();
    setRadarView((v) => ({ ...v, panning: true, lastX: e.clientX, lastY: e.clientY }));
  }

  function handleRadarMouseMove(e) {
    if (radarView.panning) {
      const svg = svgRef.current;
      const rect = svg?.getBoundingClientRect();
      if (rect) {
        const dx = ((e.clientX - radarView.lastX) / rect.width) * viewSize;
        const dy = ((e.clientY - radarView.lastY) / rect.height) * viewSize;
        setRadarView((v) => ({ ...v, x: v.x - dx, y: v.y - dy, lastX: e.clientX, lastY: e.clientY }));
      }
      return;
    }
    handleRadarMove(e);
  }

  function stopRadarPan() {
    setRadarView((v) => ({ ...v, panning: false }));
  }

  function handleRadarMouseLeave() {
    stopRadarPan();
    if (mouseVectorMode) setVectorPreview(null);
  }

  function handleRadarWheel(e) {
    e.preventDefault();
    setZoom((z) => clamp(Number((z + (e.deltaY < 0 ? 0.35 : -0.35)).toFixed(2)), 0.55, 8));
  }

  return {
    handleRadarClick,
    handleRadarMouseDown,
    handleRadarMouseMove,
    handleRadarMouseLeave,
    stopRadarPan,
    handleRadarWheel,
  };
}
