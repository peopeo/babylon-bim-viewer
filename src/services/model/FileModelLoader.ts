import {
  Scene,
  SceneLoader,
  AbstractMesh,
  Mesh,
  PBRMaterial,
  ShadowGenerator,
  ArcRotateCamera,
  Vector3,
} from '@babylonjs/core';
import '@babylonjs/loaders/glTF';
import {
  IModelLoader,
  ModelSource,
  ModelLoadOptions,
  LoadedModel,
  LoadTimingBreakdown,
  ModelStats,
} from '../../core/interfaces';
import { VIEWER_CONFIG } from '../../config/viewer.config';

/**
 * File Model Loader - Loads 3D models from File objects
 *
 * Purpose: Handles loading GLB/GLTF files from local file system.
 * Applies materials, shadows, and optimizations during load.
 *
 * Design: Strategy pattern - one of several model loading strategies
 */
export class FileModelLoader implements IModelLoader {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator | null;
  private camera: ArcRotateCamera;
  private cancelRequested: boolean = false;

  constructor(
    scene: Scene,
    shadowGenerator: ShadowGenerator | null,
    camera: ArcRotateCamera
  ) {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.camera = camera;
  }

  /**
   * Load model from file
   *
   * @param source - Model source (must be type: 'file')
   * @param options - Loading options
   * @returns Promise<LoadedModel> - Loaded model with meshes and stats
   */
  async load(source: ModelSource, options?: ModelLoadOptions): Promise<LoadedModel> {
    if (source.type !== 'file') {
      throw new Error('FileModelLoader only supports file sources');
    }

    const file = source.file;
    const opts = this.mergeOptions(options);
    const timing: LoadTimingBreakdown = {
      total: 0,
      babylonLoad: 0,
      materialSetup: 0,
      shadowSetup: 0,
      boundingBox: 0,
      optimization: 0,
    };

    const totalStart = performance.now();
    this.cancelRequested = false;

    try {
      // Report initial progress
      opts.onProgress?.(0);

      // Create object URL for file
      const url = URL.createObjectURL(file);

      // Extract file extension for plugin detection
      const extension = file.name.substring(file.name.lastIndexOf('.'));

      // Load model from blob URL
      // For blob URLs: pass blob as sceneFilename, extension as pluginExtension
      const loadStart = performance.now();
      const result = await SceneLoader.ImportMeshAsync(
        '', // meshNames
        '', // rootUrl (empty for blob URLs)
        url, // sceneFilename (the blob URL itself)
        this.scene,
        undefined, // CRITICAL: Pass undefined, not a callback - huge performance difference!
        extension // pluginExtension (.glb) for loader detection
      );
      timing.babylonLoad = performance.now() - loadStart;

      // Clean up object URL
      URL.revokeObjectURL(url);

      // Check for cancellation
      if (this.cancelRequested) {
        throw new Error('Load cancelled');
      }

      const meshes = result.meshes;

      // Apply materials if requested
      if (opts.applyMaterials) {
        const matStart = performance.now();
        this.applyMaterials(meshes);
        timing.materialSetup = performance.now() - matStart;
        opts.onProgress?.(0.8); // 80%
      }

      // Setup shadows if requested
      if (opts.enableShadows && this.shadowGenerator) {
        const shadowStart = performance.now();
        this.setupShadows(meshes);
        timing.shadowSetup = performance.now() - shadowStart;
        opts.onProgress?.(0.85); // 85%
      }

      // Calculate bounding box
      const bboxStart = performance.now();
      let stats = this.calculateStats(meshes);
      timing.boundingBox = performance.now() - bboxStart;

      // Center at origin if requested
      if (opts.centerAtOrigin) {
        const offset = stats.boundingBox.center.negate();
        this.centerMeshes(meshes, stats);

        // Update stats to reflect new centered position
        stats = {
          ...stats,
          boundingBox: {
            ...stats.boundingBox,
            center: Vector3.Zero(),
            min: stats.boundingBox.min.add(offset),
            max: stats.boundingBox.max.add(offset),
          }
        };
      }

      // Fit to view if requested (using updated stats after centering)
      if (opts.fitToView) {
        this.fitCameraToView(stats);
      }

      // Freeze meshes if requested (optimization)
      if (opts.freezeMeshes) {
        const optimStart = performance.now();
        this.freezeMeshes(meshes);
        timing.optimization = performance.now() - optimStart;
      }

      timing.total = performance.now() - totalStart;
      opts.onProgress?.(1.0); // 100%

      return {
        meshes,
        name: file.name,
        timing,
        stats,
      };
    } catch (error) {
      if (this.cancelRequested) {
        throw new Error('Load cancelled by user');
      }
      throw error;
    }
  }

