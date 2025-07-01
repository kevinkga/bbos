#!/bin/bash

# BBOS Hardware Flash Testing Script
# This script demonstrates the new hardware flashing capabilities

set -e

echo "🔧 BBOS Hardware Flash Test"
echo "=========================="
echo

# Check if backend is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Backend is not running!"
    echo "Please start the backend first:"
    echo "  cd backend && npm run dev"
    exit 1
fi

echo "✅ Backend is running"
echo

# Check hardware capabilities
echo "📋 Hardware Capabilities:"
CAPABILITIES=$(curl -s http://localhost:3001/api/hardware/capabilities)
echo "$CAPABILITIES" | python3 -m json.tool 2>/dev/null || echo "$CAPABILITIES"
echo

# Check for connected devices
echo "📱 Detecting connected devices:"
DEVICES=$(curl -s http://localhost:3001/api/hardware/devices)
echo "$DEVICES" | python3 -m json.tool 2>/dev/null || echo "$DEVICES"
echo

DEVICE_COUNT=$(echo "$DEVICES" | python3 -c "import sys, json; print(len(json.load(sys.stdin)['devices']))" 2>/dev/null || echo "0")

if [ "$DEVICE_COUNT" -eq "0" ]; then
    echo "⚠️ No Rockchip devices detected"
    echo
    echo "To flash hardware with BBOS:"
    echo "1. Connect your Rock-5B (or other Rockchip board) via USB-C"
    echo "2. Put the board in maskrom mode:"
    echo "   - Hold maskrom button while powering on"
    echo "   - OR remove eMMC/SD and power on"
    echo "3. Run this script again"
    echo
    echo "🔥 Flash Process (when device connected):"
    echo "   POST /api/hardware/flash"
    echo "   Body: { \"buildId\": \"your-build-id\", \"deviceId\": \"1\" }"
    echo
    echo "📊 Real-time Progress:"
    echo "   - WebSocket: flash:progress events"
    echo "   - REST API: GET /api/hardware/flash/{flashJobId}"
    echo
    exit 0
fi

echo "🎉 Found $DEVICE_COUNT device(s)!"
echo

# If devices are found, show example flash command
echo "🔥 Example Flash Commands:"
echo

# Get latest build
LATEST_BUILD=$(curl -s "http://localhost:3001/api/builds?limit=1" | python3 -c "import sys, json; builds = json.load(sys.stdin)['builds']; print(builds[0]['id']) if builds else print('')" 2>/dev/null || echo "")

if [ -n "$LATEST_BUILD" ]; then
    echo "Using latest build: $LATEST_BUILD"
    echo
    echo "# Flash via REST API:"
    echo "curl -X POST http://localhost:3001/api/hardware/flash \\"
    echo "  -H 'Content-Type: application/json' \\"
    echo "  -d '{\"buildId\": \"$LATEST_BUILD\", \"deviceId\": \"1\"}'"
    echo
    
    echo "# Monitor flash progress:"
    echo "curl -s http://localhost:3001/api/hardware/flash"
    echo
    
    read -p "🚀 Start flash process now? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🔥 Starting flash process..."
        FLASH_RESPONSE=$(curl -s -X POST http://localhost:3001/api/hardware/flash \
          -H 'Content-Type: application/json' \
          -d "{\"buildId\": \"$LATEST_BUILD\", \"deviceId\": \"1\"}")
        
        echo "Flash Response:"
        echo "$FLASH_RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$FLASH_RESPONSE"
        
        FLASH_JOB_ID=$(echo "$FLASH_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('flashJobId', ''))" 2>/dev/null || echo "")
        
        if [ -n "$FLASH_JOB_ID" ]; then
            echo
            echo "⏱️ Monitor progress:"
            echo "curl -s http://localhost:3001/api/hardware/flash/$FLASH_JOB_ID"
            echo
            echo "🌐 Real-time updates via WebSocket (frontend will show this automatically)"
        fi
    fi
else
    echo "⚠️ No builds found. Create a build first in the frontend!"
fi

echo
echo "🎯 Frontend Integration:"
echo "The frontend can now:"
echo "- Detect connected boards automatically"
echo "- Show 'Flash to Hardware' button on completed builds"
echo "- Display real-time flashing progress"
echo "- Handle multiple simultaneous flash operations"
echo
echo "🔧 Supported Hardware:"
echo "- Rock-5B (RK3588)"
echo "- Rock-5A (RK3588S)"  
echo "- Rock-4 series (RK3399)"
echo "- Other Rockchip boards with rkdeveloptool support" 