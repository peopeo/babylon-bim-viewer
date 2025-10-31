import { AbstractMesh, Scene, Engine, WebGPUEngine, SceneInstrumentation, ArcRotateCamera, ShadowGenerator, Mesh, AxesViewer, GizmoManager, HighlightLayer, SceneOptimizer } from '@babylonjs/core';

/**
 * Timing breakdown for model loading performance
 */
export interface LoadTimingBreakdown {
  importTime: number;
  materialsTime: number;
  shadowsTime: number;
  freezeTime: number;
  sceneReadyTime: number;
  totalTime: number;
}

/**
 * Props for the main BabylonViewer component
 */
export interface BabylonViewerProps {
  width?: string;
  height?: string;
  enableInspector?: boolean;
  showPerformanceMonitor?: boolean;
}

/**
 * Handle interface for programmatic access to viewer functions
 */
export interface BabylonViewerHandle {
  loadModelFromPath: (modelPath: string, modelName: string) => Promise<void>;
}

/**
 * Engine type - WebGPU or WebGL
 */
export type EngineType = 'WebGPU' | 'WebGL';

/**
 * Camera view preset directions
 */
export type CameraView = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';

/**
 * Refs container for Babylon.js scene objects
 */
export interface BabylonRefs {
  engine: Engine | WebGPUEngine | null;
  scene: Scene | null;
  camera: ArcRotateCamera | null;
  shadowGenerator: ShadowGenerator | null;
  axesViewer: AxesViewer | null;
  ground: Mesh | null;
  gizmoManager: GizmoManager | null;
  instrumentation: SceneInstrumentation | null;
  sceneOptimizer: SceneOptimizer | null;
  highlightLayer: HighlightLayer | null;
}

/**
 * State container for viewer UI state
 */
export interface ViewerState {
  isDragging: boolean;
  loadedModel: AbstractMesh[] | null;
  showGrid: boolean;
  showAxes: boolean;
  showGizmo: boolean;
  isLoading: boolean;
  loadingProgress: number;
  showProgress: boolean;
  loadTime?: number;
  loadTimingBreakdown?: LoadTimingBreakdown;
  currentModelName: string;
  optimizerEnabled: boolean;
  selectedMesh: AbstractMesh | null;
  showUI: boolean;
  engineType: EngineType;
  isEngineFallback: boolean;
  isEngineReady: boolean;
}

/**
 * Performance timing markers for model loading
 */
export interface PerformanceTiming {
  start: number;
  fileReadStart: number;
  fileReadEnd: number;
  importStart: number;
  importEnd: number;
  materialsStart: number;
  materialsEnd: number;
  shadowsStart: number;
  shadowsEnd: number;
  freezeStart: number;
  freezeEnd: number;
  sceneReadyStart: number;
  sceneReadyEnd: number;
  totalEnd: number;
}

/**
 * Bounding box information for a model
 */
export interface BoundingBoxInfo {
  center: { x: number; y: number; z: number };
  maxDim: number;
}

/**
 * Model loading options
 */
export interface ModelLoadOptions {
  applyMaterials?: boolean;
  enableShadows?: boolean;
  freezeMeshes?: boolean;
  centerAtOrigin?: boolean;
  fitToView?: boolean;
}

/**
 * Cleanup statistics
 */
export interface CleanupStats {
  meshesDisposed: number;
  materialsDisposed: number;
  texturesDisposed: number;
}
