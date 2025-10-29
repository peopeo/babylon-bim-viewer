import { Scene, PBRMaterial, AbstractMesh, Mesh } from '@babylonjs/core';
import { createBricks051Material } from './BrickMaterial';
import { createCorrugatedSteel007Material } from './MetalMaterial';
import { UVGenerator } from './UVGenerator';

/**
 * Material Library for managing and applying realistic PBR materials to BIM models
 *
 * This library provides:
 * - Centralized material management
 * - Smart material name matching (e.g., "Material - Brick" -> realistic brick texture)
 * - Material reuse (one material shared across multiple meshes)
 * - Easy expansion for additional material types
 */
export class MaterialLibrary {
  private scene: Scene;
  private materials = new Map<string, PBRMaterial>();

  constructor(scene: Scene) {
    this.scene = scene;
  }

  /**
   * Get or create the Bricks051 material
   */
  getBricks051(uvScale: number = 1.0): PBRMaterial {
    const key = `Bricks051_${uvScale}`;

    if (!this.materials.has(key)) {
      const material = createBricks051Material(this.scene, uvScale);
      this.materials.set(key, material);
    }

    return this.materials.get(key)!;
  }

  /**
   * Get or create the CorrugatedSteel007 material
   */
  getCorrugatedSteel007(uvScale: number = 1.0): PBRMaterial {
    const key = `CorrugatedSteel007_${uvScale}`;

    if (!this.materials.has(key)) {
      const material = createCorrugatedSteel007Material(this.scene, uvScale);
      this.materials.set(key, material);
    }

    return this.materials.get(key)!;
  }

  /**
   * Smart material matcher - maps original material names to realistic materials
   *
   * @param originalName - Original material name from the GLB/BIM model
   * @param uvScale - UV scaling factor (optional)
   * @returns PBRMaterial if a match is found, null otherwise
   */
  getMaterialForName(originalName: string, uvScale: number = 1.0): PBRMaterial | null {
    const lowerName = originalName.toLowerCase();

    // Match brick-related materials
    if (lowerName.includes('brick') || lowerName.includes('ziegel')) {
      return this.getBricks051(uvScale);
    }

    // Match metal-related materials
    if (lowerName.includes('metal') ||
        lowerName.includes('steel') ||
        lowerName.includes('stahl') ||
        lowerName.includes('iron') ||
        lowerName.includes('aluminum') ||
        lowerName.includes('aluminium')) {
      return this.getCorrugatedSteel007(uvScale);
    }

    // Add more material types here as you expand:
    // if (lowerName.includes('concrete') || lowerName.includes('beton')) {
    //   return this.getConcrete(uvScale);
    // }
    //
    // if (lowerName.includes('wood') || lowerName.includes('holz')) {
    //   return this.getWood(uvScale);
    // }

    return null;
  }

  /**
   * Apply realistic materials to all meshes based on their original material names
   *
   * @param meshes - Array of meshes from the loaded model
   * @param uvScale - UV scaling factor for all materials (optional)
   * @returns Object with statistics about applied materials
   */
  applyToMeshes(
    meshes: AbstractMesh[],
    uvScale: number = 1.0
  ): { total: number; replaced: number; materialStats: Map<string, number> } {
    let totalMeshes = 0;
    let replacedCount = 0;
    const materialStats = new Map<string, number>();

    console.log('=== APPLYING REALISTIC MATERIALS ===');

    meshes.forEach(mesh => {
      if (mesh instanceof Mesh && mesh.material) {
        totalMeshes++;
        const originalName = mesh.material.name;

        // Try to find a matching realistic material
        const newMaterial = this.getMaterialForName(originalName, uvScale);

        if (newMaterial) {
          console.log(`Replacing "${originalName}" with ${newMaterial.name}`);

          // Check if mesh has UV coordinates - if not, generate them
          const hasUVs = mesh.isVerticesDataPresent('uv');
          if (!hasUVs) {
            console.warn(`⚠️ Mesh "${mesh.name}" has no UV coordinates! Generating planar UVs...`);
            // Generate UVs with a scale that makes brick pattern realistic
            // Higher scale = smaller bricks (more repetition)
            // Scale of 0.5 means 1 unit in world = 2 units in UV space
            UVGenerator.generateBoxUVs(mesh, 0.5);
          }

          mesh.material = newMaterial;
          replacedCount++;

          // Track statistics
          const matName = newMaterial.name;
          materialStats.set(matName, (materialStats.get(matName) || 0) + 1);
        }
      }
    });

    console.log('=== MATERIAL APPLICATION COMPLETE ===');
    console.log(`Total meshes with materials: ${totalMeshes}`);
    console.log(`Materials replaced: ${replacedCount}`);
    console.log('Material usage:');
    materialStats.forEach((count, name) => {
      console.log(`  ${name}: ${count} meshes`);
    });

    return {
      total: totalMeshes,
      replaced: replacedCount,
      materialStats
    };
  }

  /**
   * Get all loaded materials
   */
  getAllMaterials(): Map<string, PBRMaterial> {
    return this.materials;
  }

  /**
   * Dispose all materials and clear the library
   */
  dispose(): void {
    this.materials.forEach(material => {
      material.dispose();
    });
    this.materials.clear();
  }
}
