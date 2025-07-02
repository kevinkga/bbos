#!/bin/bash

# Script to manually collect bootloader files from common locations
# Usage: ./collect-bootloader.sh [chip_type] [source_directory]

CHIP_TYPE=${1:-"RK3588"}
SOURCE_DIR=${2:-"/tmp/armbian-build"}
BOOTLOADER_DIR="$(pwd)/data/bootloader/${CHIP_TYPE,,}"

echo "🔍 Collecting bootloader files for $CHIP_TYPE"
echo "📁 Source directory: $SOURCE_DIR"
echo "📁 Target directory: $BOOTLOADER_DIR"

# Create target directory
mkdir -p "$BOOTLOADER_DIR"

# Function to find and copy bootloader files
collect_files() {
    local search_dir="$1"
    local file_pattern="$2"
    local target_name="$3"
    
    echo "🔍 Searching for $file_pattern in $search_dir"
    
    find "$search_dir" -name "$file_pattern" -type f 2>/dev/null | while read -r file; do
        if [ -f "$file" ]; then
            echo "✅ Found: $file"
            cp "$file" "$BOOTLOADER_DIR/$target_name"
            echo "📦 Copied to: $BOOTLOADER_DIR/$target_name"
            ls -lh "$BOOTLOADER_DIR/$target_name"
            break  # Take the first match
        fi
    done
}

# Collect bootloader files based on chip type
case "$CHIP_TYPE" in
    "RK3588")
        collect_files "$SOURCE_DIR" "*idbloader*.img" "rock5b_idbloader.img"
        collect_files "$SOURCE_DIR" "*u-boot*.itb" "rock5b_u-boot.itb"
        collect_files "$SOURCE_DIR" "*trust*.img" "rock5b_trust.img"
        ;;
    "RK3566")
        collect_files "$SOURCE_DIR" "*idbloader*.img" "rk3566_idbloader.img"
        collect_files "$SOURCE_DIR" "*u-boot*.itb" "rk3566_u-boot.itb"
        collect_files "$SOURCE_DIR" "*trust*.img" "rk3566_trust.img"
        ;;
    "RK3399")
        collect_files "$SOURCE_DIR" "*idbloader*.img" "rk3399_idbloader.img"
        collect_files "$SOURCE_DIR" "*u-boot*.itb" "rk3399_u-boot.itb"
        collect_files "$SOURCE_DIR" "*trust*.img" "rk3399_trust.img"
        ;;
    *)
        echo "❌ Unknown chip type: $CHIP_TYPE"
        echo "Supported types: RK3588, RK3566, RK3399"
        exit 1
        ;;
esac

echo "📊 Bootloader collection complete!"
echo "📁 Files in $BOOTLOADER_DIR:"
ls -lh "$BOOTLOADER_DIR/" 2>/dev/null || echo "No files collected" 