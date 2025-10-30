#!/usr/bin/env python3
"""
Compare two GLB files to find differences
"""

import sys
import json
import struct
from pathlib import Path

def extract_gltf_json(glb_path):
    """Extract the JSON chunk from a GLB file"""
    with open(glb_path, 'rb') as f:
        # Read GLB header
        magic = f.read(4)
        version = struct.unpack('<I', f.read(4))[0]
        length = struct.unpack('<I', f.read(4))[0]

        # Read JSON chunk
        chunk_length = struct.unpack('<I', f.read(4))[0]
        chunk_type = f.read(4)

        if chunk_type == b'JSON':
            json_data = f.read(chunk_length).decode('utf-8')
            return json.loads(json_data)
    return None

def compare_glbs(file1, file2):
    """Compare two GLB files"""
    print("=" * 80)
    print(f"COMPARING GLB FILES")
    print("=" * 80)

    print(f"\nFile 1: {file1}")
    print(f"File 2: {file2}")

    # File sizes
    size1 = Path(file1).stat().st_size / (1024**2)
    size2 = Path(file2).stat().st_size / (1024**2)
    print(f"\nFile Sizes:")
    print(f"  File 1: {size1:.2f} MB")
    print(f"  File 2: {size2:.2f} MB")
    print(f"  Difference: {abs(size1 - size2):.2f} MB")

    # Extract JSON
    print("\nExtracting glTF JSON data...")
    gltf1 = extract_gltf_json(file1)
    gltf2 = extract_gltf_json(file2)

    if not gltf1 or not gltf2:
        print("ERROR: Could not extract glTF data")
        return

    # Compare structure
    print("\n" + "=" * 80)
    print("STRUCTURE COMPARISON")
    print("=" * 80)

    # Check asset info
    if 'asset' in gltf1 and 'asset' in gltf2:
        print("\nAsset Info:")
        print(f"  File 1 generator: {gltf1['asset'].get('generator', 'Unknown')}")
        print(f"  File 2 generator: {gltf2['asset'].get('generator', 'Unknown')}")

    # Compare counts
    keys_to_compare = ['meshes', 'materials', 'nodes', 'accessors', 'bufferViews', 'buffers']

    print("\nElement Counts:")
    for key in keys_to_compare:
        count1 = len(gltf1.get(key, []))
        count2 = len(gltf2.get(key, []))
        diff = count2 - count1
        diff_str = f"({diff:+d})" if diff != 0 else ""
        print(f"  {key:15s}: File1={count1:5d}, File2={count2:5d} {diff_str}")

    # Compare scenes
    if 'scenes' in gltf1 and 'scenes' in gltf2:
        print(f"\nScenes: File1={len(gltf1['scenes'])}, File2={len(gltf2['scenes'])}")

    # Check for extensions
    print("\nExtensions:")
    ext1 = set(gltf1.get('extensionsUsed', []))
    ext2 = set(gltf2.get('extensionsUsed', []))

    print(f"  File 1: {', '.join(ext1) if ext1 else 'None'}")
    print(f"  File 2: {', '.join(ext2) if ext2 else 'None'}")

    if ext1 != ext2:
        only_in_1 = ext1 - ext2
        only_in_2 = ext2 - ext1
        if only_in_1:
            print(f"  Only in File 1: {', '.join(only_in_1)}")
        if only_in_2:
            print(f"  Only in File 2: {', '.join(only_in_2)}")

    # Sample first few nodes for coordinate differences
    print("\n" + "=" * 80)
    print("NODE TRANSLATION SAMPLES (First 10 nodes with translations)")
    print("=" * 80)

    nodes1 = gltf1.get('nodes', [])
    nodes2 = gltf2.get('nodes', [])

    print("\nFile 1 translations:")
    count = 0
    for i, node in enumerate(nodes1[:100]):
        if 'translation' in node:
            trans = node['translation']
            print(f"  Node {i}: ({trans[0]:.3f}, {trans[1]:.3f}, {trans[2]:.3f})")
            count += 1
            if count >= 10:
                break
    if count == 0:
        print("  (No translations found in first 100 nodes)")

    print("\nFile 2 translations:")
    count = 0
    for i, node in enumerate(nodes2[:100]):
        if 'translation' in node:
            trans = node['translation']
            print(f"  Node {i}: ({trans[0]:.3f}, {trans[1]:.3f}, {trans[2]:.3f})")
            count += 1
            if count >= 10:
                break
    if count == 0:
        print("  (No translations found in first 100 nodes)")

    # Check accessor min/max (vertex bounds)
    print("\n" + "=" * 80)
    print("ACCESSOR BOUNDS SAMPLE (First 5 POSITION accessors)")
    print("=" * 80)

    def print_accessor_bounds(gltf, label):
        print(f"\n{label}:")
        accessors = gltf.get('accessors', [])
        count = 0
        for i, accessor in enumerate(accessors):
            if accessor.get('type') == 'VEC3' and 'min' in accessor and 'max' in accessor:
                min_val = accessor['min']
                max_val = accessor['max']
                print(f"  Accessor {i}: min=({min_val[0]:.2f}, {min_val[1]:.2f}, {min_val[2]:.2f}), max=({max_val[0]:.2f}, {max_val[1]:.2f}, {max_val[2]:.2f})")
                count += 1
                if count >= 5:
                    break
        if count == 0:
            print("  (No VEC3 accessors with min/max found)")

    print_accessor_bounds(gltf1, "File 1")
    print_accessor_bounds(gltf2, "File 2")

    print("\n" + "=" * 80)
    print("COMPARISON COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python compare_glb.py <file1.glb> <file2.glb>")
        sys.exit(1)

    compare_glbs(sys.argv[1], sys.argv[2])
