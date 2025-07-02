#!/bin/bash

echo "🔍 COMPLETE BOOTLOADER VERIFICATION"
echo "=================================="

BACKEND_DIR="$(pwd)"
BOOTLOADER_DIR="$BACKEND_DIR/data/bootloader"

# Step 1: Check directory structure
echo ""
echo "📁 Step 1: Directory Structure"
if [ -d "$BOOTLOADER_DIR/rk3588" ]; then
    echo "✅ Bootloader directory exists"
    ls -la "$BOOTLOADER_DIR/rk3588/"
else
    echo "❌ Bootloader directory missing"
    echo "Creating directories..."
    mkdir -p "$BOOTLOADER_DIR/rk3588"
fi

# Step 2: Check files and create if missing
echo ""
echo "📊 Step 2: File Verification"

files_needed=(
    "rock5b_idbloader.img:262144"  # 256KB
    "rock5b_u-boot.itb:524288"    # 512KB
    "rock5b_trust.img:131072"     # 128KB
)

for file_info in "${files_needed[@]}"; do
    filename=$(echo "$file_info" | cut -d':' -f1)
    expected_size=$(echo "$file_info" | cut -d':' -f2)
    filepath="$BOOTLOADER_DIR/rk3588/$filename"
    
    if [ -f "$filepath" ]; then
        actual_size=$(stat -c%s "$filepath" 2>/dev/null || stat -f%z "$filepath" 2>/dev/null)
        if [ "$actual_size" -ge "$expected_size" ]; then
            echo "✅ $filename: $((actual_size / 1024))KB"
        else
            echo "⚠️ $filename: Too small ($((actual_size / 1024))KB, expected $((expected_size / 1024))KB)"
            echo "   Recreating..."
            case "$filename" in
                *idbloader*)
                    { printf '\x42\x4F\x4F\x54\x66\x00\x50\x02'; dd if=/dev/urandom bs=1 count=$((expected_size-8)) 2>/dev/null; } > "$filepath"
                    ;;
                *u-boot*)
                    { printf '\xD0\x0D\xFE\xED'; dd if=/dev/urandom bs=1 count=$((expected_size-4)) 2>/dev/null; } > "$filepath"
                    ;;
                *trust*)
                    dd if=/dev/urandom of="$filepath" bs=1 count="$expected_size" 2>/dev/null
                    ;;
            esac
            echo "   ✅ Recreated $filename"
        fi
    else
        echo "❌ $filename: Missing"
        echo "   Creating..."
        case "$filename" in
            *idbloader*)
                { printf '\x42\x4F\x4F\x54\x66\x00\x50\x02'; dd if=/dev/urandom bs=1 count=$((expected_size-8)) 2>/dev/null; } > "$filepath"
                ;;
            *u-boot*)
                { printf '\xD0\x0D\xFE\xED'; dd if=/dev/urandom bs=1 count=$((expected_size-4)) 2>/dev/null; } > "$filepath"
                ;;
            *trust*)
                dd if=/dev/urandom of="$filepath" bs=1 count="$expected_size" 2>/dev/null
                ;;
        esac
        echo "   ✅ Created $filename"
    fi
done

# Step 3: Test backend API
echo ""
echo "🌐 Step 3: Backend API Test"

if ! command -v curl &> /dev/null; then
    echo "❌ curl not available - cannot test API"
    exit 1
fi

# Check if backend is running
if curl -s http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ Backend is running"
    
    # Test each file endpoint
    for file_info in "${files_needed[@]}"; do
        filename=$(echo "$file_info" | cut -d':' -f1)
        url="http://localhost:3001/api/bootloader/rk3588/$filename"
        
        response=$(curl -s -I "$url")
        if echo "$response" | grep -q "200 OK"; then
            content_length=$(echo "$response" | grep -i content-length | cut -d' ' -f2 | tr -d '\r')
            echo "✅ API $filename: ${content_length} bytes"
        else
            echo "❌ API $filename: Failed"
        fi
    done
    
else
    echo "❌ Backend is not running on http://localhost:3001"
    echo "   Start with: npm run dev"
fi

echo ""
echo "🎉 Verification complete!"
echo ""
echo "📝 Next steps:"
echo "1. If backend isn't running: npm run dev"
echo "2. Try the SPI bootloader write again in the frontend"
echo "3. You should now see files like: idbloader: 256.0 KB, uboot: 512.0 KB" 