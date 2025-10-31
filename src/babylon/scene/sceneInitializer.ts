import {
  Scene,
  Engine,
  WebGPUEngine,
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
import { VIEWER_CONFIG } from '../../components/BabylonViewer.config';

/**
 * Initialize a new Babylon.js scene with all required objects
 * Follows Single Responsibility Principle - only handles scene creation
 */
export function initializeScene(
  engine: Engine | WebGPUEngine,
  canvas: HTMLCanvasElement
): {
  scene: Scene;
  camera: ArcRotateCamera;
  shadowGenerator: ShadowGenerator;
  ground: Mesh;
  axesViewer: AxesViewer;
  gizmoManager: GizmoManager;
  instrumentation: SceneInstrumentation;
  highlightLayer: HighlightLayer;
} {
  // Create scene
  const scene = new Scene(engine);
  scene.clearColor = VIEWER_CONFIG.scene.clearColor;

  // Environment settings for PBR materials
  scene.environmentIntensity = 1.5;

  // Performance optimizations during loading
  scene.skipFrustumClipping = true;
  scene.skipPointerMovePicking = true;

  // Enable scene instrumentation for performance monitoring
  const instrumentation = new SceneInstrumentation(scene);
  instrumentation.captureActiveMeshesEvaluationTime = true;
  instrumentation.captureRenderTargetsRenderTime = true;
  instrumentation.captureFrameTime = true;

  // Create camera
  const camera = createCamera(scene, canvas);

  // Create lights
  const { dirLight } = createLights(scene);

  // Create shadow generator
  const shadowGenerator = createShadowGenerator(dirLight);

  // Create ground with grid material
  const ground = createGround(scene);

  // Create axes viewer at origin
  const axesViewer = new AxesViewer(scene, VIEWER_CONFIG.axes.size);

  // Create highlight layer for selection
  const highlightLayer = createHighlightLayer(scene);

  // Create gizmo manager
  const gizmoManager = createGizmoManager(scene);

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
 * Create and configure the arc rotate camera
 */
function createCamera(scene: Scene, canvas: HTMLCanvasElement): ArcRotateCamera {
  const camera = new ArcRotateCamera(
    VIEWER_CONFIG.camera.name,
    VIEWER_CONFIG.camera.alpha,
    VIEWER_CONFIG.camera.beta,
    VIEWER_CONFIG.camera.radius,
    VIEWER_CONFIG.camera.target,
    scene
  );

  camera.attachControl(canvas, true);
  camera.wheelPrecision = VIEWER_CONFIG.camera.wheelPrecision;
  camera.panningSensibility = VIEWER_CONFIG.camera.panningSensibility;
  camera.inertia = VIEWER_CONFIG.camera.inertia;
  camera.minZ = VIEWER_CONFIG.camera.minZ;
  camera.maxZ = VIEWER_CONFIG.camera.maxZ;
  camera.lowerRadiusLimit = VIEWER_CONFIG.camera.lowerRadiusLimit;
  camera.upperRadiusLimit = VIEWER_CONFIG.camera.upperRadiusLimit;

  return camera;
}

/**
 * Create and configure scene lights
 */
function createLights(scene: Scene): { hemiLight: HemisphericLight; dirLight: DirectionalLight } {
  const hemiLight = new HemisphericLight(
    VIEWER_CONFIG.lights.hemispheric.name,
    VIEWER_CONFIG.lights.hemispheric.direction,
    scene
  );
  hemiLight.intensity = VIEWER_CONFIG.lights.hemispheric.intensity;

  const dirLight = new DirectionalLight(
    VIEWER_CONFIG.lights.directional.name,
    VIEWER_CONFIG.lights.directional.direction,
    scene
  );
  dirLight.position = VIEWER_CONFIG.lights.directional.position;
  dirLight.intensity = VIEWER_CONFIG.lights.directional.intensity;

  return { hemiLight, dirLight };
}

/**
 * Create shadow generator
 */
function createShadowGenerator(light: DirectionalLight): ShadowGenerator {
  const shadowGenerator = new ShadowGenerator(
    VIEWER_CONFIG.shadows.mapSize,
    light
  );
  shadowGenerator.useBlurExponentialShadowMap = VIEWER_CONFIG.shadows.useBlurExponentialShadowMap;
  shadowGenerator.blurKernel = VIEWER_CONFIG.shadows.blurKernel;

  return shadowGenerator;
}

/**
 * Create ground plane with grid material
 */
function createGround(scene: Scene): Mesh {
  const ground = MeshBuilder.CreateGround(
    VIEWER_CONFIG.ground.name,
    {
      width: VIEWER_CONFIG.ground.width,
      height: VIEWER_CONFIG.ground.height,
    },
    scene
  ) as Mesh;

  ground.position.y = VIEWER_CONFIG.ground.positionY;
  ground.receiveShadows = true;

  // Create grid material
  const gridMaterial = new GridMaterial(VIEWER_CONFIG.gridMaterial.name, scene);
  gridMaterial.gridRatio = VIEWER_CONFIG.gridMaterial.gridRatio;
  gridMaterial.majorUnitFrequency = VIEWER_CONFIG.gridMaterial.majorUnitFrequency;
  gridMaterial.minorUnitVisibility = VIEWER_CONFIG.gridMaterial.minorUnitVisibility;
  gridMaterial.mainColor = VIEWER_CONFIG.gridMaterial.mainColor;
  gridMaterial.lineColor = VIEWER_CONFIG.gridMaterial.lineColor;
  gridMaterial.opacity = VIEWER_CONFIG.gridMaterial.opacity;
  ground.material = gridMaterial;

  return ground;
}

/**
 * Create highlight layer for mesh selection
 */
function createHighlightLayer(scene: Scene): HighlightLayer {
  const highlightLayer = new HighlightLayer('highlight', scene);
  highlightLayer.outerGlow = true;
  highlightLayer.innerGlow = false;

  return highlightLayer;
}

/**
 * Create gizmo manager for object manipulation
 */
function createGizmoManager(scene: Scene): GizmoManager {
  const utilLayer = new UtilityLayerRenderer(scene);
  const gizmoManager = new GizmoManager(scene, 2, utilLayer);
  gizmoManager.usePointerToAttachGizmos = false; // Manual control
  gizmoManager.positionGizmoEnabled = false;
  gizmoManager.rotationGizmoEnabled = false;
  gizmoManager.scaleGizmoEnabled = false;
  gizmoManager.boundingBoxGizmoEnabled = false;

  return gizmoManager;
}

/**
 * Apply Chrome-specific optimizations for shader compilation
 */
export function applyBrowserOptimizations(scene: Scene, isChrome: boolean): void {
  if (isChrome) {
    console.log('Applying Chrome-specific optimizations...');
    // Disable automatic material cleaning (speeds up compilation)
    scene.autoClear = false;
    scene.autoClearDepthAndStencil = false;

    // Block material updates during load to speed up parsing
    scene.blockMaterialDirtyMechanism = true;
  }
}

/**
 * Re-enable scene optimizations after model loading
 */
export function restoreSceneOptimizations(scene: Scene): void {
  scene.skipFrustumClipping = false;
  scene.skipPointerMovePicking = false;
  scene.autoClear = true;
  scene.autoClearDepthAndStencil = true;
  scene.blockMaterialDirtyMechanism = false;
  console.log('Scene optimizations re-enabled');
}
