import {
  Scene,
  ArcRotateCamera,
  ShadowGenerator,
  Mesh,
  AxesViewer,
  GizmoManager,
  SceneInstrumentation,
  HighlightLayer,
  AbstractMesh,
} from '@babylonjs/core';
import { IEngine } from './IEngine';

/**
 * Scene manager abstraction - handles scene lifecycle
 *
 * Purpose: Manage creation, configuration, and disposal of Babylon.js scenes.
 * Encapsulates all scene-related objects (camera, lights, ground, etc.)
 *
 * Design: Facade pattern - provides simple interface to complex scene setup
 */
export interface ISceneManager {
  /**
   * Initialize a new scene with all required objects
   * Called once during viewer setup
   */
  initialize(engine: IEngine, canvas: HTMLCanvasElement): Promise<SceneContext>;

  /**
   * Dispose of the current scene and all its resources
   * Called before loading a new model (if clean slate desired)
   */
  dispose(): Promise<void>;

  /**
   * Get the current scene context
   * Returns null if not initialized
   */
  getContext(): SceneContext | null;

  /**
   * Update scene configuration
   * For example: toggle grid, axes, background color
   */
  updateConfig(config: SceneConfigUpdate): void;
}

/**
 * Scene context - all objects that make up a scene
 *
 * This is what gets returned from scene initialization.
 * Contains references to all scene objects for manipulation.
 */
export interface SceneContext {
  /**
   * The Babylon.js scene instance
   */
  scene: Scene;

  /**
   * Arc rotate camera for orbital viewing
   */
  camera: ArcRotateCamera;

  /**
   * Shadow generator for directional light
   */
  shadowGenerator: ShadowGenerator;

  /**
   * Ground plane with grid material
   */
  ground: Mesh;

  /**
   * Axes viewer at origin (X=red, Y=green, Z=blue)
   */
  axesViewer: AxesViewer | null;

  /**
   * Gizmo manager for object manipulation
   */
  gizmoManager: GizmoManager;

  /**
   * Scene instrumentation for performance monitoring
   */
  instrumentation: SceneInstrumentation;

  /**
   * Highlight layer for mesh selection
   */
  highlightLayer: HighlightLayer;
}

/**
 * Configuration updates for scene
 * All properties optional - only update what's specified
 */
export interface SceneConfigUpdate {
  /**
   * Show/hide ground grid
   */
  showGrid?: boolean;

  /**
   * Show/hide axes viewer
   */
  showAxes?: boolean;

  /**
   * Show/hide gizmo for selected mesh
   */
  showGizmo?: boolean;

  /**
   * Background color (RGBA)
   * Example: { r: 0.5, g: 0.5, b: 0.55, a: 1.0 }
   */
  backgroundColor?: { r: number; g: number; b: number; a: number };

  /**
   * Enable/disable scene optimizer
   * Optimizer automatically adjusts quality for target FPS
   */
  optimizerEnabled?: boolean;
}

/**
 * Browser detection results
 *
 * Used for applying browser-specific optimizations.
 * Centralized detection prevents scattered UA checks.
 */
export interface BrowserInfo {
  /**
   * Is Google Chrome
   */
  isChrome: boolean;

  /**
   * Is Mozilla Firefox
   */
  isFirefox: boolean;

  /**
   * Is Safari
   */
  isSafari: boolean;

  /**
   * Browser name string for logging
   */
  name: string;

  /**
   * Browser version if detectable
   */
  version?: string;
}
