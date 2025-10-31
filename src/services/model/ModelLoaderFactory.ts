import { Scene, ShadowGenerator, ArcRotateCamera } from '@babylonjs/core';
import { IModelLoader, ModelSource } from '../../core/interfaces';
import { FileModelLoader } from './FileModelLoader';

/**
 * Model Loader Factory - Creates appropriate loader for source type
 *
 * Purpose: Factory for creating model loaders based on source type.
 * Supports file loading now, extensible for server/URL loading later.
 *
 * Design: Factory pattern - creates loaders without exposing creation logic
 */
export class ModelLoaderFactory {
  /**
   * Create model loader for given source type
   *
   * @param source - Model source (file, path, url, server)
   * @param scene - Babylon scene
   * @param shadowGenerator - Optional shadow generator
   * @param camera - Arc rotate camera for view fitting
   * @returns IModelLoader - Appropriate loader for source type
   */
  static create(
    source: ModelSource,
    scene: Scene,
    shadowGenerator: ShadowGenerator | null,
    camera: ArcRotateCamera
  ): IModelLoader {
    switch (source.type) {
      case 'file':
        return new FileModelLoader(scene, shadowGenerator, camera);

      case 'path':
        // TODO: Implement PathModelLoader for loading from local paths
        throw new Error('Path loading not yet implemented');

      case 'url':
        // TODO: Implement URLModelLoader for loading from URLs
        throw new Error('URL loading not yet implemented');

      case 'server':
        // TODO: Implement ServerModelLoader for loading from API
        throw new Error('Server loading not yet implemented');

      default:
        const _exhaustive: never = source;
        throw new Error(`Unknown model source type: ${(_exhaustive as any).type}`);
    }
  }
}
