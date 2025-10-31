import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Engine,
  WebGPUEngine,
  Scene,
  ArcRotateCamera,
  HemisphericLight,
  DirectionalLight,
  ShadowGenerator,
  SceneLoader,
  AbstractMesh,
  Mesh,
  AxesViewer,
  MeshBuilder,
  GizmoManager,
  UtilityLayerRenderer,
  SceneInstrumentation,
  SceneOptimizer,
  SceneOptimizerOptions,
  HardwareScalingOptimization,
  TextureOptimization,
  ShadowsOptimization,
  PostProcessesOptimization,
  HighlightLayer,
  Color3,
  Color4,
  Logger,
} from '@babylonjs/core';
import { GridMaterial } from '@babylonjs/materials';
import '@babylonjs/loaders/glTF';
import { Inspector } from '@babylonjs/inspector';

import { VIEWER_CONFIG } from './BabylonViewer.config';
import { styles } from './BabylonViewer.styles';
import {
  calculateBoundingBox,
  getBoundingBoxInfo,
  preventDragDefaults,
  isValidFileExtension,
} from './BabylonViewer.utils';
import { PerformanceMonitor } from './PerformanceMonitor';
import { MaterialLibrary } from '../materials/MaterialLibrary';

interface BabylonViewerProps {
  width?: string;
  height?: string;
  enableInspector?: boolean;
  showPerformanceMonitor?: boolean;
}

interface LoadTimingBreakdown {
  importTime: number;
  materialsTime: number;
  shadowsTime: number;
  freezeTime: number;
  sceneReadyTime: number;
  totalTime: number;
}

export interface BabylonViewerHandle {
  loadModelFromPath: (modelPath: string, modelName: string) => Promise<void>;
}

