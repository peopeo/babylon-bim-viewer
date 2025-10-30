import { useEffect, useState } from 'react';
import { Scene, Engine, SceneInstrumentation } from '@babylonjs/core';

interface PerformanceMetrics {
  fps: number;
  drawCalls: number;
  totalVertices: number;
  totalMeshes: number;
  activeMeshes: number;
  memoryUsage?: number; // MB
  loadTime?: number; // seconds
}

interface LoadTimingBreakdown {
  importTime: number;
  materialsTime: number;
  shadowsTime: number;
  freezeTime: number;
  sceneReadyTime: number;
  totalTime: number;
}

interface PerformanceMonitorProps {
  scene: Scene | null;
  engine: Engine | null;
  instrumentation: SceneInstrumentation | null;
  loadTime?: number;
  loadTimingBreakdown?: LoadTimingBreakdown;
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  scene,
  engine,
  instrumentation,
  loadTime,
  loadTimingBreakdown,
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    drawCalls: 0,
    totalVertices: 0,
    totalMeshes: 0,
    activeMeshes: 0,
    loadTime,
  });

  useEffect(() => {
    if (!scene || !engine || !instrumentation) return;

    const updateMetrics = () => {
      setMetrics({
        fps: Math.round(engine.getFps()),
        drawCalls: scene.getActiveIndices() / 3, // Approximate triangles
        totalVertices: scene.getTotalVertices(),
        totalMeshes: scene.meshes.length,
        activeMeshes: scene.getActiveMeshes().length,
        memoryUsage: (performance as any).memory
          ? Math.round((performance as any).memory.usedJSHeapSize / (1024 * 1024))
          : undefined,
        loadTime,
      });
    };

    // Update every 500ms
    const interval = setInterval(updateMetrics, 500);
    updateMetrics();

    return () => clearInterval(interval);
  }, [scene, engine, instrumentation, loadTime]);

  if (!scene || !engine) return null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>Performance Metrics</div>
      <div style={styles.content}>
        <MetricRow label="FPS" value={metrics.fps} color={getFpsColor(metrics.fps)} />
        <MetricRow label="Draw Calls" value={metrics.drawCalls} />
        <MetricRow label="Total Vertices" value={metrics.totalVertices.toLocaleString()} />
        <MetricRow label="Total Meshes" value={metrics.totalMeshes} />
        <MetricRow label="Active Meshes" value={metrics.activeMeshes} />
        {metrics.memoryUsage && (
          <MetricRow label="Memory" value={`${metrics.memoryUsage} MB`} />
        )}
        {metrics.loadTime && (
          <MetricRow label="Load Time" value={`${metrics.loadTime.toFixed(2)}s`} />
        )}
        {loadTimingBreakdown && (
          <>
            <div style={styles.separator}>Load Breakdown</div>
            <MetricRow label="  File Import" value={`${loadTimingBreakdown.importTime.toFixed(2)}s`} />
            <MetricRow label="  Materials" value={`${loadTimingBreakdown.materialsTime.toFixed(2)}s`} />
            <MetricRow label="  Shadows" value={`${loadTimingBreakdown.shadowsTime.toFixed(2)}s`} />
            <MetricRow label="  Mesh Freezing" value={`${loadTimingBreakdown.freezeTime.toFixed(2)}s`} />
            <MetricRow label="  Scene Ready" value={`${loadTimingBreakdown.sceneReadyTime.toFixed(2)}s`} />
            <div style={styles.separator}></div>
            <MetricRow label="  Total" value={`${loadTimingBreakdown.totalTime.toFixed(2)}s`} color="#4ade80" />
          </>
        )}
      </div>
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: string | number; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div style={styles.row}>
    <span style={styles.label}>{label}:</span>
    <span style={{ ...styles.value, color: color || '#fff' }}>{value}</span>
  </div>
);

const getFpsColor = (fps: number): string => {
  if (fps >= 55) return '#4ade80'; // green
  if (fps >= 30) return '#fbbf24'; // yellow
  return '#f87171'; // red
};

const styles = {
  container: {
    position: 'fixed' as const,
    top: '10px',
    right: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    padding: '12px',
    borderRadius: '6px',
    fontFamily: 'monospace',
    fontSize: '12px',
    color: '#fff',
    zIndex: 1000,
    minWidth: '220px',
    backdropFilter: 'blur(4px)',
  },
  header: {
    fontWeight: 'bold',
    marginBottom: '8px',
    fontSize: '13px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
    paddingBottom: '6px',
  },
  content: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    opacity: 0.7,
  },
  value: {
    fontWeight: 'bold',
  },
  separator: {
    fontSize: '11px',
    opacity: 0.6,
    marginTop: '6px',
    marginBottom: '4px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
    paddingTop: '6px',
  },
};
