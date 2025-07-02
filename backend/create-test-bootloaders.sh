#!/bin/bash

# Quick script to create test bootloader files
BOOTLOADER_DIR="$(pwd)/data/bootloader"

echo "🚀 Creating test bootloader files..."

# Create directories
mkdir -p "$BOOTLOADER_DIR/rk3588"
mkdir -p "$BOOTLOADER_DIR/rk3566" 
mkdir -p "$BOOTLOADER_DIR/rk3399"

# Create realistic-sized test files for RK3588
echo "🔧 Creating RK3588 test bootloader files..."

# Create idbloader with proper Rockchip header (256KB)
{
    printf '\x42\x4F\x4F\x54'  # "BOOT" magic
    printf '\x66\x00\x50\x02'  # Additional header data
    dd if=/dev/urandom bs=1 count=$((256*1024-8)) 2>/dev/null
} > "$BOOTLOADER_DIR/rk3588/rock5b_idbloader.img"

# Create u-boot.itb with FIT image header (512KB)
{
    printf '\xD0\x0D\xFE\xED'  # FIT magic (big-endian)
    dd if=/dev/urandom bs=1 count=$((512*1024-4)) 2>/dev/null
} > "$BOOTLOADER_DIR/rk3588/rock5b_u-boot.itb"

# Create trust.img (128KB)
dd if=/dev/urandom of="$BOOTLOADER_DIR/rk3588/rock5b_trust.img" bs=1024 count=128 2>/dev/null

echo "✅ Created RK3588 bootloader files:"
ls -lh "$BOOTLOADER_DIR/rk3588/"

# Create RK3566 test files
echo "🔧 Creating RK3566 test bootloader files..."
{
    printf '\x42\x4F\x4F\x54'
    printf '\x66\x00\x50\x02'
    dd if=/dev/urandom bs=1 count=$((256*1024-8)) 2>/dev/null
} > "$BOOTLOADER_DIR/rk3566/rk3566_idbloader.img"

{
    printf '\xD0\x0D\xFE\xED'
    dd if=/dev/urandom bs=1 count=$((512*1024-4)) 2>/dev/null
} > "$BOOTLOADER_DIR/rk3566/rk3566_u-boot.itb"

dd if=/dev/urandom of="$BOOTLOADER_DIR/rk3566/rk3566_trust.img" bs=1024 count=128 2>/dev/null

echo "✅ Created RK3566 bootloader files:"
ls -lh "$BOOTLOADER_DIR/rk3566/"

# Create RK3399 test files  
echo "🔧 Creating RK3399 test bootloader files..."
{
    printf '\x42\x4F\x4F\x54'
    printf '\x66\x00\x50\x02'
    dd if=/dev/urandom bs=1 count=$((256*1024-8)) 2>/dev/null
} > "$BOOTLOADER_DIR/rk3399/rk3399_idbloader.img"

{
    printf '\xD0\x0D\xFE\xED'
    dd if=/dev/urandom bs=1 count=$((512*1024-4)) 2>/dev/null
} > "$BOOTLOADER_DIR/rk3399/rk3399_u-boot.itb"

dd if=/dev/urandom of="$BOOTLOADER_DIR/rk3399/rk3399_trust.img" bs=1024 count=128 2>/dev/null

echo "✅ Created RK3399 bootloader files:"
ls -lh "$BOOTLOADER_DIR/rk3399/"

echo ""
echo "🎉 All test bootloader files created successfully!"
echo "📊 Summary:"
find "$BOOTLOADER_DIR" -name "*.img" -o -name "*.itb" | while read -r file; do
    size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
    echo "  $file: $(numfmt --to=iec "$size" 2>/dev/null || echo "${size} bytes")"
done

echo ""
echo "🚀 Backend bootloader files are ready!"
echo "🔗 Test the API:"
echo "   curl -I http://localhost:3001/api/bootloader/rk3588/rock5b_idbloader.img" 