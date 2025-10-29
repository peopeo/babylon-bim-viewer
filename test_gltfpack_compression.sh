#!/bin/bash

# gltfpack Compression Test Script
# Tests 3 compression levels on the baseline GLB file

INPUT_FILE="mbn_1586_011_p5_xar7_150_3d_xx_ar_Architekturmodell_aw0_o.glb"
BASELINE_SIZE=$(stat -c%s "$INPUT_FILE")

echo "=========================================="
echo "gltfpack Compression Tests"
echo "=========================================="
echo "Baseline file: $INPUT_FILE"
echo "Baseline size: $(numfmt --to=iec-i --suffix=B $BASELINE_SIZE)"
echo ""

# Level 1: Low compression (fast, basic optimization)
echo "----------------------------------------"
echo "Level 1: Low Compression (-c)"
echo "----------------------------------------"
echo "Running gltfpack with basic compression..."
time gltfpack -i "$INPUT_FILE" -o "compressed_level1_low.glb" -c -v

LEVEL1_SIZE=$(stat -c%s "compressed_level1_low.glb")
LEVEL1_RATIO=$(awk "BEGIN {printf \"%.2f\", $BASELINE_SIZE/$LEVEL1_SIZE}")
echo "Level 1 size: $(numfmt --to=iec-i --suffix=B $LEVEL1_SIZE)"
echo "Compression ratio: ${LEVEL1_RATIO}x"
echo ""

# Level 2: Medium compression (balanced)
echo "----------------------------------------"
echo "Level 2: Medium Compression (-cc)"
echo "----------------------------------------"
echo "Running gltfpack with higher compression..."
time gltfpack -i "$INPUT_FILE" -o "compressed_level2_medium.glb" -cc -v

LEVEL2_SIZE=$(stat -c%s "compressed_level2_medium.glb")
LEVEL2_RATIO=$(awk "BEGIN {printf \"%.2f\", $BASELINE_SIZE/$LEVEL2_SIZE}")
echo "Level 2 size: $(numfmt --to=iec-i --suffix=B $LEVEL2_SIZE)"
echo "Compression ratio: ${LEVEL2_RATIO}x"
echo ""

# Level 3: High compression (aggressive, smaller file, mesh simplification)
echo "----------------------------------------"
echo "Level 3: High Compression (-cc + simplification)"
echo "----------------------------------------"
echo "Running gltfpack with aggressive compression and 5% mesh simplification..."
time gltfpack -i "$INPUT_FILE" -o "compressed_level3_high.glb" -cc -si 0.95 -v

LEVEL3_SIZE=$(stat -c%s "compressed_level3_high.glb")
LEVEL3_RATIO=$(awk "BEGIN {printf \"%.2f\", $BASELINE_SIZE/$LEVEL3_SIZE}")
echo "Level 3 size: $(numfmt --to=iec-i --suffix=B $LEVEL3_SIZE)"
echo "Compression ratio: ${LEVEL3_RATIO}x"
echo ""

# Summary
echo "=========================================="
echo "COMPRESSION SUMMARY"
echo "=========================================="
echo "Baseline:     $(numfmt --to=iec-i --suffix=B $BASELINE_SIZE) (1.00x)"
echo "Level 1 Low:  $(numfmt --to=iec-i --suffix=B $LEVEL1_SIZE) (${LEVEL1_RATIO}x compression)"
echo "Level 2 Med:  $(numfmt --to=iec-i --suffix=B $LEVEL2_SIZE) (${LEVEL2_RATIO}x compression)"
echo "Level 3 High: $(numfmt --to=iec-i --suffix=B $LEVEL3_SIZE) (${LEVEL3_RATIO}x compression)"
echo "=========================================="
