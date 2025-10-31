import { Color3, Color4, Vector3 } from '@babylonjs/core';

/**
 * Configuration settings for the Babylon.js viewer
 */
export const VIEWER_CONFIG = {
  // Engine settings
  engine: {
    preserveDrawingBuffer: true,
    stencil: true,
    // Performance optimizations for shader compilation
    doNotHandleContextLost: true, // Faster initialization
    powerPreference: 'high-performance', // Use discrete GPU if available
  },

  // Scene settings
  scene: {
    clearColor: new Color4(0.5, 0.5, 0.55, 1.0), // Brighter background
  },

  // Camera settings
  camera: {
    name: 'camera',
    alpha: -Math.PI / 2,
    beta: Math.PI / 3,
    radius: 10,
    target: Vector3.Zero(),
    wheelPrecision: 10,
    panningSensibility: 50, // Lower = more sensitive panning (default: ~1000)
    inertia: 0, // No momentum/inertia (0 = stops immediately, 0.9 = lots of momentum)
    minZ: 0.1,
    maxZ: 1000,
    lowerRadiusLimit: 0.1,
    upperRadiusLimit: 500,
  },

  // Lighting settings
  lights: {
    hemispheric: {
      name: 'hemiLight',
      direction: new Vector3(0, 1, 0),
      intensity: 1.2, // Increased for brighter ambient lighting
    },
    directional: {
      name: 'dirLight',
      direction: new Vector3(-1, -2, -1),
      position: new Vector3(20, 40, 20),
      intensity: 1.5, // Increased for stronger directional light
    },
  },

  // Shadow settings
  shadows: {
    mapSize: 1024,
    useBlurExponentialShadowMap: true,
    blurKernel: 32,
  },

  // Ground settings
  ground: {
    name: 'ground',
    width: 50,
    height: 50,
    positionY: 0,
  },

  // Grid material settings
  gridMaterial: {
    name: 'gridMaterial',
    gridRatio: 1,
    majorUnitFrequency: 5,
    minorUnitVisibility: 0.45,
    mainColor: new Color3(1, 1, 1),
    lineColor: new Color3(1.0, 1.0, 1.0),
    opacity: 0.98,
  },

  // Axes viewer settings
  axes: {
    size: 2,
  },

  // Model framing settings
  framing: {
    radiusMultiplier: 2,
  },

  // Model loading settings
  model: {
    applyPBRMaterials: true,
    enableShadows: true,
    freezeMeshes: true,
    centerAtOrigin: true,
    fitToView: true,
  },

  // Material settings
  materials: {
    pbr: {
      metallic: 0.0,
      roughness: 0.5,
      albedoColor: new Color3(0.9, 0.9, 0.9),
    },
  },

  // File loading settings
  fileLoading: {
    acceptedExtension: '.glb',
    errorMessage: 'Please drop a GLB file',
    loadErrorMessage: 'Error loading GLB file. Please check the console.',
  },

  // UI Theme
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

  // UI Text
  text: {
    dropPrompt: 'Drop GLB file here',
    emptyState: {
      emoji: '📦',
      title: 'Drag & Drop GLB File',
      subtitle: 'or click to browse',
    },
    fitToViewButton: 'Fit to View',
    toolbar: {
      grid: 'Grid',
      axes: 'Axes',
      gizmo: 'Gizmo',
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
