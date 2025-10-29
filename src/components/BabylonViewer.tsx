import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Engine,
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

interface BabylonViewerProps {
  width?: string;
  height?: string;
  enableInspector?: boolean;
  showPerformanceMonitor?: boolean;
}

export const BabylonViewer: React.FC<BabylonViewerProps> = ({
  width = '100%',
  height = '100vh',
  enableInspector = false,
  showPerformanceMonitor = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
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
  const [currentModelName, setCurrentModelName] = useState<string>('');
  const [optimizerEnabled, setOptimizerEnabled] = useState(true);
  const [selectedMesh, setSelectedMesh] = useState<AbstractMesh | null>(null);
  const [showUI, setShowUI] = useState(true);
  const highlightLayerRef = useRef<HighlightLayer | null>(null);

  // Initialize Babylon.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Create engine
    const engine = new Engine(canvasRef.current, true, VIEWER_CONFIG.engine);
    engineRef.current = engine;

    // Create scene
    const scene = new Scene(engine);
    scene.clearColor = VIEWER_CONFIG.scene.clearColor;
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

    // Store scene ref for inspector toggle
    sceneRef.current = scene;

    // Render loop
    engine.runRenderLoop(() => {
      scene.render();
    });

    // Handle window resize
    const handleResize = () => {
      engine.resize();
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
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

      if (!sceneRef.current) {
        console.error('Scene not initialized');
        return;
      }

      console.log('Scene is ready, starting load...');

      // Remove previously loaded model
      if (loadedModel) {
        console.log('Disposing previous model...');
        loadedModel.forEach((mesh) => mesh.dispose());
        setLoadedModel(null);
      }

      try {
        // Create object URL from file
        const url = URL.createObjectURL(file);
        console.log('Object URL created:', url);

        // Show loading indicator
        setIsLoading(true);
        setLoadingProgress(0);
        setShowProgress(false);

        const startTime = Date.now();
        let progressEventCount = 0;

        console.log('Starting ImportMeshAsync...');

        // Load the GLB file with real progress tracking
        const result = await SceneLoader.ImportMeshAsync(
          '',
          url,
          '',
          sceneRef.current,
          (evt) => {
            progressEventCount++;

            if (evt.lengthComputable && evt.total > 0) {
              const progress = (evt.loaded * 100) / evt.total;
              console.log(`Loading progress: ${progress.toFixed(1)}% (${evt.loaded}/${evt.total} bytes)`);

              // Only show progress if we're getting meaningful updates (not jumping straight to 100%)
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
        console.log('Mesh names:', result.meshes.map(m => m.name));

        // Clean up object URL
        URL.revokeObjectURL(url);

        // Store loaded meshes
        setLoadedModel(result.meshes);
        console.log('Model state updated');

        // Enable shadows for loaded meshes
        let shadowCount = 0;
        result.meshes.forEach((mesh) => {
          if (mesh instanceof Mesh && shadowGeneratorRef.current) {
            shadowGeneratorRef.current.addShadowCaster(mesh);
            shadowCount++;
          }
        });
        console.log(`Shadows enabled for ${shadowCount} meshes`);

        // Frame the loaded model
        console.log('Framing model...');
        fitToView(result.meshes);

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
    [loadedModel, fitToView, optimizerEnabled, startSceneOptimizer]
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

      // Remove previously loaded model
      if (loadedModel) {
        console.log('Disposing previous model...');
        loadedModel.forEach((mesh) => mesh.dispose());
        setLoadedModel(null);
      }

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

        // Frame the loaded model
        console.log('Framing model...');
        fitToView(result.meshes);

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
    [loadedModel, fitToView, optimizerEnabled, startSceneOptimizer]
  );

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
      <canvas ref={canvasRef} style={styles.canvas()} />

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

      {/* Compression Level Selector */}
      {showUI && <div
        style={{
          position: 'absolute',
          bottom: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(30, 30, 30, 0.9)',
          padding: '15px 20px',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 1000,
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: '12px',
            fontWeight: 'bold',
            marginBottom: '5px',
            textAlign: 'center',
          }}
        >
          Compression Test Models {currentModelName && `(${currentModelName})`}
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() =>
              loadModelFromPath('/models/baseline.glb', 'Baseline 38MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Baseline 38MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Baseline 38MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Baseline 38MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
          >
            Baseline (38MB)
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/compressed_level1_low.glb', 'Level 1 Low 2.3MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Level 1 Low 2.3MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Level 1 Low 2.3MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Level 1 Low 2.3MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
          >
            Level 1 (2.3MB) 16x
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/compressed_level2_medium.glb', 'Level 2 Med 2.2MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Level 2 Med 2.2MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Level 2 Med 2.2MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Level 2 Med 2.2MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
          >
            Level 2 (2.2MB) 17x
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/compressed_level3_high.glb', 'Level 3 High 425KB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Level 3 High 425KB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Level 3 High 425KB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Level 3 High 425KB') {
                e.currentTarget.style.background = '#555';
              }
            }}
          >
            Level 3 (425KB) 90x
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/compressed_level2_instanced.glb', 'Level 2 Instanced 2.4MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Level 2 Instanced 2.4MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Level 2 Instanced 2.4MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Level 2 Instanced 2.4MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="GPU Instancing enabled - reduced draw calls"
          >
            L2 + Instancing (2.4MB)
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/compressed_level2_instanced_selectable.glb', 'Level 2 Inst+Select 1.84MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Level 2 Inst+Select 1.84MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Level 2 Inst+Select 1.84MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Level 2 Inst+Select 1.84MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="GPU Instancing + Individual Element Selection (no mesh joining)"
          >
            L2 Inst+Select (1.84MB)
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/bilton_final_instanced.glb', 'Bilton Instanced 23MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Bilton Instanced 23MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Bilton Instanced 23MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Bilton Instanced 23MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="Original instanced model with auto-centering: 2597 batches, 29081 instances"
          >
            Bilton Inst (23MB)
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/bilton_final_centered.glb', 'Bilton Centered 56MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Bilton Centered 56MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Bilton Centered 56MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Bilton Centered 56MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="Centered at origin (instancing may be lost): 56 MB"
          >
            Bilton Centered (56MB)
          </button>
        </div>

        {/* Bilton Compression Test Row */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '8px',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: '11px', color: '#aaa', alignSelf: 'center', marginRight: '8px' }}>
            Bilton Tests:
          </div>
          <button
            onClick={() =>
              loadModelFromPath('/models/bilton_baseline.glb', 'Bilton Baseline 630MB')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Bilton Baseline 630MB' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Bilton Baseline 630MB') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Bilton Baseline 630MB') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="Uncompressed GLB from IFC - no gltfpack"
          >
            Baseline (630MB)
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/bilton_level1.glb', 'Bilton L1')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Bilton L1' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Bilton L1') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Bilton L1') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="Light compression: gltfpack -c"
          >
            L1 Light
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/bilton_level2.glb', 'Bilton L2')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Bilton L2' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Bilton L2') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Bilton L2') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="Medium compression: gltfpack -cc (34 MB)"
          >
            L2 Medium
          </button>
          <button
            onClick={() =>
              loadModelFromPath('/models/bilton_level3.glb', 'Bilton L3')
            }
            style={{
              padding: '8px 16px',
              background: currentModelName === 'Bilton L3' ? '#4CAF50' : '#555',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '11px',
              fontWeight: '500',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              if (currentModelName !== 'Bilton L3') {
                e.currentTarget.style.background = '#666';
              }
            }}
            onMouseLeave={(e) => {
              if (currentModelName !== 'Bilton L3') {
                e.currentTarget.style.background = '#555';
              }
            }}
            title="Heavy compression: gltfpack -cc -kn"
          >
            L3 Heavy
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

      {!loadedModel && !isDragging && (
        <div style={styles.emptyState()}>
          <div style={styles.emptyStateEmoji()}>
            {VIEWER_CONFIG.text.emptyState.emoji}
          </div>
          <div style={styles.emptyStateTitle()}>
            {VIEWER_CONFIG.text.emptyState.title}
          </div>
          <div style={styles.emptyStateSubtitle()}>
            {VIEWER_CONFIG.text.emptyState.subtitle}
          </div>
        </div>
      )}

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
