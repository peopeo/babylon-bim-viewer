import { Color3, Color4, Vector3 } from '@babylonjs/core';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * BABYLON BIM VIEWER - CENTRAL CONFIGURATION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Single source of truth for ALL viewer settings.
 * Modify values here instead of hardcoding throughout the codebase.
 *
 * Documentation Format:
 * - What: Brief description of the setting
 * - Why: Reason this value was chosen
 * - Default: What the default value is (if applicable)
 * - Impact: Performance or behavior impact
 * - Browser: Browser-specific notes (if applicable)
 */

export const VIEWER_CONFIG = {
  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  engine: {
    /**
     * Prefer WebGPU over WebGL when available
     *
     * What: Attempts to use WebGPU first, falls back to WebGL if unavailable
     * Why: WebGPU offers better performance and modern GPU features
     * Default: true
     * Impact: 10-30% better performance on supported browsers
     * Browser: Chrome 113+, Firefox 118+ (with flag), Safari 18+
     */
    preferWebGPU: true,

    /**
     * Preserve canvas drawing buffer for screenshots
     *
     * What: Keeps canvas pixel data accessible after rendering
     * Why: Required for toDataURL() and screenshot functionality
     * Default: true
     * Impact: Minimal (~1% memory overhead)
     */
    preserveDrawingBuffer: true,

    /**
     * Enable stencil buffer
     *
     * What: Additional buffer for advanced rendering techniques
     * Why: Required for certain effects (outlines, shadows, CSG operations)
     * Default: true
     * Impact: Minor memory overhead
     */
    stencil: true,

    /**
     * Enable alpha channel for transparent backgrounds
     *
     * What: Allows canvas background to be transparent
     * Why: Required for WebGPU to show empty state message through canvas
     * Default: true (WebGPU), false (WebGL)
     * Impact: ~5% performance cost on some platforms (WebGPU spec issue)
     * Note: WebGL doesn't need this, only WebGPU
     */
    alphaForWebGPU: true,

    /**
     * CHROME ONLY: Skip WebGL context lost handling
     *
     * What: Disables overhead for detecting/recovering from lost WebGL context
     * Why: Chrome rarely loses WebGL context, skip the overhead
     * Default: false (standard), true (Chrome optimization)
     * Impact: ~10% faster initialization
     * Risk: None - Chrome handles context loss internally
     * Browser: Chrome only - DO NOT enable for Firefox/Safari
     */
    doNotHandleContextLost: true,

    /**
     * GPU selection preference
     *
     * What: Hints to browser which GPU to use (integrated vs discrete)
     * Why: Discrete GPU offers much better performance for complex scenes
     * Default: 'high-performance'
     * Impact: Can double FPS on laptops with dual GPUs
     * Options: 'high-performance' | 'low-power' | 'default'
     */
    powerPreference: 'high-performance' as const,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SCENE CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  scene: {
    /**
     * Background clear color
     *
     * What: Color shown when nothing is rendered
     * Why: Neutral gray provides good contrast for most models
     * Default: Gray (0.5, 0.5, 0.55, 1.0)
     * Format: RGBA where each value is 0-1
     */
    clearColor: new Color4(0.5, 0.5, 0.55, 1.0),

    /**
     * Environment intensity for PBR materials
     *
     * What: Multiplier for environmental lighting on PBR materials
     * Why: Brighter reflections make metals and glass more realistic
     * Default: 1.0 (Babylon.js default), 1.5 (our choice)
     * Impact: Only affects PBR materials, not basic materials
     */
    environmentIntensity: 1.5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // CAMERA CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  camera: {
    /**
     * Internal name for camera object
     * Not user-visible, used for debugging
     */
    name: 'camera',

    /**
     * Initial horizontal rotation (radians)
     *
     * What: Camera's starting position around Y axis
     * Why: -PI/2 positions camera looking at model from front-right
     * Default: 0 (looks straight at front)
     * Note: Will be adjusted by fitToView after model loads
     */
    alpha: -Math.PI / 2,

    /**
     * Initial vertical rotation (radians)
     *
     * What: Camera's starting angle from vertical axis
     * Why: PI/3 (60°) provides good overview of model
     * Default: PI/2 (90° - side view)
     * Range: 0 (top view) to PI (bottom view)
     */
    beta: Math.PI / 3,

    /**
     * Initial distance from target (units)
     *
     * What: How far camera starts from the center
     * Why: Medium distance works for most models
     * Default: 10
     * Note: Automatically adjusted by fitToView based on model size
     */
    radius: 10,

    /**
     * Point the camera looks at
     *
     * What: World coordinates of camera focus point
     * Why: Origin (0,0,0) is natural center before model loads
     * Default: Vector3.Zero() = (0, 0, 0)
     * Note: Moved to model center by fitToView
     */
    target: Vector3.Zero(),

    /**
     * Mouse wheel zoom sensitivity
     *
     * What: How much one mouse wheel tick changes camera distance
     * Why: Lower = more sensitive = faster zoom
     * Default: 50 (Babylon.js)
     * Current: 10 (more responsive)
     * Range: 1 (very fast) to 100 (very slow)
     */
    wheelPrecision: 10,

    /**
     * Middle mouse button pan sensitivity
     *
     * What: How much mouse movement pans the camera
     * Why: Lower = more sensitive = easier to pan large models
     * Default: 1000 (Babylon.js - very slow)
     * Current: 50 (much more responsive)
     * Range: 10 (very fast) to 1000 (very slow)
     */
    panningSensibility: 50,

    /**
     * Camera movement inertia
     *
     * What: How much momentum camera has after mouse released
     * Why: 0 = stops immediately (precise control for BIM)
     * Default: 0.9 (lots of momentum)
     * Current: 0 (no momentum)
     * Range: 0 (stops instantly) to 0.99 (lots of momentum)
     */
    inertia: 0,

    /**
     * Near clipping plane (units)
     *
     * What: Minimum distance for rendering (anything closer is clipped)
     * Why: Very close value allows inspecting model details up close
     * Default: 1.0 (Babylon.js)
     * Current: 0.1 (allows very close inspection)
     * Impact: Too low can cause z-fighting artifacts
     */
    minZ: 0.1,

    /**
     * Far clipping plane (units)
     *
     * What: Maximum distance for rendering (anything farther is clipped)
     * Why: Large value handles huge buildings and city models
     * Default: 100 (Babylon.js)
     * Current: 1000 (handles very large models)
     * Impact: Too high reduces depth buffer precision
     */
    maxZ: 1000,

    /**
     * Minimum zoom distance (units)
     *
     * What: Closest camera can get to target
     * Why: Prevents camera from going inside small models
     * Default: 0.1
     * Impact: Too low allows camera to clip through geometry
     */
    lowerRadiusLimit: 0.1,

    /**
     * Maximum zoom distance (units)
     *
     * What: Farthest camera can get from target
     * Why: Large value allows viewing entire city-scale models
     * Default: 500
     * Impact: Higher values allow better overview of large sites
     */
    upperRadiusLimit: 500,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // LIGHTING CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  lights: {
    hemispheric: {
      name: 'hemiLight',

      /**
       * Hemispheric light direction
       *
       * What: Vector pointing "up" for ambient light gradient
       * Why: (0,1,0) = Y-up creates natural sky-to-ground lighting
       * Default: (0,1,0)
       */
      direction: new Vector3(0, 1, 0),

      /**
       * Hemispheric light intensity
       *
       * What: Brightness of ambient lighting
       * Why: 1.2 provides good ambient fill without washing out details
       * Default: 1.0 (Babylon.js)
       * Current: 1.2 (slightly brighter for better visibility)
       * Range: 0 (off) to 2+ (very bright)
       */
      intensity: 1.2,
    },

    directional: {
      name: 'dirLight',

      /**
       * Directional light direction
       *
       * What: Vector indicating light ray direction
       * Why: (-1,-2,-1) creates natural 3/4 lighting angle
       * Default: (0,-1,0) (straight down)
       * Note: Used for shadow casting
       */
      direction: new Vector3(-1, -2, -1),

      /**
       * Directional light position
       *
       * What: Where the "sun" is positioned (for shadow calculations)
       * Why: High and offset position creates realistic shadows
       * Default: (0,10,0)
       * Note: Position affects shadow angles
       */
      position: new Vector3(20, 40, 20),

      /**
       * Directional light intensity
       *
       * What: Brightness of primary light source
       * Why: 1.5 provides strong definition and clear shadows
       * Default: 1.0 (Babylon.js)
       * Current: 1.5 (stronger directional light)
       * Range: 0 (off) to 2+ (very bright)
       */
      intensity: 1.5,
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SHADOW CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  shadows: {
    /**
     * Shadow map texture size (pixels)
     *
     * What: Resolution of shadow render target
     * Why: 1024 balances quality and performance
     * Default: 1024
     * Options: 512 (fast), 1024 (balanced), 2048 (high quality), 4096 (very high)
     * Impact: Higher = better quality but slower and more memory
     */
    mapSize: 1024,

    /**
     * Use blurred exponential shadow mapping
     *
     * What: Technique for soft, realistic shadows
     * Why: Much better looking than hard-edge shadows
     * Default: false (hard shadows)
     * Current: true (soft shadows)
     * Impact: ~10% performance cost for better visuals
     */
    useBlurExponentialShadowMap: true,

    /**
     * Shadow blur kernel size
     *
     * What: How much to blur shadow edges
     * Why: 32 creates realistic soft shadows without artifacts
     * Default: 64 (very soft)
     * Current: 32 (balanced)
     * Range: 8 (sharp) to 128 (very soft)
     * Impact: Higher = softer but more GPU cost
     */
    blurKernel: 32,

    /**
     * Shadow size threshold for mesh inclusion (units)
     *
     * What: Minimum mesh size to cast shadows
     * Why: Small objects (< 0.5 units) don't contribute meaningfully to shadows
     * Default: 0.5
     * Impact: Excludes small meshes, improves performance significantly
     * Example: Bolts, screws, small details skipped
     */
    sizeThreshold: 0.5,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GROUND & GRID CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  ground: {
    name: 'ground',

    /**
     * Ground plane width (units)
     *
     * What: Size of ground plane in X direction
     * Why: 50 units accommodates most building models
     * Default: 50
     * Note: Grid extends infinitely via material, this is just mesh size
     */
    width: 50,

    /**
     * Ground plane height (units)
     *
     * What: Size of ground plane in Z direction
     * Why: 50 units matches width for square ground
     * Default: 50
     */
    height: 50,

    /**
     * Ground Y position (units)
     *
     * What: Vertical offset of ground plane
     * Why: 0 places ground at world origin
     * Default: 0
     * Note: Models are centered at origin after loading
     */
    positionY: 0,
  },

  gridMaterial: {
    name: 'gridMaterial',

    /**
     * Grid spacing (units)
     *
     * What: Distance between minor grid lines
     * Why: 1 unit = 1 meter spacing is standard for BIM
     * Default: 1
     */
    gridRatio: 1,

    /**
     * Major grid line frequency
     *
     * What: How often to draw thicker major lines
     * Why: Every 5 units creates clear visual hierarchy
     * Default: 5
     * Example: Minor lines every 1m, major lines every 5m
     */
    majorUnitFrequency: 5,

    /**
     * Minor line visibility
     *
     * What: Opacity of minor grid lines
     * Why: 0.45 visible but not distracting
     * Default: 0.45
     * Range: 0 (invisible) to 1 (fully opaque)
     */
    minorUnitVisibility: 0.45,

    /**
     * Grid main color
     *
     * What: Color of the grid material base
     * Why: White (1,1,1) works on gray background
     * Default: White
     */
    mainColor: new Color3(1, 1, 1),

    /**
     * Grid line color
     *
     * What: Color of grid lines
     * Why: White lines on gray background are clearly visible
     * Default: White
     */
    lineColor: new Color3(1.0, 1.0, 1.0),

    /**
     * Grid opacity
     *
     * What: Overall transparency of grid
     * Why: 0.98 (almost opaque) ensures grid is clearly visible
     * Default: 0.98
     * Range: 0 (invisible) to 1 (fully opaque)
     */
    opacity: 0.98,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // AXES VIEWER CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  axes: {
    /**
     * Axes length (units)
     *
     * What: Length of X/Y/Z axis arrows
     * Why: 2 units is visible but not obtrusive
     * Default: 2
     * Colors: X=Red, Y=Green, Z=Blue (standard convention)
     */
    size: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODEL LOADING CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  modelLoading: {
    /**
     * Accepted file extension
     *
     * What: File types allowed for drag-and-drop
     * Why: GLB is the standard format for 3D web content
     * Default: '.glb'
     * Future: Could support .gltf, .ifc, .obj
     */
    acceptedExtension: '.glb',

    /**
     * Apply realistic PBR materials after loading
     *
     * What: Replace basic materials with physically-based rendering materials
     * Why: Makes models look much more realistic
     * Default: true
     * Impact: Adds ~2 seconds to load time for large models
     */
    applyMaterials: true,

    /**
     * Enable shadows for loaded meshes
     *
     * What: Add meshes as shadow casters
     * Why: Shadows add depth and realism
     * Default: true
     * Note: Only meshes above sizeThreshold cast shadows
     */
    enableShadows: true,

    /**
     * Freeze mesh world matrices after loading
     *
     * What: Tell Babylon.js these meshes won't move
     * Why: Major performance optimization for static models
     * Default: true
     * Impact: 20-30% better FPS for large models
     * Note: Models can't be animated after freezing
     */
    freezeMeshes: true,

    /**
     * Center model at origin if far away
     *
     * What: Move model to (0,0,0) if more than 1000 units away
     * Why: IFC files often use real-world coordinates (millions of meters)
     * Default: true
     * Threshold: 1000 units from origin
     * Impact: Fixes precision issues with floating-point math
     */
    centerAtOrigin: true,

    /**
     * Automatically frame camera to fit model
     *
     * What: Adjust camera radius and target to show full model
     * Why: User shouldn't have to zoom manually after load
     * Default: true
     */
    fitToView: true,

    /**
     * Camera radius multiplier for framing
     *
     * What: How far to position camera relative to model size
     * Why: 2x ensures model fits comfortably in view
     * Default: 2
     * Range: 1.5 (tight) to 3 (spacious)
     */
    radiusMultiplier: 2,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // OPTIMIZATION CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  optimization: {
    /**
     * Enable scene optimizer by default
     *
     * What: Automatically adjust quality to maintain target FPS
     * Why: Prevents performance degradation on slower hardware
     * Default: true
     */
    enableOptimizer: true,

    /**
     * Target frames per second for optimizer
     *
     * What: FPS goal for scene optimizer
     * Why: 30 FPS is acceptable for architectural visualization
     * Default: 30
     * Note: Optimizer will reduce quality if FPS drops below this
     */
    targetFps: 30,

    /**
     * CHROME ONLY: Block material updates during load
     *
     * What: Prevent material system from updating during GLB parse
     * Why: Chrome batches shader compilation more efficiently when blocked
     * Default: false (standard), true (Chrome optimization)
     * Impact: ~30% faster load times on Chrome for large models
     * Browser: Chrome only - Firefox doesn't benefit from this
     */
    blockMaterialDirtyMechanismForChrome: true,
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  ui: {
    colors: {
      primary: 'rgba(59, 130, 246, 0.9)',
      primaryHover: 'rgba(59, 130, 246, 1)',
      primaryLight: 'rgba(59, 130, 246, 0.2)',
      primaryBorder: 'rgba(59, 130, 246, 0.8)',
      dark: 'rgba(0, 0, 0, 0.8)',
      white: 'white',
      textLight: 'rgba(255, 255, 255, 0.7)',
    },
    spacing: {
      small: '10px',
      medium: '20px',
      large: '40px',
    },
    borderRadius: {
      default: '8px',
    },
    shadows: {
      default: '0 4px 6px rgba(0, 0, 0, 0.3)',
      hover: '0 6px 8px rgba(0, 0, 0, 0.4)',
    },
    transitions: {
      default: 'all 0.2s ease',
    },
    zIndex: {
      overlay: 1000,
      button: 100,
      toolbar: 200,
    },
    fonts: {
      default: 'sans-serif',
    },
    toolbar: {
      buttonSize: '36px',
      buttonGap: '8px',
      iconSize: '18px',
    },
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // UI TEXT
  // ═══════════════════════════════════════════════════════════════════════════

  text: {
    errorMessages: {
      invalidFileType: 'Please drop a GLB file',
      loadFailed: 'Error loading GLB file. Please check the console.',
      sceneNotReady: 'Please wait for the viewer to finish initializing...',
    },

    dropPrompt: 'Drop GLB file here',

    emptyState: {
      emoji: '📦',
      title: 'Drag & Drop GLB File',
      subtitle: 'or click to browse',
      initializing: 'Initializing Viewer...',
      detectingEngine: 'Detecting WebGPU/WebGL support',
    },

    fitToViewButton: 'Fit to View',

    toolbar: {
      grid: 'Grid',
      axes: 'Axes',
      gizmo: 'Gizmo',
      optimizer: 'Scene Optimizer (Target 30 FPS)',
      top: 'Top',
      bottom: 'Bottom',
      front: 'Front',
      back: 'Back',
      left: 'Left',
      right: 'Right',
    },

    loading: {
      title: 'Loading Model',
      subtitle: 'Please wait...',
    },
  },
} as const;

// Type exports for TypeScript
export type ViewerConfig = typeof VIEWER_CONFIG;
