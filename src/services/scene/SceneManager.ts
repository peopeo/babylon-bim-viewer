import { ISceneManager, SceneContext, SceneConfigUpdate } from '../../core/interfaces';
import { IEngine } from '../../core/interfaces';
import { SceneFactory } from './SceneFactory';

/**
 * Scene Manager - Manages scene lifecycle
 *
 * Purpose: Encapsulates scene creation, configuration, and disposal.
 * Provides a clean interface for managing the Babylon.js scene.
 *
 * Design: Facade pattern - simplifies scene management operations
 */
export class SceneManager implements ISceneManager {
  private context: SceneContext | null = null;
  private isChrome: boolean = false;

  /**
   * Initialize scene with engine and canvas
   *
   * Creates complete scene with camera, lights, ground, etc.
   * Applies browser-specific optimizations if needed.
   *
   * @param engine - Engine to attach scene to
   * @param canvas - Canvas for camera controls
   * @returns Promise<SceneContext> - Complete scene context
   */
  async initialize(engine: IEngine, canvas: HTMLCanvasElement): Promise<SceneContext> {
    if (this.context) {
      console.warn('Scene already initialized, disposing existing scene');
      await this.dispose();
    }

    // Detect browser for optimizations
    this.isChrome = this.detectChrome();

    // Create scene using factory
    this.context = SceneFactory.create(engine, canvas);

    // Apply browser optimizations if needed
    SceneFactory.applyBrowserOptimizations(this.context.scene, this.isChrome);

    console.log('Scene manager initialized successfully');
    return this.context;
  }

  /**
   * Dispose scene and all resources
   *
   * Properly cleans up all scene objects in correct order.
   * Nulls out context to prevent accidental reuse.
   */
  async dispose(): Promise<void> {
    if (!this.context) {
      return;
    }

    console.log('Disposing scene manager...');

    const { scene, axesViewer, gizmoManager, highlightLayer, instrumentation } = this.context;

    try {
      // Dispose scene components in reverse order of creation
      if (highlightLayer) {
        highlightLayer.dispose();
      }

      if (instrumentation) {
        instrumentation.dispose();
      }

      if (gizmoManager) {
        gizmoManager.dispose();
      }

      if (axesViewer) {
        axesViewer.dispose();
      }

      // Scene disposal will handle camera, lights, ground, shadow generator
      if (scene) {
        scene.dispose();
      }

      console.log('Scene manager disposed successfully');
    } catch (error) {
      console.error('Error disposing scene manager:', error);
      throw error;
    } finally {
      this.context = null;
    }
  }

  /**
   * Get current scene context
   *
   * @returns SceneContext | null - Current context or null if not initialized
   */
  getContext(): SceneContext | null {
    return this.context;
  }

  /**
   * Update scene configuration
   *
   * Allows runtime changes to scene settings without full reinitialization.
   * Only updates provided properties, leaves others unchanged.
   *
   * @param config - Partial configuration to update
   */
  updateConfig(config: SceneConfigUpdate): void {
    if (!this.context) {
      console.warn('Cannot update config: scene not initialized');
      return;
    }

    const { scene, camera } = this.context;

    // Update scene properties
    if (config.clearColor !== undefined) {
      scene.clearColor = config.clearColor;
    }

    if (config.environmentIntensity !== undefined) {
      scene.environmentIntensity = config.environmentIntensity;
    }

    // Update camera properties
    if (config.camera) {
      if (config.camera.wheelPrecision !== undefined) {
        camera.wheelPrecision = config.camera.wheelPrecision;
      }

      if (config.camera.panningSensibility !== undefined) {
        camera.panningSensibility = config.camera.panningSensibility;
      }

      if (config.camera.inertia !== undefined) {
        camera.inertia = config.camera.inertia;
      }

      if (config.camera.minZ !== undefined) {
        camera.minZ = config.camera.minZ;
      }

      if (config.camera.maxZ !== undefined) {
        camera.maxZ = config.camera.maxZ;
      }

      if (config.camera.lowerRadiusLimit !== undefined) {
        camera.lowerRadiusLimit = config.camera.lowerRadiusLimit;
      }

      if (config.camera.upperRadiusLimit !== undefined) {
        camera.upperRadiusLimit = config.camera.upperRadiusLimit;
      }
    }

    console.log('Scene configuration updated');
  }

  /**
   * Detect if browser is Chrome
   *
   * @returns boolean - True if Chrome, false otherwise
   */
  private detectChrome(): boolean {
    const ua = navigator.userAgent;
    return /Chrome/.test(ua) && /Google Inc/.test(navigator.vendor);
  }
}
