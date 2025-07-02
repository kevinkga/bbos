#!/bin/bash

echo "🔍 Verifying bootloader setup..."

BOOTLOADER_DIR="$(pwd)/data/bootloader"

echo "📁 Checking directory structure..."
if [ -d "$BOOTLOADER_DIR" ]; then
    echo "✅ Bootloader directory exists: $BOOTLOADER_DIR"
else
    echo "❌ Bootloader directory missing: $BOOTLOADER_DIR"
    exit 1
fi

echo ""
echo "📊 File inventory:"
for chip in rk3588 rk3566 rk3399; do
    echo "  $chip:"
    if [ -d "$BOOTLOADER_DIR/$chip" ]; then
        for file in "$BOOTLOADER_DIR/$chip"/*; do
            if [ -f "$file" ]; then
                size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null)
                filename=$(basename "$file")
                size_mb=$(echo "scale=1; $size / 1024 / 1024" | bc 2>/dev/null || echo "$(($size / 1024))KB")
                echo "    ✅ $filename: ${size_mb}MB"
            fi
        done
    else
        echo "    ❌ Directory missing: $BOOTLOADER_DIR/$chip"
    fi
done

echo ""
echo "🌐 Testing API endpoints..."
if command -v curl > /dev/null; then
    for chip in rk3588 rk3566 rk3399; do
        case $chip in
            rk3588) file="rock5b_idbloader.img" ;;
            rk3566) file="rk3566_idbloader.img" ;;
            rk3399) file="rk3399_idbloader.img" ;;
        esac
        
        url="http://localhost:3001/api/bootloader/$chip/$file"
        if curl -s -I "$url" | head -1 | grep -q "200 OK"; then
            echo "  ✅ $url"
        else
            echo "  ❌ $url (backend may not be running)"
        fi
    done
else
    echo "  ⚠️ curl not available - start backend and test manually"
fi

echo ""
echo "🎉 Verification complete!" 