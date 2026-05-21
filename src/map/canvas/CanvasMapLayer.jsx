import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  buildContourSegments,
  buildLatLonLineSegments,
  coastlineDownsample,
  contourDownsample,
  drawBoundaryLayer,
  drawPolylineLayer,
  filterCoastlineSegments,
  filterContourSegments,
} from "./canvasMapDrawers.js";

function canvasPhysicalSize(size) {
  const width = Math.max(1, Math.round((size.cssWidth || 1) * (size.dpr || 1)));
  const height = Math.max(1, Math.round((size.cssHeight || 1) * (size.dpr || 1)));
  return { width, height };
}

function useCanvasSize(canvasRef) {
  const [size, setSize] = useState({ cssWidth: 0, cssHeight: 0, dpr: 1 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    let frameId = null;
    const update = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      setSize((prev) => {
        if (prev.cssWidth === rect.width && prev.cssHeight === rect.height && prev.dpr === dpr) return prev;
        return { cssWidth: rect.width, cssHeight: rect.height, dpr };
      });
    };
    const scheduleUpdate = () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(update);
    };

    update();
    const observer = new ResizeObserver(scheduleUpdate);
    observer.observe(canvas);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId != null) cancelAnimationFrame(frameId);
      observer.disconnect();
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [canvasRef]);

  return size;
}

export const CanvasMapLayer = memo(function CanvasMapLayer({
  projection,
  view,
  zoom,
  coastlines,
  contours,
  paths,
  showCoastline = false,
  showContour = false,
  showAcaBoundary = false,
}) {
  const canvasRef = useRef(null);
  const size = useCanvasSize(canvasRef);
  const coastlineSegments = useMemo(
    () => showCoastline ? buildLatLonLineSegments(coastlines, projection) : [],
    [coastlines, projection, showCoastline]
  );
  const contourSegments = useMemo(
    () => showContour ? buildContourSegments(contours, projection) : [],
    [contours, projection, showContour]
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size.cssWidth || !size.cssHeight) return;

    const physical = canvasPhysicalSize(size);
    if (canvas.width !== physical.width) canvas.width = physical.width;
    if (canvas.height !== physical.height) canvas.height = physical.height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, physical.width, physical.height);

    if (showCoastline) {
      const visibleCoastline = filterCoastlineSegments(coastlineSegments, view, zoom, size);
      drawPolylineLayer(ctx, visibleCoastline, {
        view,
        size,
        downsample: coastlineDownsample(zoom),
        stroke: "#0d5263",
        strokeWidth: 0.55,
        opacity: 0.82,
      });
    }

    if (showContour) {
      const visibleContours = filterContourSegments(contourSegments, view, zoom, size);
      drawPolylineLayer(ctx, visibleContours, {
        view,
        size,
        downsample: contourDownsample(zoom),
        stroke: "#2f8792",
        strokeWidth: 0.5,
        opacity: 0.72,
      });
    }

    if (showAcaBoundary) {
      drawBoundaryLayer(ctx, {
        paths,
        view,
        size,
        stroke: "#2c6f7a",
        strokeWidth: 0.65,
        opacity: 0.9,
      });
    }
  }, [coastlineSegments, contourSegments, paths, showAcaBoundary, showCoastline, showContour, size, view, zoom]);

  if (!showCoastline && !showContour && !showAcaBoundary) return null;

  return (
    <foreignObject
      x={view.x}
      y={view.y}
      width={view.w}
      height={view.h}
      overflow="hidden"
      pointerEvents="none"
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
      />
    </foreignObject>
  );
});