export const BabylonViewer: React.FC<BabylonViewerProps> = ({
  width = '100%',
  height = '100vh',
  enableInspector = false,
  showPerformanceMonitor = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | WebGPUEngine | null>(null);
  const sceneRef = useRef<Scene | null>(null);
  const shadowGeneratorRef = useRef<ShadowGenerator | null>(null);
  const axesViewerRef = useRef<AxesViewer | null>(null);
  const groundRef = useRef<Mesh | null>(null);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const instrumentationRef = useRef<SceneInstrumentation | null>(null);
  const sceneOptimizerRef = useRef<SceneOptimizer | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [loadedModel, setLoadedModel] = useState<AbstractMesh[] | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showGizmo, setShowGizmo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showProgress, setShowProgress] = useState(false);
  const [loadTime, setLoadTime] = useState<number | undefined>(undefined);
  const [loadTimingBreakdown, setLoadTimingBreakdown] = useState<LoadTimingBreakdown | undefined>(undefined);
  const [currentModelName, setCurrentModelName] = useState<string>('');
  const [optimizerEnabled, setOptimizerEnabled] = useState(true);
  const [selectedMesh, setSelectedMesh] = useState<AbstractMesh | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [engineType, setEngineType] = useState<'WebGPU' | 'WebGL'>('WebGL');
  const [isEngineFallback, setIsEngineFallback] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);


  // Initialize Babylon.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;

    const initEngine = async () => {
      if (!canvasRef.current) return;

      // Detect browser for optimization hints
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      const isFirefox = /Firefox/.test(navigator.userAgent);
      console.log(`Browser detected: ${isChrome ? 'Chrome' : isFirefox ? 'Firefox' : 'Other'}`);

      let engine: Engine | WebGPUEngine;
      let usingWebGPU = false;
      let fallback = false;

      // Set up error filtering BEFORE WebGPU initialization
      const originalConsoleError = console.error;
      const originalConsoleWarn = console.warn;

      // Try WebGPU first
      try {
        console.log('=== ATTEMPTING WEBGPU INITIALIZATION ===');
        const webGPUSupported = await WebGPUEngine.IsSupportedAsync;

        if (webGPUSupported) {
          console.log('WebGPU is supported! Initializing WebGPU engine...');

          // Set up error filtering for WebGPU errors BEFORE engine creation
          console.error = (...args: any[]) => {
            const message = args.join(' ');
            if (
              message.includes('CopyVideoToTexture') ||
              message.includes('InternalVideoPipeline') ||
              message.includes('Shader module creation failed') ||
              message.includes('WebGPU uncaptured error')
            ) {
              return;
            }
            originalConsoleError.apply(console, args);
          };

          console.warn = (...args: any[]) => {
            const message = args.join(' ');
            if (
              message.includes('CopyVideoToTexture') ||
              message.includes('InternalVideoPipeline') ||
              message.includes("Can't find buffer") ||
              message.includes('Light0') ||
              message.includes('draw context')
            ) {
              return;
            }
            originalConsoleWarn.apply(console, args);
          };

          // Filter Babylon.js Logger (BJS - prefix) for known WebGPU issues
          const originalLogWarn = Logger.Warn;
          Logger.Warn = (message: string | any[], limit?: number) => {
            const msg = String(message);
            // Known Babylon.js WebGPU issue: Light uniform buffers aren't initialized
            // before materials try to use them. These warnings are harmless but spam console.
            // References: https://forum.babylonjs.com/t/uncaught-error-unable-to-create-uniform-buffer/39840
            if (
              msg.includes("Can't find buffer") ||
              msg.includes('Light0') ||
              msg.includes('Make sure you bound it')
            ) {
              return; // Suppress known WebGPU initialization warnings
            }
            originalLogWarn.call(Logger, message, limit);
          };

          const webGPUEngine = new WebGPUEngine(canvasRef.current, {
            antialias: true,
            stencil: true,
            alpha: true,  // Enable alpha channel for transparent background
          });
          await webGPUEngine.initAsync();
          engine = webGPUEngine;
          usingWebGPU = true;
          console.log('✓ WebGPU engine initialized successfully');
        } else {
          console.log('WebGPU not supported by browser, falling back to WebGL');
          engine = new Engine(canvasRef.current, true, VIEWER_CONFIG.engine);
          fallback = true;
        }
      } catch (error) {
        console.warn('WebGPU initialization failed, falling back to WebGL:', error);
        engine = new Engine(canvasRef.current, true, VIEWER_CONFIG.engine);
        fallback = true;
      }

      if (!isMounted) {
        engine.dispose();
        return;
      }

      // Update state with engine type
      setEngineType(usingWebGPU ? 'WebGPU' : 'WebGL');
      setIsEngineFallback(fallback);

      engineRef.current = engine;

      // Chrome-specific engine optimizations
      if (isChrome && !usingWebGPU) {
        // Optimize engine for large model loading (WebGL only)
        engine.enableOfflineSupport = false; // Disable offline manifest checks
        engine.disablePerformanceMonitorInBackground = true; // Reduce overhead
      }

      // Log engine info for debugging
      if (usingWebGPU) {
        console.log('=== WEBGPU ENGINE INFO ===');
        console.log('Engine Type: WebGPU');
        console.log('Hardware Scaling Level:', engine.getHardwareScalingLevel());
      } else {
        console.log('=== WEBGL ENGINE INFO ===');
        const gl = (engine as Engine)._gl;
        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
          console.log('WebGL Vendor:', gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL));
          console.log('WebGL Renderer:', gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL));
        }
        console.log('WebGL Version:', (engine as Engine).webGLVersion);
        console.log('Parallel Shader Compile:', engine.getCaps().parallelShaderCompile ? 'Supported' : 'Not Supported');
      }

    // Create scene
    const scene = new Scene(engine);
    scene.clearColor = VIEWER_CONFIG.scene.clearColor;

    // Increase environment intensity for PBR materials
    scene.environmentIntensity = 1.5; // Brighter reflections and ambient

    // Performance optimizations during loading
    scene.skipFrustumClipping = true; // Disable frustum culling during load
    scene.skipPointerMovePicking = true; // Disable picking during load

    // Chrome-specific optimizations for shader compilation
    if (isChrome) {
      console.log('Applying Chrome-specific optimizations...');
      // Disable automatic material cleaning (speeds up compilation)
      scene.autoClear = false;
      scene.autoClearDepthAndStencil = false;

      // GLTF Loader optimizations for Chrome
      // Block material updates during load to speed up parsing
      scene.blockMaterialDirtyMechanism = true;
    }

    sceneRef.current = scene;

    // Enable scene instrumentation for performance monitoring
    const instrumentation = new SceneInstrumentation(scene);
    instrumentation.captureActiveMeshesEvaluationTime = true;
    instrumentation.captureRenderTargetsRenderTime = true;
    instrumentation.captureFrameTime = true;
    instrumentationRef.current = instrumentation;

    // Create camera
    const camera = new ArcRotateCamera(
      VIEWER_CONFIG.camera.name,
      VIEWER_CONFIG.camera.alpha,
      VIEWER_CONFIG.camera.beta,
      VIEWER_CONFIG.camera.radius,
      VIEWER_CONFIG.camera.target,
      scene
    );
    camera.attachControl(canvasRef.current, true);
    camera.wheelPrecision = VIEWER_CONFIG.camera.wheelPrecision;
    camera.panningSensibility = VIEWER_CONFIG.camera.panningSensibility;
    camera.inertia = VIEWER_CONFIG.camera.inertia;
    camera.minZ = VIEWER_CONFIG.camera.minZ;
    camera.maxZ = VIEWER_CONFIG.camera.maxZ;
    camera.lowerRadiusLimit = VIEWER_CONFIG.camera.lowerRadiusLimit;
    camera.upperRadiusLimit = VIEWER_CONFIG.camera.upperRadiusLimit;

    // Create lights
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

    // Create shadow generator
    const shadowGenerator = new ShadowGenerator(
      VIEWER_CONFIG.shadows.mapSize,
      dirLight
    );
    shadowGenerator.useBlurExponentialShadowMap =
      VIEWER_CONFIG.shadows.useBlurExponentialShadowMap;
    shadowGenerator.blurKernel = VIEWER_CONFIG.shadows.blurKernel;
    shadowGeneratorRef.current = shadowGenerator;

    // Create ground grid
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
    groundRef.current = ground;

    // Create grid material
    const gridMaterial = new GridMaterial(
      VIEWER_CONFIG.gridMaterial.name,
      scene
    );
    gridMaterial.gridRatio = VIEWER_CONFIG.gridMaterial.gridRatio;
    gridMaterial.majorUnitFrequency =
      VIEWER_CONFIG.gridMaterial.majorUnitFrequency;
    gridMaterial.minorUnitVisibility =
      VIEWER_CONFIG.gridMaterial.minorUnitVisibility;
    gridMaterial.mainColor = VIEWER_CONFIG.gridMaterial.mainColor;
    gridMaterial.lineColor = VIEWER_CONFIG.gridMaterial.lineColor;
    gridMaterial.opacity = VIEWER_CONFIG.gridMaterial.opacity;
    ground.material = gridMaterial;

    // Create axes viewer at origin
    const axes = new AxesViewer(scene, VIEWER_CONFIG.axes.size);
    axesViewerRef.current = axes;

    // Create highlight layer for selection
    const highlightLayer = new HighlightLayer('highlight', scene);
    highlightLayer.outerGlow = true;
    highlightLayer.innerGlow = false;
    highlightLayerRef.current = highlightLayer;

    // Create gizmo manager
    const utilLayer = new UtilityLayerRenderer(scene);
    const gizmoManager = new GizmoManager(scene, 2, utilLayer);
    gizmoManager.usePointerToAttachGizmos = false; // Manual control
    gizmoManager.positionGizmoEnabled = false;
    gizmoManager.rotationGizmoEnabled = false;
    gizmoManager.scaleGizmoEnabled = false;
    gizmoManager.boundingBoxGizmoEnabled = false;
    gizmoManagerRef.current = gizmoManager;

    // Setup click handler for mesh selection
    scene.onPointerDown = (evt, pickResult) => {
      // Only handle left click
      if (evt.button !== 0) return;

      if (pickResult.hit && pickResult.pickedMesh) {
        const mesh = pickResult.pickedMesh;

        // Don't select ground or axes
        if (mesh === groundRef.current || mesh.name.includes('axes')) {
          return;
        }

        console.log('Selected mesh:', mesh.name);
        setSelectedMesh(mesh);
      } else {
        // Clicked on empty space - deselect
        setSelectedMesh(null);
      }
    };

    // Enable inspector if requested
    if (enableInspector) {
      Inspector.Show(scene, {});
    }

    // Store scene ref for inspector toggle (remove duplicate, already set at line 194)
    // sceneRef.current = scene;

    // Mark engine as ready for file loading
    setIsEngineReady(true);
    console.log('Engine and scene initialization complete - ready for file loading');

    // Start render loop for both WebGPU and WebGL
    engine.runRenderLoop(() => {
      scene.render();
    });

      // Handle window resize
      const handleResize = () => {
        engine.resize();
      };
      window.addEventListener('resize', handleResize);

      // Return cleanup function for this engine initialization
      return () => {
        window.removeEventListener('resize', handleResize);

        // Cleanup inspector FIRST before disposing scene
        if (Inspector.IsVisible) {
          try {
            Inspector.Hide();
          } catch (e) {
            // Ignore DOM errors during cleanup
            console.warn('Inspector cleanup warning (safe to ignore):', e);
          }
        }

        if (axesViewerRef.current) {
          axesViewerRef.current.dispose();
        }
        if (gizmoManagerRef.current) {
          gizmoManagerRef.current.dispose();
        }
        scene.dispose();
        engine.dispose();
      };
    };

    // Call async initialization
    let cleanup: (() => void) | undefined;
    initEngine().then((cleanupFn) => {
      if (isMounted) {
        cleanup = cleanupFn;
      }
    });

    // Cleanup
    return () => {
      isMounted = false;
      setIsEngineReady(false);
      if (cleanup) {
        cleanup();
      }
    };
  }, [enableInspector]);

  // Handle mesh selection highlighting
  useEffect(() => {
    if (!highlightLayerRef.current) return;

    // Clear all highlights first
    highlightLayerRef.current.removeAllMeshes();

    // Add highlight to selected mesh
    if (selectedMesh && selectedMesh instanceof Mesh) {
      highlightLayerRef.current.addMesh(selectedMesh, Color3.Green());
      console.log('Highlighted mesh:', selectedMesh.name);
    }
  }, [selectedMesh]);

  // Handle ESC key to deselect
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedMesh) {
        setSelectedMesh(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMesh]);

  // Comprehensive cleanup function for disposing loaded models
  const disposeLoadedModel = useCallback(async () => {
    if (!loadedModel || !sceneRef.current) return;

    console.log('=== DISPOSING PREVIOUS MODEL ===');

    // Stop scene optimizer if running
    if (sceneOptimizerRef.current) {
      sceneOptimizerRef.current.stop();
      sceneOptimizerRef.current.dispose();
      sceneOptimizerRef.current = null;
    }

    // Clear selection
    setSelectedMesh(null);
    if (highlightLayerRef.current) {
      highlightLayerRef.current.removeAllMeshes();
    }

    // Collect all materials and textures to dispose
    const materialsToDispose = new Set<any>();
    const texturesToDispose = new Set<any>();

    loadedModel.forEach((mesh) => {
      // Remove from shadow generator
      if (shadowGeneratorRef.current && mesh instanceof Mesh) {
        shadowGeneratorRef.current.removeShadowCaster(mesh);
      }

      // Collect materials and textures
      if (mesh.material) {
        materialsToDispose.add(mesh.material);

        // Collect all texture types
        const material = mesh.material as any;
        const textureProps = [
          'albedoTexture', 'bumpTexture', 'metallicTexture', 'diffuseTexture',
          'emissiveTexture', 'opacityTexture', 'ambientTexture', 'reflectionTexture',
          'refractionTexture', 'lightmapTexture', 'specularTexture'
        ];
        textureProps.forEach(prop => {
          if (material[prop]) texturesToDispose.add(material[prop]);
        });
      }

      // Dispose mesh (don't dispose materials yet, we'll do that after)
      mesh.dispose(false, false);
    });

    // Dispose materials
    console.log(`Disposing ${materialsToDispose.size} materials...`);
    materialsToDispose.forEach((mat) => {
      if (mat && !mat.isDisposed) {
        mat.dispose(true, true); // Force dispose textures and shaders
      }
    });

    // Dispose textures
    console.log(`Disposing ${texturesToDispose.size} textures...`);
    texturesToDispose.forEach((tex) => {
      if (tex && !tex.isDisposed) {
        tex.dispose();
      }
    });

    setLoadedModel(null);

    // Force WebGPU to flush GPU commands
    if (engineRef.current && engineType === 'WebGPU') {
      sceneRef.current.render();
      console.log('WebGPU: Flushed GPU commands');
    }

    console.log('=== DISPOSAL COMPLETE ===');

    // Give browser time to garbage collect before loading new model
    await new Promise(resolve => setTimeout(resolve, 100));
  }, [loadedModel, engineType]);

  // Make scene background transparent when no model is loaded (for WebGPU)
  useEffect(() => {
    if (!sceneRef.current) return;

    if (!loadedModel && engineType === 'WebGPU') {
      // Make scene background fully transparent to show empty state
      sceneRef.current.clearColor = new Color4(0, 0, 0, 0);

      // Hide ground and axes to prevent interference with drag/drop
      if (groundRef.current) {
        groundRef.current.isVisible = false;
      }
      if (axesViewerRef.current) {
        axesViewerRef.current.dispose();
        axesViewerRef.current = null;
      }

      console.log('WebGPU: Scene background made transparent, ground/axes hidden (no model loaded)');
    } else {
      // Restore normal background color
      sceneRef.current.clearColor = VIEWER_CONFIG.scene.clearColor;

      // Restore ground and axes if they should be visible
      if (groundRef.current) {
        groundRef.current.isVisible = showGrid;
      }
      if (!axesViewerRef.current && showAxes) {
        axesViewerRef.current = new AxesViewer(sceneRef.current, VIEWER_CONFIG.axes.size);
      }
    }
  }, [loadedModel, engineType, showGrid, showAxes]);

  // Fit to view function
  const fitToView = useCallback(
    (meshes?: AbstractMesh[]) => {
      const meshesToFrame = meshes || loadedModel;
      if (
        !sceneRef.current ||
        !meshesToFrame ||
        meshesToFrame.length === 0
      )
        return;

      const camera = sceneRef.current.activeCamera as ArcRotateCamera;
      if (!camera) return;

      const { min, max } = calculateBoundingBox(meshesToFrame);
      const { center, maxDim } = getBoundingBoxInfo(min, max);

      console.log(`Bounding box calculated: center=(${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)}), maxDim=${maxDim.toFixed(2)}`);

      // Set target and radius
      camera.setTarget(center);
      const newRadius = maxDim * VIEWER_CONFIG.framing.radiusMultiplier;
      camera.radius = newRadius;

      // Set camera angles to a good default view (45° from top, looking from front-right)
      camera.alpha = -Math.PI / 4;  // 45° around Y axis
      camera.beta = Math.PI / 3;     // 60° from top

      // Dynamically adjust camera sensitivity based on radius
      // Larger radius = need MUCH lower wheelPrecision for faster zoom
      // wheelPrecision: lower values = more sensitive (faster zoom)
      // Formula: inversely proportional to radius, clamped between 0.1 and 10
      camera.wheelPrecision = Math.max(0.1, Math.min(10, 100 / camera.radius));

      // Adjust panning sensitivity based on radius
      // panningSensibility: lower values = more sensitive (faster pan)
      // Formula: inversely proportional to radius, clamped between 10 and 1000
      camera.panningSensibility = Math.max(10, Math.min(1000, 5000 / camera.radius));

      console.log(`Camera adjusted: radius=${camera.radius.toFixed(2)}, alpha=${camera.alpha.toFixed(2)}, beta=${camera.beta.toFixed(2)}, wheelPrecision=${camera.wheelPrecision.toFixed(2)}, panningSensibility=${camera.panningSensibility.toFixed(2)}`);
    },
    [loadedModel]
  );

  // Toggle grid visibility
  const toggleGrid = useCallback(() => {
    if (groundRef.current) {
      groundRef.current.isVisible = !showGrid;
      setShowGrid(!showGrid);
    }
  }, [showGrid]);

  // Toggle axes visibility
  const toggleAxes = useCallback(() => {
    if (axesViewerRef.current) {
      const newShowAxes = !showAxes;
      setShowAxes(newShowAxes);

      // AxesViewer doesn't have direct visibility toggle, so we dispose and recreate
      if (sceneRef.current) {
        axesViewerRef.current.dispose();
        if (newShowAxes) {
          axesViewerRef.current = new AxesViewer(
            sceneRef.current,
            VIEWER_CONFIG.axes.size
          );
        }
      }
    }
  }, [showAxes]);

  // Toggle gizmo visibility
  const toggleGizmo = useCallback(() => {
    if (!gizmoManagerRef.current || !loadedModel || loadedModel.length === 0) return;

    const newShowGizmo = !showGizmo;
    setShowGizmo(newShowGizmo);

    if (newShowGizmo) {
      // Find a suitable mesh to attach to (prefer meshes with geometry)
      const targetMesh = loadedModel.find((mesh) => mesh.getTotalVertices() > 0) || loadedModel[0];

      if (targetMesh) {
        // First attach to mesh
        gizmoManagerRef.current.attachToMesh(targetMesh);

        // Then enable gizmos
        gizmoManagerRef.current.positionGizmoEnabled = true;
        gizmoManagerRef.current.rotationGizmoEnabled = true;
        gizmoManagerRef.current.scaleGizmoEnabled = true;

        console.log('Gizmos enabled and attached to:', targetMesh.name);
      }
    } else {
      // Disable all gizmos
      gizmoManagerRef.current.positionGizmoEnabled = false;
      gizmoManagerRef.current.rotationGizmoEnabled = false;
      gizmoManagerRef.current.scaleGizmoEnabled = false;
      gizmoManagerRef.current.attachToMesh(null);

      console.log('Gizmos disabled');
    }
  }, [showGizmo, loadedModel]);

  // Camera view presets
  const setCameraView = useCallback(
    (view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => {
      if (!sceneRef.current) return;
      const camera = sceneRef.current.activeCamera as ArcRotateCamera;
      if (!camera) return;

      const target = camera.target;
      const radius = camera.radius;

      switch (view) {
        case 'top':
          camera.alpha = 0;
          camera.beta = 0;
          break;
        case 'bottom':
          camera.alpha = 0;
          camera.beta = Math.PI;
          break;
        case 'front':
          camera.alpha = 0;
          camera.beta = Math.PI / 2;
          break;
        case 'back':
          camera.alpha = Math.PI;
          camera.beta = Math.PI / 2;
          break;
        case 'left':
          camera.alpha = -Math.PI / 2;
          camera.beta = Math.PI / 2;
          break;
        case 'right':
          camera.alpha = Math.PI / 2;
          camera.beta = Math.PI / 2;
          break;
      }

      camera.setTarget(target);
      camera.radius = radius;
    },
    []
  );

  // Initialize and start Scene Optimizer
  const startSceneOptimizer = useCallback(() => {
    if (!sceneRef.current) return;

    console.log('=== STARTING SCENE OPTIMIZER ===');

    // Stop existing optimizer if running
    if (sceneOptimizerRef.current) {
      sceneOptimizerRef.current.stop();
      sceneOptimizerRef.current.dispose();
      sceneOptimizerRef.current = null;
    }

    // Create custom optimizer options
    const options = new SceneOptimizerOptions(30, 2000); // Target 30 FPS, check every 2000ms
    options.targetFrameRate = 30;

    // Add optimization passes in priority order
    // Priority 0: Hardware scaling (render at lower resolution)
    options.addOptimization(new HardwareScalingOptimization(0, 2)); // Max 2x downscale

    // Priority 1: Reduce shadow quality
    options.addOptimization(new ShadowsOptimization(1));

    // Priority 2: Disable post-processes
    options.addOptimization(new PostProcessesOptimization(2));

    // Priority 3: Reduce texture quality
    options.addOptimization(new TextureOptimization(3, 512)); // Min texture size 512

    // Start optimizer
    const optimizer = SceneOptimizer.OptimizeAsync(
      sceneRef.current,
      options,
      () => {
        console.log('SceneOptimizer: Target FPS reached!');
      },
      () => {
        console.log('SceneOptimizer: Could not reach target FPS with available optimizations');
      }
    );

    sceneOptimizerRef.current = optimizer;
    console.log('SceneOptimizer started with target 30 FPS');
  }, []);

  // Stop Scene Optimizer
  const stopSceneOptimizer = useCallback(() => {
    if (sceneOptimizerRef.current) {
      console.log('=== STOPPING SCENE OPTIMIZER ===');
      sceneOptimizerRef.current.stop();
      sceneOptimizerRef.current.dispose();
      sceneOptimizerRef.current = null;

      // Reset hardware scaling
      if (engineRef.current) {
        engineRef.current.setHardwareScalingLevel(1);
      }
    }
  }, []);

  // Toggle Scene Optimizer
  const toggleOptimizer = useCallback(() => {
    const newState = !optimizerEnabled;
    setOptimizerEnabled(newState);

    if (newState) {
      startSceneOptimizer();
    } else {
      stopSceneOptimizer();
    }
  }, [optimizerEnabled, startSceneOptimizer, stopSceneOptimizer]);

  // Handle file drop
  const handleDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      console.log('=== FILE DROP START ===');
      preventDragDefaults(e);
      setIsDragging(false);

      const files = e.dataTransfer.files;
      console.log('Files dropped:', files.length);
      if (files.length === 0) {
        console.log('No files dropped');
        return;
      }

      const file = files[0];
      console.log('File info:', {
        name: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
        type: file.type
      });

      if (
        !isValidFileExtension(
          file.name,
          VIEWER_CONFIG.fileLoading.acceptedExtension
        )
      ) {
        console.error('Invalid file extension');
        alert(VIEWER_CONFIG.fileLoading.errorMessage);
        return;
      }

      if (!sceneRef.current || !isEngineReady) {
        console.error('Scene not initialized or engine not ready yet');
        alert('Please wait for the viewer to finish initializing...');
        return;
      }

      console.log('Scene is ready, starting load...');

      // Dispose previous model if exists
      await disposeLoadedModel();

      try {
        // Show loading indicator
        setIsLoading(true);
        setLoadingProgress(0);
        setShowProgress(false);

        const startTime = Date.now();

        // Performance timing markers
        const perfTiming = {
          start: startTime,
          fileReadStart: 0,
          fileReadEnd: 0,
          importStart: 0,
          importEnd: 0,
          materialsStart: 0,
          materialsEnd: 0,
          shadowsStart: 0,
          shadowsEnd: 0,
          freezeStart: 0,
          freezeEnd: 0,
          sceneReadyStart: 0,
          sceneReadyEnd: 0,
          totalEnd: 0
        };

        console.log('=== LOAD PERFORMANCE TRACKING START ===');

        // Optimized loading: Use File object directly as Blob URL
        // This avoids reading the entire file into memory as ArrayBuffer (saves time and memory)
        console.log('Creating Blob URL from File object...');
        perfTiming.fileReadStart = Date.now();
        const url = URL.createObjectURL(file);
        perfTiming.fileReadEnd = Date.now();
        console.log(`Blob URL created: ${((perfTiming.fileReadEnd - perfTiming.fileReadStart) / 1000).toFixed(2)}s`);
        console.log('URL:', url);

        console.log('Starting ImportMeshAsync...');
        perfTiming.importStart = Date.now();

        // Load the GLB file - now using direct Blob URL for better performance
        const result = await SceneLoader.ImportMeshAsync(
          '', // Load all meshes
          '', // Empty rootUrl - the sceneFilename contains the full URL
          url, // Full blob URL as sceneFilename
          sceneRef.current,
          undefined, // No progress callback
          '.glb' // Plugin extension
        );

        perfTiming.importEnd = Date.now();
        console.log(`ImportMeshAsync completed! (${((perfTiming.importEnd - perfTiming.importStart) / 1000).toFixed(2)}s)`);
        console.log('Loaded meshes:', result.meshes.length);
        console.log('Mesh names:', result.meshes.map(m => m.name));

        // Clean up object URL
        URL.revokeObjectURL(url);

        // Store loaded meshes
        setLoadedModel(result.meshes);
        console.log('Model state updated');

        // === APPLY REALISTIC MATERIALS ===
        console.log('=== APPLYING REALISTIC MATERIALS ===');
        perfTiming.materialsStart = Date.now();
        const matLib = new MaterialLibrary(sceneRef.current);
        const materialStats = matLib.applyToMeshes(result.meshes as Mesh[], 1.0);
        perfTiming.materialsEnd = Date.now();
        console.log(`Material application complete: ${materialStats.replaced}/${materialStats.total} materials replaced (${((perfTiming.materialsEnd - perfTiming.materialsStart) / 1000).toFixed(2)}s)`);

        // Enable shadows for loaded meshes (only large objects)
        perfTiming.shadowsStart = Date.now();
        let shadowCount = 0;
        let skippedSmallMeshes = 0;
        const SHADOW_SIZE_THRESHOLD = 0.5; // Only meshes > 0.5 units cast shadows

        result.meshes.forEach((mesh) => {
          if (mesh instanceof Mesh && shadowGeneratorRef.current) {
            // Calculate mesh size
            const boundingInfo = mesh.getBoundingInfo();
            const size = boundingInfo.boundingBox.extendSize.length();

            // Only large meshes cast shadows
            if (size > SHADOW_SIZE_THRESHOLD) {
              shadowGeneratorRef.current.addShadowCaster(mesh);
              shadowCount++;
            } else {
              skippedSmallMeshes++;
            }
          }
        });
        perfTiming.shadowsEnd = Date.now();
        console.log(`Shadows enabled for ${shadowCount} meshes (skipped ${skippedSmallMeshes} small meshes) (${((perfTiming.shadowsEnd - perfTiming.shadowsStart) / 1000).toFixed(2)}s)`);

        // Frame the loaded model - wait for scene to be ready first
        console.log('Waiting for scene to be ready before framing...');
        perfTiming.sceneReadyStart = Date.now();
        sceneRef.current.executeWhenReady(() => {
          perfTiming.sceneReadyEnd = Date.now();
          const sceneReadyWaitTime = (perfTiming.sceneReadyEnd - perfTiming.sceneReadyStart) / 1000;
          console.log(`Scene ready (Babylon.js internal processing): ${sceneReadyWaitTime.toFixed(2)}s`);

          // Measure camera framing separately
          const framingStart = Date.now();
          fitToView(result.meshes);
          const framingEnd = Date.now();
          const framingTime = (framingEnd - framingStart) / 1000;
          console.log(`Camera framing (bounding box + fit): ${framingTime.toFixed(2)}s`);

          // Re-enable scene optimizations after load
          if (sceneRef.current) {
            sceneRef.current.skipFrustumClipping = false;
            sceneRef.current.skipPointerMovePicking = false;
            sceneRef.current.autoClear = true;
            sceneRef.current.autoClearDepthAndStencil = true;
            sceneRef.current.blockMaterialDirtyMechanism = false; // Re-enable material updates
            console.log('Scene optimizations re-enabled');
          }

          // Freeze materials to prevent shader recompilation
          console.log('Freezing materials to prevent shader recompilation...');
          let frozenMaterials = 0;
          sceneRef.current?.materials.forEach(material => {
            if (material && !material.isFrozen) {
              material.freeze();
              frozenMaterials++;
            }
          });
          console.log(`Frozen ${frozenMaterials} materials`);

          // Mark total time when scene is fully interactive
          perfTiming.totalEnd = Date.now();
          const totalTime = (perfTiming.totalEnd - perfTiming.start) / 1000;
          const importTime = (perfTiming.importEnd - perfTiming.importStart) / 1000;
          const materialsTime = (perfTiming.materialsEnd - perfTiming.materialsStart) / 1000;
          const shadowsTime = (perfTiming.shadowsEnd - perfTiming.shadowsStart) / 1000;
          const freezeTime = (perfTiming.freezeEnd - perfTiming.freezeStart) / 1000;
          const sceneReadyTime = (perfTiming.sceneReadyEnd - perfTiming.sceneReadyStart) / 1000;

          const fileReadTime = (perfTiming.fileReadEnd - perfTiming.fileReadStart) / 1000;

          console.log('=== LOAD PERFORMANCE SUMMARY ===');
          console.log(`  Blob URL Create:  ${fileReadTime.toFixed(2)}s`);
          console.log(`  GLB Parse:        ${importTime.toFixed(2)}s`);
          console.log(`  Materials:        ${materialsTime.toFixed(2)}s`);
          console.log(`  Shadows:          ${shadowsTime.toFixed(2)}s`);
          console.log(`  Mesh Freezing:    ${freezeTime.toFixed(2)}s`);
          console.log(`  Scene Ready Wait: ${sceneReadyWaitTime.toFixed(2)}s`);
          console.log(`  Camera Framing:   ${framingTime.toFixed(2)}s`);
          console.log(`  ─────────────────────────────`);
          console.log(`  TOTAL TIME:       ${totalTime.toFixed(2)}s`);
          console.log('=================================');

          // Update state with timing breakdown
          setLoadTimingBreakdown({
            importTime,
            materialsTime,
            shadowsTime,
            freezeTime,
            sceneReadyTime,
            totalTime,
          });
        });

        // Apply performance optimizations
        console.log('Applying performance optimizations...');

        // Freeze all meshes (static models don't need transform updates)
        console.log('Freezing meshes...');
        perfTiming.freezeStart = Date.now();
        let frozenCount = 0;
        result.meshes.forEach((mesh) => {
          if (mesh instanceof Mesh) {
            mesh.freezeWorldMatrix();
            frozenCount++;
          }
        });
        perfTiming.freezeEnd = Date.now();
        console.log(`Frozen ${frozenCount} meshes (${((perfTiming.freezeEnd - perfTiming.freezeStart) / 1000).toFixed(2)}s)`);

        // Start Scene Optimizer if enabled
        if (optimizerEnabled) {
          startSceneOptimizer();
        }

        // Calculate and store load time
        const elapsedTime = Date.now() - startTime;
        setLoadTime(elapsedTime / 1000); // Convert to seconds
        console.log(`Total load time: ${(elapsedTime / 1000).toFixed(2)}s`);

        const minDisplayTime = 500;
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        // Hide loading indicator
        setIsLoading(false);
        setLoadingProgress(0);
        setShowProgress(false);

        console.log('=== LOAD COMPLETE ===');
      } catch (error) {
        console.error('=== ERROR LOADING GLB ===');
        console.error('Error details:', error);
        console.error('Error stack:', (error as Error).stack);
        alert(VIEWER_CONFIG.fileLoading.loadErrorMessage);
        setIsLoading(false);
        setLoadingProgress(0);
        setShowProgress(false);
      }
    },
    [loadedModel, fitToView, optimizerEnabled, startSceneOptimizer, isEngineReady, disposeLoadedModel]
  );

  // Load model from path (for testing compression levels)
  const loadModelFromPath = useCallback(
    async (modelPath: string, modelName: string) => {
      console.log('=== LOAD MODEL FROM PATH START ===');
      console.log('Model path:', modelPath);
      console.log('Model name:', modelName);

      if (!sceneRef.current) {
        console.error('Scene not initialized');
        return;
      }

      // Dispose previous model if exists
      await disposeLoadedModel();

      try {
        // Show loading indicator
        setIsLoading(true);
        setLoadingProgress(0);
        setShowProgress(false);

        const startTime = Date.now();
        let progressEventCount = 0;

        console.log('Starting ImportMeshAsync...');

        // Split path into root and filename for proper loading
        const pathParts = modelPath.split('/');
        const filename = pathParts.pop() || '';
        const rootPath = pathParts.join('/') + '/';

        console.log(`Loading from: root="${rootPath}", file="${filename}"`);

        // Load the GLB file from path
        const result = await SceneLoader.ImportMeshAsync(
          '',
          rootPath,
          filename,
          sceneRef.current,
          (evt) => {
            progressEventCount++;

            if (evt.lengthComputable && evt.total > 0) {
              const progress = (evt.loaded * 100) / evt.total;
              console.log(`Loading progress: ${progress.toFixed(1)}% (${evt.loaded}/${evt.total} bytes)`);

              if (progressEventCount > 1 || progress < 100) {
                setShowProgress(true);
                setLoadingProgress(Math.round(progress));
              }
            } else {
              console.log('Progress event (not computable):', evt);
            }
          },
          '.glb'
        );

        console.log('ImportMeshAsync completed!');
        console.log('Loaded meshes:', result.meshes.length);

        // Store loaded meshes
        setLoadedModel(result.meshes);
        setCurrentModelName(modelName);
        console.log('Model state updated');

        // === APPLY REALISTIC MATERIALS ===
        console.log('=== APPLYING REALISTIC MATERIALS ===');
        const matLib = new MaterialLibrary(sceneRef.current);
        const materialStats = matLib.applyToMeshes(result.meshes as Mesh[], 1.0);
        console.log(`Material application complete: ${materialStats.replaced}/${materialStats.total} materials replaced`);

        // === INSTANCING DIAGNOSTICS ===
        console.log('=== INSTANCING DIAGNOSTICS ===');
        let instancedMeshCount = 0;
        let totalInstanceCount = 0;
        console.log('Checking first 10 meshes for instancing:');
        result.meshes.slice(0, 10).forEach((mesh, i) => {
          if (mesh instanceof Mesh) {
            const hasInstances = mesh.instances && mesh.instances.length > 0;
            if (hasInstances) {
              instancedMeshCount++;
              totalInstanceCount += mesh.instances.length;
            }
            console.log(`  Mesh ${i}: ${mesh.name}`);
            console.log(`    Instances: ${mesh.instances?.length || 0}`);
            console.log(`    Material: ${mesh.material?.name || 'none'}`);
            console.log(`    Vertices: ${mesh.getTotalVertices()}`);
            console.log(`    Visible: ${mesh.isVisible}`);
          }
        });
        console.log(`Total meshes with instances: ${instancedMeshCount}`);
        console.log(`Total instance count (first 10): ${totalInstanceCount}`);
        console.log('=== END DIAGNOSTICS ===');

        // Center model at origin (fix for IFC files with real-world coordinates)
        const { min, max } = calculateBoundingBox(result.meshes);
        const { center, maxDim } = getBoundingBoxInfo(min, max);

        // Check if model is far from origin (coordinates > 1000 units away)
        const distanceFromOrigin = Math.sqrt(center.x * center.x + center.y * center.y + center.z * center.z);
        const relativeDistance = maxDim > 0 ? distanceFromOrigin / maxDim : distanceFromOrigin;

        console.log('=== CENTERING DIAGNOSTIC ===');
        console.log(`Bounding box: min=(${min.x.toFixed(2)}, ${min.y.toFixed(2)}, ${min.z.toFixed(2)})`);
        console.log(`Bounding box: max=(${max.x.toFixed(2)}, ${max.y.toFixed(2)}, ${max.z.toFixed(2)})`);
        console.log(`Center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);
        console.log(`Distance from origin: ${distanceFromOrigin.toFixed(2)} units`);
        console.log(`Relative distance: ${relativeDistance.toFixed(2)}x model size`);
        console.log(`Max dimension: ${maxDim.toFixed(2)} units`);

        // Center if far from origin (helps with WebGL precision issues)
        if (distanceFromOrigin > 1000) {
          console.log(`Model far from origin (${distanceFromOrigin.toFixed(2)} units). Centering at origin...`);
          console.log(`Original center: (${center.x.toFixed(2)}, ${center.y.toFixed(2)}, ${center.z.toFixed(2)})`);

          // FIXED: Move ALL meshes by the offset, not just "root" nodes
          // This handles complex hierarchies where transforms are baked into world matrices
          const offset = center.negate();

          console.log(`Moving ALL ${result.meshes.length} meshes by offset: (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);

          // Move EVERY mesh directly (including instances)
          result.meshes.forEach((mesh) => {
            // Get world position before moving
            const worldPosBefore = mesh.getAbsolutePosition().clone();

            // Move the mesh in world space
            mesh.position.addInPlace(offset);

            // If it's a Mesh with instances, move instances too
            if (mesh instanceof Mesh && mesh.instances && mesh.instances.length > 0) {
              mesh.instances.forEach(instance => {
                instance.position.addInPlace(offset);
              });
            }
          });

          // Force world matrix and bounding info update for ALL meshes
          console.log('Computing world matrices and bounding info for all meshes...');
          result.meshes.forEach((mesh) => {
            if (mesh instanceof Mesh) {
              // Force world matrix update
              mesh.computeWorldMatrix(true);
              // Force bounding info to recompute with new world matrix
              const boundingInfo = mesh.getBoundingInfo();
              boundingInfo.update(mesh._worldMatrix);
            }
          });

          console.log(`Model centered at origin with offset: (${offset.x.toFixed(2)}, ${offset.y.toFixed(2)}, ${offset.z.toFixed(2)})`);

          // Debug: Log first few mesh positions and vertex counts
          console.log('Debug: First 5 meshes after centering:');
          result.meshes.slice(0, 5).forEach((mesh, i) => {
            const worldPos = mesh.getAbsolutePosition();
            console.log(`  Mesh ${i}: ${mesh.name}, worldPos=(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)}, ${worldPos.z.toFixed(2)}), vertices=${mesh.getTotalVertices()}, visible=${mesh.isVisible}, enabled=${mesh.isEnabled()}`);
          });
        }

        // Enable shadows for loaded meshes
        let shadowCount = 0;
        result.meshes.forEach((mesh) => {
          if (mesh instanceof Mesh && shadowGeneratorRef.current) {
            shadowGeneratorRef.current.addShadowCaster(mesh);
            shadowCount++;
          }
        });
        console.log(`Shadows enabled for ${shadowCount} meshes`);

        // Frame the loaded model - wait for scene to be ready first
        console.log('Waiting for scene to be ready before framing...');
        sceneRef.current.executeWhenReady(() => {
          console.log('Scene ready, framing model...');
          fitToView(result.meshes);
        });

        // Apply performance optimizations
        console.log('Applying performance optimizations...');

        // Freeze all meshes (static models don't need transform updates)
        console.log('Freezing meshes...');
        let frozenCount = 0;
        result.meshes.forEach((mesh) => {
          if (mesh instanceof Mesh) {
            mesh.freezeWorldMatrix();
            frozenCount++;
          }
        });
        console.log(`Frozen ${frozenCount} meshes`);

        // Start Scene Optimizer if enabled
        if (optimizerEnabled) {
          startSceneOptimizer();
        }

        // Calculate and store load time
        const elapsedTime = Date.now() - startTime;
        setLoadTime(elapsedTime / 1000);
        console.log(`Total load time: ${(elapsedTime / 1000).toFixed(2)}s`);

        const minDisplayTime = 500;
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

        await new Promise((resolve) => setTimeout(resolve, remainingTime));

        // Hide loading indicator
        setIsLoading(false);
        setLoadingProgress(0);
        setShowProgress(false);

        console.log('=== LOAD COMPLETE ===');
      } catch (error) {
        console.error('=== ERROR LOADING GLB ===');
        console.error('Error details:', error);
        alert('Error loading model: ' + (error as Error).message);
        setIsLoading(false);
        setLoadingProgress(0);
        setShowProgress(false);
      }
    },
    [loadedModel, fitToView, optimizerEnabled, startSceneOptimizer, disposeLoadedModel]
  );

  // Expose loadModelFromPath to window for console access (development only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).loadModel = loadModelFromPath;
      console.log('💡 loadModel() function exposed to window');
      console.log('   Usage: loadModel("public/models/your-model.glb", "Model Name")');
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).loadModel;
      }
    };
  }, [loadModelFromPath]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    preventDragDefaults(e);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    preventDragDefaults(e);
    setIsDragging(false);
  }, []);

  return (
    <div
      style={styles.container(width, height)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <canvas ref={canvasRef} style={{
        ...styles.canvas(),
        // Force canvas to background layer
        position: 'absolute',
        top: 0,
        left: 0,
        zIndex: 0,
        // Completely remove WebGPU canvas from rendering when no model loaded
        display: (engineType === 'WebGPU' && !loadedModel) ? 'none' : 'block',
      }} />

      {/* Toolbar */}
      {showUI && <div style={styles.toolbar()}>
        {/* Toggle buttons row */}
        <div style={styles.toolbarRow()}>
          <button
            onClick={toggleGrid}
            style={styles.toolbarButton(showGrid)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(
                e.currentTarget.style,
                styles.toolbarButtonNormal(showGrid)
              );
            }}
            title={VIEWER_CONFIG.text.toolbar.grid}
          >
            ⊞
          </button>
          <button
            onClick={toggleAxes}
            style={styles.toolbarButton(showAxes)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(
                e.currentTarget.style,
                styles.toolbarButtonNormal(showAxes)
              );
            }}
            title={VIEWER_CONFIG.text.toolbar.axes}
          >
            ⚹
          </button>
          <button
            onClick={toggleGizmo}
            style={styles.toolbarButton(showGizmo)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(
                e.currentTarget.style,
                styles.toolbarButtonNormal(showGizmo)
              );
            }}
            title={VIEWER_CONFIG.text.toolbar.gizmo}
            disabled={!loadedModel}
          >
            ⟲
          </button>
          <button
            onClick={toggleOptimizer}
            style={styles.toolbarButton(optimizerEnabled)}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(
                e.currentTarget.style,
                styles.toolbarButtonNormal(optimizerEnabled)
              );
            }}
            title={`Scene Optimizer (${optimizerEnabled ? 'ON' : 'OFF'}): Auto-adjust quality for 30 FPS`}
          >
            ⚡
          </button>
        </div>

        {/* Camera view buttons row 1 */}
        <div style={styles.toolbarRow()}>
          <button
            onClick={() => setCameraView('top')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonNormal());
            }}
            title={VIEWER_CONFIG.text.toolbar.top}
          >
            ↑
          </button>
          <button
            onClick={() => setCameraView('front')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonNormal());
            }}
            title={VIEWER_CONFIG.text.toolbar.front}
          >
            F
          </button>
        </div>

        {/* Camera view buttons row 2 */}
        <div style={styles.toolbarRow()}>
          <button
            onClick={() => setCameraView('left')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonNormal());
            }}
            title={VIEWER_CONFIG.text.toolbar.left}
          >
            L
          </button>
          <button
            onClick={() => setCameraView('right')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonNormal());
            }}
            title={VIEWER_CONFIG.text.toolbar.right}
          >
            R
          </button>
        </div>

        {/* Camera view buttons row 3 */}
        <div style={styles.toolbarRow()}>
          <button
            onClick={() => setCameraView('bottom')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonNormal());
            }}
            title={VIEWER_CONFIG.text.toolbar.bottom}
          >
            ↓
          </button>
          <button
            onClick={() => setCameraView('back')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonHover);
            }}
            onMouseLeave={(e) => {
              Object.assign(e.currentTarget.style, styles.toolbarButtonNormal());
            }}
            title={VIEWER_CONFIG.text.toolbar.back}
          >
            B
          </button>
        </div>
      </div>}


      {/* Loading Indicator */}
      {isLoading && (
        <div style={styles.loadingOverlay()}>
          <div style={styles.loadingContent()}>
            <div style={styles.loadingSpinner()}></div>
            <div style={styles.loadingText()}>
              {VIEWER_CONFIG.text.loading.title}
            </div>
            <div style={styles.loadingSubtext()}>
              {VIEWER_CONFIG.text.loading.subtitle}
            </div>
            {showProgress && (
              <>
                <div style={styles.progressText()}>{loadingProgress}%</div>
                <div style={styles.progressBarContainer()}>
                  <div style={styles.progressBar(loadingProgress)}></div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isDragging && (
        <div style={styles.dragOverlay()}>
          <div style={styles.dragOverlayText()}>
            {VIEWER_CONFIG.text.dropPrompt}
          </div>
        </div>
      )}

      {!loadedModel && !isDragging && (() => {
        console.log('🎨 RENDERING EMPTY STATE:', { isEngineReady, loadedModel: !!loadedModel, isDragging });
        return (
          <div style={styles.emptyState()}>
            {!isEngineReady ? (
              <>
                <div style={styles.emptyStateEmoji()}>⚙️</div>
                <div style={styles.emptyStateTitle()}>Initializing Viewer...</div>
                <div style={styles.emptyStateSubtitle()}>
                  Detecting WebGPU/WebGL support
                </div>
              </>
            ) : (
              <>
                <div style={styles.emptyStateEmoji()}>
                  {VIEWER_CONFIG.text.emptyState.emoji}
                </div>
                <div style={styles.emptyStateTitle()}>
                  {VIEWER_CONFIG.text.emptyState.title}
                </div>
                <div style={styles.emptyStateSubtitle()}>
                  {VIEWER_CONFIG.text.emptyState.subtitle}
                </div>
              </>
            )}
          </div>
        );
      })()}

      {loadedModel && showUI && (
        <button
          onClick={() => fitToView()}
          style={styles.button()}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, styles.buttonHover);
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, styles.buttonNormal);
          }}
        >
          {VIEWER_CONFIG.text.fitToViewButton}
        </button>
      )}

      {/* Toggle UI Button */}
      {loadedModel && (
        <button
          onClick={() => setShowUI(!showUI)}
          style={{
            position: 'absolute',
            top: '10px',
            right: '80px',
            padding: '6px 12px',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s ease',
            zIndex: 100,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          title="Toggle UI visibility"
        >
          {showUI ? 'UI' : 'UI'}
        </button>
      )}

      {/* Inspector Toggle Button */}
      {loadedModel && (
        <button
          onClick={() => {
            if (Inspector.IsVisible) {
              Inspector.Hide();
            } else {
              Inspector.Show(sceneRef.current!, {});
            }
          }}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            padding: '6px 12px',
            backgroundColor: 'rgba(59, 130, 246, 0.9)',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s ease',
            zIndex: 1001,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 1)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.9)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
          title="Toggle Babylon.js Inspector"
        >
          Insp
        </button>
      )}

      {/* Performance Monitor */}
      {showPerformanceMonitor && loadedModel && showUI && (
        <PerformanceMonitor
          scene={sceneRef.current}
          engine={engineRef.current}
          instrumentation={instrumentationRef.current}
          loadTime={loadTime}
          loadTimingBreakdown={loadTimingBreakdown}
          engineType={engineType}
          isFallback={isEngineFallback}
        />
      )}

      {/* Selection Info Panel */}
      {selectedMesh && showUI && (
        <div style={{
          position: 'fixed',
          top: '10px',
          left: '10px',
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          padding: '15px',
          borderRadius: '6px',
          fontFamily: 'monospace',
          fontSize: '12px',
          color: '#fff',
          zIndex: 1000,
          minWidth: '250px',
          backdropFilter: 'blur(4px)',
          border: '2px solid #4ade80',
        }}>
          <div style={{
            fontWeight: 'bold',
            marginBottom: '10px',
            fontSize: '13px',
            borderBottom: '1px solid rgba(74, 222, 128, 0.3)',
            paddingBottom: '6px',
            color: '#4ade80',
          }}>
            Selected Element
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.7 }}>Name:</span>
              <span style={{ fontWeight: 'bold' }}>{selectedMesh.name}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.7 }}>ID:</span>
              <span style={{ fontWeight: 'bold' }}>{selectedMesh.id || 'N/A'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ opacity: 0.7 }}>Vertices:</span>
              <span style={{ fontWeight: 'bold' }}>{selectedMesh.getTotalVertices().toLocaleString()}</span>
            </div>
            {selectedMesh instanceof Mesh && selectedMesh.material && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ opacity: 0.7 }}>Material:</span>
                <span style={{ fontWeight: 'bold' }}>{selectedMesh.material.name || 'Unnamed'}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => setSelectedMesh(null)}
            style={{
              marginTop: '12px',
              padding: '6px 12px',
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              width: '100%',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#dc2626';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ef4444';
            }}
          >
            Deselect (ESC)
          </button>
        </div>
      )}
    </div>
  );
};
