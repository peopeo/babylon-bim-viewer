import { useEffect, useRef, useState, useCallback } from 'react';
import {
  AbstractMesh,
  Mesh,
  Color3,
  Color4,
  AxesViewer,
  SceneOptimizer,
  SceneOptimizerOptions,
  HardwareScalingOptimization,
  TextureOptimization,
  ShadowsOptimization,
  PostProcessesOptimization,
} from '@babylonjs/core';
import { Inspector } from '@babylonjs/inspector';

import { IEngine, SceneContext, ModelSource, LoadedModel } from '../core/interfaces';
import {
  EngineFactory,
  SceneManager,
  SceneFactory,
  ModelLoaderFactory,
  CameraController,
  ResourceDisposer,
} from '../services';
import { VIEWER_CONFIG } from '../config/viewer.config';
import { styles } from './BabylonViewer.styles';
import {
  preventDragDefaults,
  isValidFileExtension,
  calculateBoundingBox,
  getBoundingBoxInfo,
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

export const BabylonViewer: React.FC<BabylonViewerProps> = ({
  width = '100%',
  height = '100vh',
  enableInspector = false,
  showPerformanceMonitor = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Service refs
  const engineRef = useRef<IEngine | null>(null);
  const sceneManagerRef = useRef<SceneManager | null>(null);
  const sceneContextRef = useRef<SceneContext | null>(null);
  const cameraControllerRef = useRef<CameraController | null>(null);
  const resourceDisposerRef = useRef<ResourceDisposer | null>(null);
  const sceneOptimizerRef = useRef<SceneOptimizer | null>(null);

  // UI State
  const [isDragging, setIsDragging] = useState(false);
  const [loadedModel, setLoadedModel] = useState<AbstractMesh[] | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showAxes, setShowAxes] = useState(true);
  const [showGizmo, setShowGizmo] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMesh, setSelectedMesh] = useState<AbstractMesh | null>(null);
  const [showUI, setShowUI] = useState(true);
  const [optimizerEnabled, setOptimizerEnabled] = useState(true);

  // Engine State
  const [engineType, setEngineType] = useState<'WebGPU' | 'WebGL'>('WebGL');
  const [isEngineFallback, setIsEngineFallback] = useState(false);
  const [isEngineReady, setIsEngineReady] = useState(false);

  // Performance State
  const [loadTime, setLoadTime] = useState<number | undefined>(undefined);
  const [loadTimingBreakdown, setLoadTimingBreakdown] = useState<LoadTimingBreakdown | undefined>(undefined);

  /**
   * Initialize Engine and Scene using services
   */
  useEffect(() => {
    if (!canvasRef.current) return;

    let isMounted = true;

    const initializeViewer = async () => {
      if (!canvasRef.current) return;

      console.log('=== INITIALIZING VIEWER ===');

      try {
        // Create engine using factory
        const engine = await EngineFactory.create(canvasRef.current, {
          preferWebGPU: VIEWER_CONFIG.engine.preferWebGPU,
        });

        if (!isMounted) {
          engine.dispose();
          return;
        }

        engineRef.current = engine;
        setEngineType(engine.type);
        setIsEngineFallback(engine.isFallback);

        // Create scene using manager
        const sceneManager = new SceneManager();
        const sceneContext = await sceneManager.initialize(engine, canvasRef.current);

        sceneManagerRef.current = sceneManager;
        sceneContextRef.current = sceneContext;

        // Create camera controller
        cameraControllerRef.current = new CameraController(sceneContext.camera);

        // Create resource disposer
        resourceDisposerRef.current = new ResourceDisposer(
          sceneContext.scene,
          sceneContext.shadowGenerator,
          engine.type
        );

        // Setup mesh selection
        sceneContext.scene.onPointerDown = (evt, pickResult) => {
          if (evt.button !== 0) return;

          if (pickResult.hit && pickResult.pickedMesh) {
            const mesh = pickResult.pickedMesh;
            if (mesh === sceneContext.ground || mesh.name.includes('axes')) {
              return;
            }
            setSelectedMesh(mesh);
          } else {
            setSelectedMesh(null);
          }
        };

        // Enable inspector if requested
        if (enableInspector) {
          Inspector.Show(sceneContext.scene, {});
        }

        // Mark ready
        setIsEngineReady(true);
        console.log('✓ Viewer initialized successfully');

        // Start render loop
        engine.startRenderLoop(() => {
          sceneContext.scene.render();
        });

        // Handle window resize
        const handleResize = () => engine.resize();
        window.addEventListener('resize', handleResize);

        return () => {
          window.removeEventListener('resize', handleResize);

          if (Inspector.IsVisible) {
            try {
              Inspector.Hide();
            } catch (e) {
              console.warn('Inspector cleanup warning (safe to ignore):', e);
            }
          }

          sceneManager.dispose();
          engine.dispose();
        };
      } catch (error) {
        console.error('Failed to initialize viewer:', error);
      }
    };

    let cleanup: (() => void) | undefined;
    initializeViewer().then((cleanupFn) => {
      if (isMounted && cleanupFn) {
        cleanup = cleanupFn;
      }
    });

    return () => {
      isMounted = false;
      setIsEngineReady(false);
      if (cleanup) {
        cleanup();
      }
    };
  }, [enableInspector]);

  /**
   * Handle mesh selection highlighting
   */
  useEffect(() => {
    const highlightLayer = sceneContextRef.current?.highlightLayer;
    if (!highlightLayer) return;

    highlightLayer.removeAllMeshes();

    if (selectedMesh && selectedMesh instanceof Mesh) {
      highlightLayer.addMesh(selectedMesh, Color3.Green());
    }
  }, [selectedMesh]);

  /**
   * Handle ESC key to deselect
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && selectedMesh) {
        setSelectedMesh(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedMesh]);

  /**
   * Load model from source using services
   */
  const loadModel = useCallback(async (source: ModelSource) => {
    if (!sceneContextRef.current || !cameraControllerRef.current || !resourceDisposerRef.current) {
      console.error('Viewer not initialized');
      return;
    }

    console.log('=== LOADING MODEL ===');
    const startTime = performance.now();

    try {
      // Dispose previous model
      if (loadedModel) {
        await resourceDisposerRef.current.disposeModel(loadedModel, sceneOptimizerRef.current);
        setLoadedModel(null);
        setSelectedMesh(null);
      }

      setIsLoading(true);

      // Apply browser-specific optimizations BEFORE loading
      const isChrome = /Chrome/.test(navigator.userAgent) && /Google Inc/.test(navigator.vendor);
      SceneFactory.applyBrowserOptimizations(sceneContextRef.current.scene, isChrome);

      // Create loader
      const loader = ModelLoaderFactory.create(
        source,
        sceneContextRef.current.scene,
        sceneContextRef.current.shadowGenerator,
        sceneContextRef.current.camera
      );

      // Load model with auto-centering and auto-framing
      const result: LoadedModel = await loader.load(source, {
        applyMaterials: false, // We'll use MaterialLibrary instead
        enableShadows: true,
        freezeMeshes: true,
        centerAtOrigin: true, // Always center for consistent framing
        fitToView: true, // Auto-frame after centering
      });

      // Apply realistic materials using MaterialLibrary
      const matLib = new MaterialLibrary(sceneContextRef.current.scene);
      matLib.applyToMeshes(result.meshes as Mesh[], 1.0);

      // Wait for scene to be ready before optimizations
      sceneContextRef.current.scene.executeWhenReady(() => {
        // Restore scene optimizations after load
        SceneFactory.restoreOptimizations(sceneContextRef.current!.scene);

        // Start optimizer if enabled
        if (optimizerEnabled) {
          startSceneOptimizer();
        }
      });

      setLoadedModel(result.meshes);

      const totalTime = (performance.now() - startTime) / 1000;
      setLoadTime(totalTime);

      // Set timing breakdown for performance monitor
      setLoadTimingBreakdown({
        importTime: result.timing.babylonLoad / 1000,
        materialsTime: result.timing.materialSetup / 1000,
        shadowsTime: result.timing.shadowSetup / 1000,
        freezeTime: result.timing.optimization / 1000,
        sceneReadyTime: 0, // We don't track this separately anymore
        totalTime: result.timing.total / 1000,
      });

      // Log detailed timing breakdown
      console.log(`✓ Model loaded in ${totalTime.toFixed(2)}s`);
      console.log('=== LOAD TIMING BREAKDOWN ===');
      console.log(`  Babylon.js Load: ${(result.timing.babylonLoad / 1000).toFixed(3)}s`);
      console.log(`  Material Setup:  ${(result.timing.materialSetup / 1000).toFixed(3)}s`);
      console.log(`  Shadow Setup:    ${(result.timing.shadowSetup / 1000).toFixed(3)}s`);
      console.log(`  Bounding Box:    ${(result.timing.boundingBox / 1000).toFixed(3)}s`);
      console.log(`  Optimization:    ${(result.timing.optimization / 1000).toFixed(3)}s`);
      console.log(`  Total:           ${(result.timing.total / 1000).toFixed(3)}s`);
      console.log('=== MODEL STATS ===');
      console.log(`  Meshes:   ${result.stats.meshCount}`);
      console.log(`  Vertices: ${result.stats.vertexCount.toLocaleString()}`);
      console.log(`  Faces:    ${result.stats.faceCount.toLocaleString()}`);
    } catch (error) {
      console.error('Error loading model:', error);
      alert('Error loading model: ' + (error as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [loadedModel, optimizerEnabled]);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    // Immediately hide drag overlay
    setIsDragging(false);

    preventDragDefaults(e);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!isValidFileExtension(file.name, VIEWER_CONFIG.modelLoading.acceptedExtension)) {
      alert('Invalid file type. Please drop a .glb file.');
      return;
    }

    if (!isEngineReady) {
      alert('Please wait for the viewer to finish initializing...');
      return;
    }

    await loadModel({ type: 'file', file });
  }, [isEngineReady, loadModel]);

  /**
   * UI Control Handlers
   */
  const toggleGrid = useCallback(() => {
    if (sceneContextRef.current?.ground) {
      sceneContextRef.current.ground.isVisible = !showGrid;
      setShowGrid(!showGrid);
    }
  }, [showGrid]);

  const toggleAxes = useCallback(() => {
    if (!sceneContextRef.current) return;

    const newShowAxes = !showAxes;
    setShowAxes(newShowAxes);

    if (sceneContextRef.current.axesViewer) {
      sceneContextRef.current.axesViewer.dispose();
      sceneContextRef.current.axesViewer = null;
    }

    if (newShowAxes) {
      sceneContextRef.current.axesViewer = new AxesViewer(
        sceneContextRef.current.scene,
        VIEWER_CONFIG.axes.size
      );
    }
  }, [showAxes]);

  const toggleGizmo = useCallback(() => {
    if (!sceneContextRef.current?.gizmoManager || !loadedModel || loadedModel.length === 0) return;

    const newShowGizmo = !showGizmo;
    setShowGizmo(newShowGizmo);

    const gizmoManager = sceneContextRef.current.gizmoManager;

    if (newShowGizmo) {
      const targetMesh = loadedModel.find((mesh) => mesh.getTotalVertices() > 0) || loadedModel[0];
      if (targetMesh) {
        gizmoManager.attachToMesh(targetMesh);
        gizmoManager.positionGizmoEnabled = true;
        gizmoManager.rotationGizmoEnabled = true;
        gizmoManager.scaleGizmoEnabled = true;
      }
    } else {
      gizmoManager.positionGizmoEnabled = false;
      gizmoManager.rotationGizmoEnabled = false;
      gizmoManager.scaleGizmoEnabled = false;
      gizmoManager.attachToMesh(null);
    }
  }, [showGizmo, loadedModel]);

  const setCameraView = useCallback((view: 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right') => {
    if (!cameraControllerRef.current) return;

    const camera = sceneContextRef.current?.camera;
    if (!camera) return;

    const viewMap = {
      top: { alpha: 0, beta: 0 },
      bottom: { alpha: 0, beta: Math.PI },
      front: { alpha: 0, beta: Math.PI / 2 },
      back: { alpha: Math.PI, beta: Math.PI / 2 },
      left: { alpha: -Math.PI / 2, beta: Math.PI / 2 },
      right: { alpha: Math.PI / 2, beta: Math.PI / 2 },
    };

    const { alpha, beta } = viewMap[view];
    cameraControllerRef.current.setPosition(alpha, beta, camera.radius);
  }, []);

  const fitToView = useCallback(() => {
    if (!loadedModel || !sceneContextRef.current || !cameraControllerRef.current) return;

    const { min, max } = calculateBoundingBox(loadedModel);
    const { center } = getBoundingBoxInfo(min, max);

    const stats = {
      meshCount: loadedModel.length,
      vertexCount: 0,
      faceCount: 0,
      materialCount: 0,
      textureCount: 0,
      boundingBox: {
        min,
        max,
        size: max.subtract(min),
        center,
      },
    };

    cameraControllerRef.current.fitToView(stats);
  }, [loadedModel]);

  const startSceneOptimizer = useCallback(() => {
    if (!sceneContextRef.current?.scene) return;

    if (sceneOptimizerRef.current) {
      sceneOptimizerRef.current.stop();
      sceneOptimizerRef.current.dispose();
      sceneOptimizerRef.current = null;
    }

    const options = new SceneOptimizerOptions(30, 2000);
    options.addOptimization(new HardwareScalingOptimization(0, 2));
    options.addOptimization(new ShadowsOptimization(1));
    options.addOptimization(new PostProcessesOptimization(2));
    options.addOptimization(new TextureOptimization(3, 512));

    const optimizer = SceneOptimizer.OptimizeAsync(sceneContextRef.current.scene, options);
    sceneOptimizerRef.current = optimizer;
    console.log('SceneOptimizer started');
  }, []);

  const stopSceneOptimizer = useCallback(() => {
    if (sceneOptimizerRef.current) {
      sceneOptimizerRef.current.stop();
      sceneOptimizerRef.current.dispose();
      sceneOptimizerRef.current = null;

      if (engineRef.current) {
        engineRef.current.setHardwareScalingLevel(1);
      }
    }
  }, []);

  const toggleOptimizer = useCallback(() => {
    const newState = !optimizerEnabled;
    setOptimizerEnabled(newState);

    if (newState) {
      startSceneOptimizer();
    } else {
      stopSceneOptimizer();
    }
  }, [optimizerEnabled, startSceneOptimizer, stopSceneOptimizer]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    preventDragDefaults(e);
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    preventDragDefaults(e);
    setIsDragging(false);
  }, []);

  /**
   * Expose loadModel to window for console debugging (development only)
   */
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).loadModel = (path: string, name: string) => {
        loadModel({ type: 'path', path, name });
      };
      console.log('💡 loadModel() function exposed to window');
      console.log('   Usage: loadModel("public/models/your-model.glb", "Model Name")');
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as any).loadModel;
      }
    };
  }, [loadModel]);

  /**
   * Make scene background transparent when no model loaded (WebGPU only)
   */
  useEffect(() => {
    if (!sceneContextRef.current?.scene) return;

    if (!loadedModel && engineType === 'WebGPU') {
      // Make scene background fully transparent to show empty state
      sceneContextRef.current.scene.clearColor = new Color4(0, 0, 0, 0);

      // Hide ground and axes
      if (sceneContextRef.current.ground) {
        sceneContextRef.current.ground.isVisible = false;
      }
      if (sceneContextRef.current.axesViewer) {
        sceneContextRef.current.axesViewer.dispose();
        sceneContextRef.current.axesViewer = null;
      }
    } else {
      // Restore normal background color
      sceneContextRef.current.scene.clearColor = VIEWER_CONFIG.scene.clearColor;

      // Restore ground and axes if they should be visible
      if (sceneContextRef.current.ground) {
        sceneContextRef.current.ground.isVisible = showGrid;
      }
      if (!sceneContextRef.current.axesViewer && showAxes) {
        sceneContextRef.current.axesViewer = new AxesViewer(
          sceneContextRef.current.scene,
          VIEWER_CONFIG.axes.size
        );
      }
    }
  }, [loadedModel, engineType, showGrid, showAxes]);

  return (
    <div
      style={styles.container(width, height)}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <canvas
        ref={canvasRef}
        style={{
          ...styles.canvas(),
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 0,
          display: (engineType === 'WebGPU' && !loadedModel) ? 'none' : 'block',
        }}
      />

      {/* Toolbar */}
      {showUI && <div style={styles.toolbar()}>
        {/* Toggle buttons row */}
        <div style={styles.toolbarRow()}>
          <button
            onClick={toggleGrid}
            style={styles.toolbarButton(showGrid)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal(showGrid))}
            title={VIEWER_CONFIG.text.toolbar.grid}
          >
            ⊞
          </button>
          <button
            onClick={toggleAxes}
            style={styles.toolbarButton(showAxes)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal(showAxes))}
            title={VIEWER_CONFIG.text.toolbar.axes}
          >
            ⚹
          </button>
          <button
            onClick={toggleGizmo}
            style={styles.toolbarButton(showGizmo)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal(showGizmo))}
            title={VIEWER_CONFIG.text.toolbar.gizmo}
            disabled={!loadedModel}
          >
            ⟲
          </button>
          <button
            onClick={toggleOptimizer}
            style={styles.toolbarButton(optimizerEnabled)}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal(optimizerEnabled))}
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
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal())}
            title={VIEWER_CONFIG.text.toolbar.top}
          >
            ↑
          </button>
          <button
            onClick={() => setCameraView('front')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal())}
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
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal())}
            title={VIEWER_CONFIG.text.toolbar.left}
          >
            L
          </button>
          <button
            onClick={() => setCameraView('right')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal())}
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
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal())}
            title={VIEWER_CONFIG.text.toolbar.bottom}
          >
            ↓
          </button>
          <button
            onClick={() => setCameraView('back')}
            style={styles.toolbarButton()}
            onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonHover)}
            onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.toolbarButtonNormal())}
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
            <div style={styles.loadingText()}>{VIEWER_CONFIG.text.loading.title}</div>
            <div style={styles.loadingSubtext()}>{VIEWER_CONFIG.text.loading.subtitle}</div>
          </div>
        </div>
      )}

      {/* Drag Overlay */}
      {isDragging && (
        <div style={styles.dragOverlay()}>
          <div style={styles.dragOverlayText()}>{VIEWER_CONFIG.text.dropPrompt}</div>
        </div>
      )}

      {/* Empty State */}
      {!loadedModel && !isDragging && !isLoading && (
        <div style={styles.emptyState()}>
          {!isEngineReady ? (
            <>
              <div style={styles.emptyStateEmoji()}>⚙️</div>
              <div style={styles.emptyStateTitle()}>Initializing Viewer...</div>
              <div style={styles.emptyStateSubtitle()}>Detecting WebGPU/WebGL support</div>
            </>
          ) : (
            <>
              <div style={styles.emptyStateEmoji()}>{VIEWER_CONFIG.text.emptyState.emoji}</div>
              <div style={styles.emptyStateTitle()}>{VIEWER_CONFIG.text.emptyState.title}</div>
              <div style={styles.emptyStateSubtitle()}>{VIEWER_CONFIG.text.emptyState.subtitle}</div>
            </>
          )}
        </div>
      )}

      {/* Fit to View Button */}
      {loadedModel && showUI && (
        <button
          onClick={fitToView}
          style={styles.button()}
          onMouseEnter={(e) => Object.assign(e.currentTarget.style, styles.buttonHover)}
          onMouseLeave={(e) => Object.assign(e.currentTarget.style, styles.buttonNormal)}
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
          UI
        </button>
      )}

      {/* Inspector Toggle Button */}
      {loadedModel && (
        <button
          onClick={() => {
            if (Inspector.IsVisible) {
              Inspector.Hide();
            } else if (sceneContextRef.current?.scene) {
              Inspector.Show(sceneContextRef.current.scene, {});
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
      {showPerformanceMonitor && loadedModel && showUI && sceneContextRef.current && (
        <PerformanceMonitor
          scene={sceneContextRef.current.scene}
          engine={engineRef.current?.getInternalEngine()}
          instrumentation={sceneContextRef.current.instrumentation}
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
