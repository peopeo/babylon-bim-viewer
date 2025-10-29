#!/bin/bash

# glTF-Transform Instancing Test Script
# Tests GPU instancing optimization on compressed GLB files

set -e

echo "=========================================="
echo "glTF-Transform Instancing Tests"
echo "=========================================="
echo ""

# Test on Level 2 (best compression without simplification)
INPUT_FILE="public/models/compressed_level2_medium.glb"
OUTPUT_FILE="public/models/compressed_level2_instanced.glb"

if [ ! -f "$INPUT_FILE" ]; then
    echo "Error: Input file not found: $INPUT_FILE"
    exit 1
fi

BASELINE_SIZE=$(stat -c%s "$INPUT_FILE")

echo "Input file: $INPUT_FILE"
echo "Input size: $(numfmt --to=iec-i --suffix=B $BASELINE_SIZE)"
echo ""

echo "----------------------------------------"
echo "Running glTF-Transform Instancing"
echo "----------------------------------------"
echo "Applying optimizations:"
echo "  --instance true     : GPU instancing for repeated meshes"
echo "  --instance-min 2    : Instance even with 2+ duplicates"
echo "  --compress meshopt  : Meshopt compression"
echo "  --prune true        : Remove unused nodes/meshes"
echo "  --join true         : Join meshes to reduce draw calls"
echo "  --weld true         : Merge equivalent vertices"
echo ""

time gltf-transform optimize "$INPUT_FILE" "$OUTPUT_FILE" \
  --instance true \
  --instance-min 2 \
  --compress meshopt \
  --prune true \
  --join true \
  --weld true \
  --verbose

echo ""
echo "----------------------------------------"
echo "Results"
echo "----------------------------------------"

INSTANCED_SIZE=$(stat -c%s "$OUTPUT_FILE")
COMPRESSION_RATIO=$(awk "BEGIN {printf \"%.2f\", $BASELINE_SIZE/$INSTANCED_SIZE}")
SIZE_REDUCTION=$(awk "BEGIN {printf \"%.1f\", (1 - $INSTANCED_SIZE/$BASELINE_SIZE) * 100}")

echo "Original (compressed):  $(numfmt --to=iec-i --suffix=B $BASELINE_SIZE)"
echo "After instancing:       $(numfmt --to=iec-i --suffix=B $INSTANCED_SIZE)"
echo "Compression ratio:      ${COMPRESSION_RATIO}x"
echo "Size reduction:         ${SIZE_REDUCTION}%"
echo ""

# Use gltf-transform to get detailed stats
echo "----------------------------------------"
echo "Detailed Statistics (Before)"
echo "----------------------------------------"
gltf-transform inspect "$INPUT_FILE" 2>/dev/null | grep -E "meshes|primitives|materials|instances|triangles|vertices" || echo "Stats not available"

echo ""
echo "----------------------------------------"
echo "Detailed Statistics (After)"
echo "----------------------------------------"
gltf-transform inspect "$OUTPUT_FILE" 2>/dev/null | grep -E "meshes|primitives|materials|instances|triangles|vertices" || echo "Stats not available"

echo ""
echo "=========================================="
echo "COMPLETE!"
echo "=========================================="
echo "Load the instanced model in the viewer to test:"
echo "  File: /models/compressed_level2_instanced.glb"
echo ""
echo "Expected improvements:"
echo "  - Reduced file size"
echo "  - Fewer draw calls (instanced meshes)"
echo "  - Lower memory usage"
echo "  - Better FPS"
echo "=========================================="