  /**
   * Cancel ongoing load operation
   */
  cancel(): void {
    this.cancelRequested = true;
  }

  /**
   * Merge provided options with defaults
   */
  private mergeOptions(options?: ModelLoadOptions): Required<ModelLoadOptions> {
    return {
      applyMaterials: options?.applyMaterials ?? VIEWER_CONFIG.modelLoading.applyMaterials,
      enableShadows: options?.enableShadows ?? VIEWER_CONFIG.modelLoading.enableShadows,
      freezeMeshes: options?.freezeMeshes ?? VIEWER_CONFIG.modelLoading.freezeMeshes,
      centerAtOrigin: options?.centerAtOrigin ?? VIEWER_CONFIG.modelLoading.centerAtOrigin,
      fitToView: options?.fitToView ?? VIEWER_CONFIG.modelLoading.fitToView,
      onProgress: options?.onProgress ?? (() => {}),
    };
  }

  /**
   * Apply PBR materials to all meshes
   */
  private applyMaterials(meshes: AbstractMesh[]): void {
    const config = VIEWER_CONFIG.materials.pbr;

    meshes.forEach((mesh) => {
      if (mesh instanceof Mesh && !mesh.material) {
        const material = new PBRMaterial(`pbr-${mesh.name}`, this.scene);
        material.metallic = config.metallic;
        material.roughness = config.roughness;
        material.albedoColor = config.albedoColor;
        mesh.material = material;
      }
    });
  }

  /**
   * Setup shadow casting for all meshes
   */
  private setupShadows(meshes: AbstractMesh[]): void {
    if (!this.shadowGenerator) return;

    meshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        this.shadowGenerator!.addShadowCaster(mesh);
      }
    });
  }

  /**
   * Calculate model statistics
   */
  private calculateStats(meshes: AbstractMesh[]): ModelStats {
    let totalVertices = 0;
    let totalFaces = 0;
    let minBounds = new Vector3(Infinity, Infinity, Infinity);
    let maxBounds = new Vector3(-Infinity, -Infinity, -Infinity);

    meshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        totalVertices += mesh.getTotalVertices();
        totalFaces += mesh.getTotalIndices() / 3;

        const boundingInfo = mesh.getBoundingInfo();
        const min = boundingInfo.boundingBox.minimumWorld;
        const max = boundingInfo.boundingBox.maximumWorld;

        minBounds = Vector3.Minimize(minBounds, min);
        maxBounds = Vector3.Maximize(maxBounds, max);
      }
    });

    const size = maxBounds.subtract(minBounds);
    const center = minBounds.add(size.scale(0.5));

    return {
      meshCount: meshes.length,
      vertexCount: totalVertices,
      faceCount: totalFaces,
      boundingBox: {
        min: minBounds,
        max: maxBounds,
        size,
        center,
      },
      materialCount: this.scene.materials.length,
      textureCount: this.scene.textures.length,
    };
  }

  /**
   * Center all meshes at origin
   *
   * Important: Only apply offset to ROOT meshes (no parent) to avoid
   * double-transforming child meshes in hierarchies
   */
  private centerMeshes(meshes: AbstractMesh[], stats: ModelStats): void {
    const offset = stats.boundingBox.center.negate();
    meshes.forEach((mesh) => {
      // Only transform root meshes (meshes without parents)
      // Child meshes will be transformed automatically through parent hierarchy
      if (!mesh.parent) {
        mesh.position.addInPlace(offset);
      }
    });
  }

  /**
   * Fit camera to view entire model
   */
  private fitCameraToView(stats: ModelStats): void {
    const size = stats.boundingBox.size;
    const maxDimension = Math.max(size.x, size.y, size.z);
    const targetRadius = maxDimension * 2;

    this.camera.radius = targetRadius;
    this.camera.target = stats.boundingBox.center;
  }

  /**
   * Freeze meshes for performance
   *
   * Why: Frozen meshes skip transform updates, reducing CPU overhead
   */
  private freezeMeshes(meshes: AbstractMesh[]): void {
    meshes.forEach((mesh) => {
      if (mesh instanceof Mesh) {
        mesh.freezeWorldMatrix();
      }
    });
  }
}
