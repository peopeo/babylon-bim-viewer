import { AbstractMesh, Vector3 } from '@babylonjs/core';

/**
 * Model loader abstraction - supports multiple loading strategies
 *
 * Purpose: Abstract away how models are loaded (file, server, URL, etc.)
 * This makes it easy to swap loading implementations without changing client code.
 *
 * Design: Strategy pattern - different loaders implement same interface
 */
export interface IModelLoader {
  /**
   * Load a model from a source
   * Returns loaded meshes and timing information
   */
  load(source: ModelSource, options?: ModelLoadOptions): Promise<LoadedModel>;

  /**
   * Cancel ongoing load operation
   * Useful for aborting slow loads when user starts new one
   */
  cancel(): void;
}

/**
 * Where to load the model from
 * Extensible - add new sources without changing interface
 */
export type ModelSource =
  | { type: 'file'; file: File }
  | { type: 'path'; path: string; name?: string }
  | { type: 'url'; url: string; name?: string }
  | { type: 'server'; id: string; name?: string };  // Future: server loading

/**
 * Options for model loading
 * All optional - sensible defaults provided
 */
export interface ModelLoadOptions {
  /**
   * Apply realistic PBR materials after loading
   * Uses MaterialLibrary to replace basic materials
   * Default: true
   */
  applyMaterials?: boolean;

  /**
   * Enable shadows for loaded meshes
   * Only applies to meshes above size threshold
   * Default: true
   */
  enableShadows?: boolean;

  /**
   * Freeze mesh world matrices after loading
   * Optimization for static models (most BIM models)
   * Default: true
   */
  freezeMeshes?: boolean;

  /**
   * Center model at origin if far away
   * Fixes IFC files with real-world coordinates
   * Threshold: > 1000 units from origin
   * Default: true
   */
  centerAtOrigin?: boolean;

  /**
   * Automatically frame camera to fit model
   * Default: true
   */
  fitToView?: boolean;

  /**
   * Progress callback for large files
   * Reports loading percentage (0-100)
   */
  onProgress?: (progress: number) => void;
}

/**
 * Result of model loading operation
 */
export interface LoadedModel {
  /**
   * All meshes loaded from the model
   * Includes root nodes and children
   */
  meshes: AbstractMesh[];

  /**
   * Human-readable name for the model
   * Derived from filename or provided explicitly
   */
  name: string;

  /**
   * Performance timing breakdown
   * Useful for optimization analysis
   */
  timing: LoadTimingBreakdown;

  /**
   * Model statistics
   */
  stats: ModelStats;
}

/**
 * Detailed timing information for each loading phase
 */
export interface LoadTimingBreakdown {
  /**
   * Total time for everything (seconds)
   */
  total: number;

  /**
   * Time for Babylon.js to import and create meshes (seconds)
   */
  babylonLoad: number;

  /**
   * Time to apply materials (seconds)
   */
  materialSetup: number;

  /**
   * Time to setup shadows (seconds)
   */
  shadowSetup: number;

  /**
   * Time to calculate bounding box (seconds)
   */
  boundingBox: number;

  /**
   * Time for optimizations (freezing meshes, etc.) (seconds)
   */
  optimization: number;
}

/**
 * Statistics about the loaded model
 */
export interface ModelStats {
  /**
   * Total number of meshes
   */
  meshCount: number;

  /**
   * Total number of vertices across all meshes
   */
  vertexCount: number;

  /**
   * Total number of faces/triangles
   */
  faceCount: number;

  /**
   * Bounding box information
   */
  boundingBox: {
    min: Vector3;
    max: Vector3;
    size: Vector3;
    center: Vector3;
  };

  /**
   * Number of unique materials
   */
  materialCount: number;

  /**
   * Number of unique textures
   */
  textureCount: number;

  /**
   * File size in bytes (if available)
   */
  fileSize?: number;
}
