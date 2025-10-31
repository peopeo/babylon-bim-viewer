import {
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  MeshBuilder,
  Mesh,
  AxesViewer,
  GizmoManager,
  UtilityLayerRenderer,
  SceneInstrumentation,
  HighlightLayer,
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import { IEngine } from '../../core/interfaces';
import { SceneContext } from '../../core/interfaces/ISceneManager';
import { VIEWER_CONFIG } from '../../config/viewer.config';

/**
 * Scene Factory - Creates and configures Babylon.js scenes
 *
 * Purpose: Encapsulates all scene setup logic in one place.
 * Creates scene with camera, lights, ground, axes, gizmos, etc.
 *
 * Design: Factory pattern - creates complex object graphs
 */
export class SceneFactory {
  /**
   * Create a complete scene with all required objects
   *
   * @param engine - Engine to attach scene to
   * @param canvas - Canvas for camera controls
   * @returns SceneContext with all scene objects
   */
  static create(engine: IEngine, canvas: HTMLCanvasElement): SceneContext {
    console.log('=== CREATING SCENE ===');

    // Create base scene
    const scene = this.createBaseScene(engine);

    // Create camera
    const camera = this.createCamera(scene, canvas);

    // Create lights
    const { shadowGenerator } = this.createLights(scene);

    // Create ground with grid
    const ground = this.createGround(scene);

    // Create axes viewer
    const axesViewer = this.createAxesViewer(scene);

    // Create gizmo manager
    const gizmoManager = this.createGizmoManager(scene);

    // Create instrumentation for performance monitoring
    const instrumentation = this.createInstrumentation(scene);

    // Create highlight layer for selection
    const highlightLayer = this.createHighlightLayer(scene);

    console.log('Scene created successfully');

    return {
      scene,
      camera,
      shadowGenerator,
      ground,
      axesViewer,
      gizmoManager,
      instrumentation,
      highlightLayer,
    };
  }

  /**
   * Create base scene with initial configuration
   */
  private static createBaseScene(engine: IEngine): Scene {
    const scene = new Scene(engine.getInternalEngine());

    // Set background color
    scene.clearColor = VIEWER_CONFIG.scene.clearColor;

    // Environment intensity for PBR materials
    scene.environmentIntensity = VIEWER_CONFIG.scene.environmentIntensity;

    /**
     * Performance optimizations during loading
     *
     * Why: These improve loading performance and are re-enabled after load
     * - skipFrustumClipping: Skip culling checks during load
     * - skipPointerMovePicking: Disable picking during load
     */
    scene.skipFrustumClipping = true;
    scene.skipPointerMovePicking = true;

    return scene;
  }

  /**
   * Create and configure arc rotate camera
   */
  private static createCamera(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
    const config = VIEWER_CONFIG.camera;

    const camera = new ArcRotateCamera(
      config.name,
      config.alpha,
      config.beta,
      config.radius,
      config.target,
      scene
    );

    // Attach controls to canvas
    camera.attachControl(canvas, true);

    // Apply configuration
    camera.wheelPrecision = config.wheelPrecision;
    camera.panningSensibility = config.panningSensibility;
    camera.inertia = config.inertia;
    camera.minZ = config.minZ;
    camera.maxZ = config.maxZ;
    camera.lowerRadiusLimit = config.lowerRadiusLimit;
    camera.upperRadiusLimit = config.upperRadiusLimit;

    return camera;
  }

  /**
   * Create lights and shadow generator
   */
  private static createLights(scene: Scene): {
    hemiLight: HemisphericLight;
    dirLight: DirectionalLight;
    shadowGenerator: ShadowGenerator;
  } {
    const lightConfig = VIEWER_CONFIG.lights;

    // Hemispheric light for ambient lighting
    const hemiLight = new HemisphericLight(
      lightConfig.hemispheric.name,
      lightConfig.hemispheric.direction,
      scene
    );
    hemiLight.intensity = lightConfig.hemispheric.intensity;

    // Directional light for shadows
    const dirLight = new DirectionalLight(
      lightConfig.directional.name,
      lightConfig.directional.direction,
      scene
    );
    dirLight.position = lightConfig.directional.position;
    dirLight.intensity = lightConfig.directional.intensity;

    // Shadow generator
    const shadowConfig = VIEWER_CONFIG.shadows;
    const shadowGenerator = new ShadowGenerator(shadowConfig.mapSize, dirLight);
    shadowGenerator.useBlurExponentialShadowMap = shadowConfig.useBlurExponentialShadowMap;
    shadowGenerator.blurKernel = shadowConfig.blurKernel;

    return { hemiLight, dirLight, shadowGenerator };
  }

  /**
   * Create ground plane with grid material
   */
  private static createGround(scene: Scene): Mesh {
    const groundConfig = VIEWER_CONFIG.ground;
    const gridConfig = VIEWER_CONFIG.gridMaterial;

    // Create ground mesh
    const ground = MeshBuilder.CreateGround(
      groundConfig.name,
      {
        width: groundConfig.width,
        height: groundConfig.height,
      },
      scene
    ) as Mesh;

    ground.position.y = groundConfig.positionY;
    ground.receiveShadows = true;

    // Create grid material
    const gridMaterial = new GridMaterial(gridConfig.name, scene);
    gridMaterial.gridRatio = gridConfig.gridRatio;
    gridMaterial.majorUnitFrequency = gridConfig.majorUnitFrequency;
    gridMaterial.minorUnitVisibility = gridConfig.minorUnitVisibility;
    gridMaterial.mainColor = gridConfig.mainColor;
    gridMaterial.lineColor = gridConfig.lineColor;
    gridMaterial.opacity = gridConfig.opacity;

    ground.material = gridMaterial;

    return ground;
  }

  /**
   * Create axes viewer at origin
   */
  private static createAxesViewer(scene: Scene): AxesViewer {
    const axesConfig = VIEWER_CONFIG.axes;
    return new AxesViewer(scene, axesConfig.size);
  }

  /**
   * Create gizmo manager for object manipulation
   */
  private static createGizmoManager(scene: Scene): GizmoManager {
    const utilLayer = new UtilityLayerRenderer(scene);
    const gizmoManager = new GizmoManager(scene, 2, utilLayer);

    // Initially disabled - will be enabled when mesh is selected
    gizmoManager.usePointerToAttachGizmos = false;
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;

    return gizmoManager;
  }

  /**
   * Create scene instrumentation for performance monitoring
   */
  private static createInstrumentation(scene: Scene): SceneInstrumentation {
    const instrumentation = new SceneInstrumentation(scene);
    instrumentation.captureActiveMeshesEvaluationTime = true;
    instrumentation.captureRenderTargetsRenderTime = true;
    instrumentation.captureFrameTime = true;

    return instrumentation;
  }

  /**
   * Create highlight layer for mesh selection
   */
  private static createHighlightLayer(scene: Scene): HighlightLayer {
    const highlightLayer = new HighlightLayer('highlight', scene);
    highlightLayer.outerGlow = true;
    highlightLayer.innerGlow = false;

    return highlightLayer;
  }

  /**
   * Apply browser-specific optimizations to scene
   *
   * CHROME ONLY: Block material dirty mechanism during load
   *
   * Why: Chrome batches shader compilation more efficiently when material
   * updates are blocked during initial GLB parsing.
   *
   * Impact: ~30% faster load times on Chrome for large models
   * Browser: Chrome only - Firefox doesn't benefit
   * Risk: Low - automatically disabled after model loads
   */
  static applyBrowserOptimizations(scene: Scene, isChrome: boolean): void {
    if (isChrome && VIEWER_CONFIG.optimization.blockMaterialDirtyMechanismForChrome) {
      console.log('Applying Chrome-specific scene optimizations...');
      scene.autoClear = false;
      scene.autoClearDepthAndStencil = false;
      scene.blockMaterialDirtyMechanism = true;
    }
  }

  /**
   * Restore scene optimizations after model loading
   *
   * Re-enables optimizations that were disabled during load
   */
  static restoreOptimizations(scene: Scene): void {
    scene.skipFrustumClipping = false;
    scene.skipPointerMovePicking = false;
    scene.autoClear = true;
    scene.autoClearDepthAndStencil = true;
    scene.blockMaterialDirtyMechanism = false;
    console.log('Scene optimizations restored');
  }
}
