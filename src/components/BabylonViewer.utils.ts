import { Vector3, AbstractMesh } from '@babylonjs/core';

/**
 * Utility functions for the Babylon.js viewer
 */

/**
 * Calculate bounding box for a collection of meshes
 */
export const calculateBoundingBox = (meshes: AbstractMesh[]) => {
  let min = new Vector3(Infinity, Infinity, Infinity);
  let max = new Vector3(-Infinity, -Infinity, -Infinity);

  meshes.forEach((mesh) => {
    if (mesh.getTotalVertices() > 0) {
      const boundingInfo = mesh.getBoundingInfo();
      const meshMin = boundingInfo.boundingBox.minimumWorld;
      const meshMax = boundingInfo.boundingBox.maximumWorld;

      min = Vector3.Minimize(min, meshMin);
      max = Vector3.Maximize(max, meshMax);
    }
  });

  return { min, max };
};

/**
 * Calculate center and maximum dimension from bounding box
 */
export const getBoundingBoxInfo = (min: Vector3, max: Vector3) => {
  const center = Vector3.Center(min, max);
  const size = max.subtract(min);
  const maxDim = Math.max(size.x, size.y, size.z);

  return { center, size, maxDim };
};

/**
 * Prevent default drag event behavior
 */
export const preventDragDefaults = (e: React.DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * Check if file has valid extension
 */
export const isValidFileExtension = (filename: string, extension: string): boolean => {
  return filename.toLowerCase().endsWith(extension);
};
