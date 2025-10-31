import {
  AbstractMesh,
  Mesh,
  Material,
  Texture,
  Scene,
  ShadowGenerator,
  SceneOptimizer,
} from '@babylonjs/core';

/**
 * Resource Disposer - Comprehensive resource cleanup
 *
 * Purpose: Properly disposes all model resources to prevent memory leaks.
 * Handles materials, textures, meshes in correct order.
 *
 * Design: Service pattern - encapsulates complex disposal logic
 */
export class ResourceDisposer {
  private scene: Scene;
  private shadowGenerator: ShadowGenerator | null;
  private engineType: 'WebGPU' | 'WebGL';

  constructor(scene: Scene, shadowGenerator: ShadowGenerator | null, engineType: 'WebGPU' | 'WebGL') {
    this.scene = scene;
    this.shadowGenerator = shadowGenerator;
    this.engineType = engineType;
  }

  /**
   * Dispose loaded model with comprehensive cleanup
   *
   * Why: Prevents memory leaks by disposing all resources in correct order
   *
   * Order:
   * 1. Stop scene optimizer
   * 2. Remove shadow casters
   * 3. Collect all materials and textures (using Set to avoid duplicates)
   * 4. Dispose meshes
   * 5. Dispose materials
   * 6. Dispose textures
   * 7. Force GPU flush for WebGPU
   * 8. Wait for garbage collection
   *
   * @param meshes - Meshes to dispose
   * @param sceneOptimizer - Optional scene optimizer to stop
   * @returns Promise<void>
   */
  async disposeModel(meshes: AbstractMesh[], sceneOptimizer?: SceneOptimizer | null): Promise<void> {
    console.log(`Disposing model: ${meshes.length} meshes`);

    try {
      // Stop scene optimizer if present
      if (sceneOptimizer) {
        sceneOptimizer.stop();
        sceneOptimizer.dispose();
        console.log('Scene optimizer stopped and disposed');
      }

      // Collect all materials and textures
      const materialsToDispose = new Set<Material>();
      const texturesToDispose = new Set<Texture>();

      meshes.forEach((mesh) => {
        // Remove from shadow generator
        if (this.shadowGenerator && mesh instanceof Mesh) {
          this.shadowGenerator.removeShadowCaster(mesh);
        }

        // Collect material and its textures
        if (mesh.material) {
          this.collectMaterialResources(mesh.material, materialsToDispose, texturesToDispose);
        }

        // Dispose mesh (but not material/textures yet)
        mesh.dispose(false, false);
      });

      console.log(`Collected ${materialsToDispose.size} materials, ${texturesToDispose.size} textures`);

      // Dispose materials
      materialsToDispose.forEach((material) => {
        try {
          material.dispose(true, true);
        } catch (e) {
          // Already disposed, ignore
        }
      });

      // Dispose textures
      texturesToDispose.forEach((texture) => {
        try {
          texture.dispose();
        } catch (e) {
          // Already disposed, ignore
        }
      });

      /**
       * WEBGPU ONLY: Force GPU flush
       *
       * Why: WebGPU requires explicit render to flush GPU resources
       * Impact: Ensures immediate GPU memory release
       */
      if (this.engineType === 'WebGPU') {
        this.scene.render();
        console.log('WebGPU: Forced GPU flush');
      }

      /**
       * Wait for garbage collection
       *
       * Why: Give JS garbage collector time to clean up
       * Impact: More reliable memory release
       */
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log('Model disposal complete');
    } catch (error) {
      console.error('Error during model disposal:', error);
      throw error;
    }
  }

  /**
   * Collect all resources from a material
   *
   * Recursively collects textures from material, handling all texture types:
   * - Albedo (base color)
   * - Bump (normal map)
   * - Metallic
   * - Roughness
   * - Diffuse
   * - Emissive
   * - Opacity
   * - Ambient
   * - Reflection
   * - Refraction
   * - Lightmap
   * - Specular
   *
   * @param material - Material to collect from
   * @param materials - Set to add material to
   * @param textures - Set to add textures to
   */
  private collectMaterialResources(
    material: Material,
    materials: Set<Material>,
    textures: Set<Texture>
  ): void {
    materials.add(material);

    // Collect all texture types from material
    const textureProps = [
      'albedoTexture',
      'bumpTexture',
      'metallicTexture',
      'roughnessTexture',
      'diffuseTexture',
      'emissiveTexture',
      'opacityTexture',
      'ambientTexture',
      'reflectionTexture',
      'refractionTexture',
      'lightmapTexture',
      'specularTexture',
    ];

    textureProps.forEach((prop) => {
      const texture = (material as any)[prop];
      if (texture && texture instanceof Texture) {
        textures.add(texture);
      }
    });
  }

  /**
   * Quick dispose without comprehensive cleanup
   *
   * Use when you need fast disposal and memory is not critical.
   * Only disposes meshes, not materials or textures.
   *
   * @param meshes - Meshes to dispose
   */
  quickDispose(meshes: AbstractMesh[]): void {
    console.log(`Quick disposing ${meshes.length} meshes`);
    meshes.forEach((mesh) => mesh.dispose());
  }
}
