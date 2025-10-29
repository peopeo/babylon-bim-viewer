#!/usr/bin/env python3
"""
Convert IFC to GLB using ifcopenshell
Outputs performance metrics for baseline measurement
"""

import sys
import time
import argparse
from pathlib import Path
import multiprocessing
import ifcopenshell
import ifcopenshell.geom


def convert_ifc_to_glb(ifc_path, output_path=None, verbose=True):
    """
    Convert IFC file to GLB format

    Args:
        ifc_path: Path to input IFC file
        output_path: Path for output GLB file (optional)
        verbose: Print progress information

    Returns:
        dict with conversion metrics
    """
    ifc_path = Path(ifc_path)

    if not ifc_path.exists():
        print(f"Error: File not found: {ifc_path}")
        return None

    # Default output path
    if output_path is None:
        output_path = ifc_path.with_suffix('.glb')
    else:
        output_path = Path(output_path)

    if verbose:
        print(f"Input:  {ifc_path}")
        print(f"Output: {output_path}")
        print(f"Size:   {ifc_path.stat().st_size / (1024**2):.2f} MB")
        print("-" * 60)

    # Start timing
    start_time = time.time()

    try:
        # Load IFC file
        if verbose:
            print("Loading IFC file...")
        load_start = time.time()
        ifc_file = ifcopenshell.open(str(ifc_path))
        load_time = time.time() - load_start

        if verbose:
            print(f"  Schema: {ifc_file.schema}")
            print(f"  Load time: {load_time:.2f}s")

        # Configure geometry settings
        if verbose:
            print("Configuring geometry settings...")

        settings = ifcopenshell.geom.settings()
        settings.set('use-world-coords', True)
        settings.set('weld-vertices', True)
        settings.set('reorient-shells', True)
        settings.set('generate-uvs', True)

        if verbose:
            print("  ✓ World coordinates enabled")
            print("  ✓ Vertex welding enabled")
            print("  ✓ Shell reorientation enabled")
            print("  ✓ UV generation enabled")

        # Get all products with geometry
        products = ifc_file.by_type("IfcProduct")
        if verbose:
            print(f"\nFound {len(products)} products in IFC file")
            print("Starting geometry conversion...")
            print("-" * 60)

        convert_start = time.time()

        # Create serializer for GLB output
        if verbose:
            print("Initializing GLB serializer...")

        serializer_settings = ifcopenshell.geom.serializer_settings()
        serializer = ifcopenshell.geom.serializers.gltf(str(output_path), settings, serializer_settings)

        # Create geometry iterator
        num_cores = multiprocessing.cpu_count()
        if verbose:
            print(f"Creating geometry iterator (using {num_cores} CPU cores)...")

        iterator = ifcopenshell.geom.iterator(settings, ifc_file, num_cores)

        processed = 0
        last_report_time = time.time()

        if verbose:
            print("\nProcessing geometry:")

        for shape in iterator:
            serializer.write(shape)
            processed += 1

            # Progress reporting every 50 items or every 2 seconds
            current_time = time.time()
            if verbose and (processed % 50 == 0 or current_time - last_report_time >= 2):
                elapsed = current_time - convert_start
                progress = processed / len(products) * 100
                rate = processed / elapsed if elapsed > 0 else 0
                eta = (len(products) - processed) / rate if rate > 0 else 0

                print(f"  [{processed:5d}/{len(products)}] {progress:5.1f}% | "
                      f"{rate:.1f} items/s | ETA: {eta:.0f}s", flush=True)
                last_report_time = current_time

        if verbose:
            print("\nFinalizing GLB file...")

        serializer.finalize()
        convert_time = time.time() - convert_start

        if verbose:
            print("  ✓ Finalization complete")

        total_time = time.time() - start_time
        output_size = output_path.stat().st_size / (1024**2)

        metrics = {
            'ifc_size_mb': ifc_path.stat().st_size / (1024**2),
            'glb_size_mb': output_size,
            'load_time_s': load_time,
            'convert_time_s': convert_time,
            'total_time_s': total_time,
            'products_processed': processed,
            'compression_ratio': ifc_path.stat().st_size / output_path.stat().st_size
        }

        if verbose:
            print("-" * 60)
            print("CONVERSION COMPLETE")
            print(f"  Products processed: {processed}")
            print(f"  GLB size: {output_size:.2f} MB")
            print(f"  Compression: {metrics['compression_ratio']:.2f}x")
            print(f"  Load time: {load_time:.2f}s")
            print(f"  Convert time: {convert_time:.2f}s")
            print(f"  Total time: {total_time:.2f}s")
            print(f"\n✓ Saved: {output_path}")

        return metrics

    except Exception as e:
        print(f"Error during conversion: {e}")
        import traceback
        traceback.print_exc()
        return None


def main():
    parser = argparse.ArgumentParser(
        description='Convert IFC to GLB using ifcopenshell',
        epilog='Generates performance metrics for baseline measurement'
    )

    parser.add_argument('input', help='Input IFC file')
    parser.add_argument('-o', '--output', help='Output GLB file (default: input.glb)')
    parser.add_argument('-q', '--quiet', action='store_true', help='Quiet mode')

    args = parser.parse_args()

    metrics = convert_ifc_to_glb(
        args.input,
        output_path=args.output,
        verbose=not args.quiet
    )

    sys.exit(0 if metrics else 1)


if __name__ == "__main__":
    main()
