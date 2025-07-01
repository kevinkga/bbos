#!/bin/bash

# BBOS Real Build Test Script
# This script tests real Armbian image downloading (not demo mode)

set -e

echo "🧪 BBOS Real Build Test"
echo "========================"
echo

# Check if backend is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo "❌ Backend is not running!"
    echo "Please start the backend first:"
    echo "  cd backend && npm run dev"
    exit 1
fi

# Get current configuration
echo "📋 Current backend configuration:"
curl -s http://localhost:3001/health | jq '.buildSystem' 2>/dev/null || {
    echo "⚠️ Could not parse backend response (jq not available)"
    curl -s http://localhost:3001/health
}
echo

# Check if we're in demo mode
DEMO_MODE=$(curl -s http://localhost:3001/health | jq -r '.buildSystem.demoMode' 2>/dev/null || echo "unknown")

if [ "$DEMO_MODE" = "true" ]; then
    echo "🎭 Currently in DEMO MODE"
    echo "To test real image downloads, you need to:"
    echo "  1. Create .env file: echo 'DEMO_MODE=false' > .env"
    echo "  2. Restart backend: npm run dev"
    echo "  3. Run this script again"
    echo
    echo "⚠️ Real mode requirements:"
    echo "  - Internet connection"
    echo "  - 5GB+ free disk space"
    echo "  - sudo access (for image mounting)"
    echo "  - kpartx utility installed"
    echo
    exit 0
fi

echo "🚀 PRODUCTION MODE DETECTED - Testing real downloads..."
echo

# Check disk space
AVAILABLE_SPACE=$(df /tmp | awk 'NR==2 {print $4}')
REQUIRED_SPACE=5242880  # 5GB in KB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    echo "⚠️ Warning: Low disk space detected"
    echo "   Available: $(($AVAILABLE_SPACE / 1024 / 1024))GB"
    echo "   Recommended: 5GB+"
    echo
fi

# Check required utilities
echo "🔧 Checking system requirements..."

if ! command -v kpartx &> /dev/null; then
    echo "❌ kpartx not found - install with: sudo apt install kpartx"
    exit 1
fi

if ! sudo -n true 2>/dev/null; then
    echo "⚠️ sudo access required for image mounting"
    echo "You may be prompted for your password during the build"
fi

echo "✅ System requirements OK"
echo

# Test a small build
echo "🎯 Starting test build with real download..."
echo "This will download a real Armbian image (~500MB-2GB)"
echo

read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Test cancelled"
    exit 0
fi

echo "🚀 Build test starting..."
echo "Monitor progress in your frontend or check backend logs"
echo "This may take 10-30 minutes depending on internet speed"
echo

# Create test configuration
TEST_CONFIG='{
  "name": "BBOS-Test-Build",
  "description": "Test build to verify real image downloads",
  "board": {
    "family": "rockchip64", 
    "name": "rock-5b",
    "architecture": "arm64"
  },
  "distribution": {
    "release": "bookworm",
    "type": "minimal"
  }
}'

# Submit test build via API
echo "📡 Submitting test build..."
BUILD_RESPONSE=$(curl -s -X POST http://localhost:3001/api/builds \
  -H "Content-Type: application/json" \
  -d "{\"configuration\": $TEST_CONFIG}")

BUILD_ID=$(echo "$BUILD_RESPONSE" | jq -r '.buildId' 2>/dev/null || echo "unknown")

if [ "$BUILD_ID" = "unknown" ] || [ "$BUILD_ID" = "null" ]; then
    echo "❌ Failed to submit build:"
    echo "$BUILD_RESPONSE"
    exit 1
fi

echo "✅ Test build submitted!"
echo "   Build ID: $BUILD_ID"
echo "   Monitor in frontend or backend logs"
echo
echo "Expected timeline:"
echo "  - Download: 5-20 minutes (depending on internet)"
echo "  - Processing: 2-5 minutes"
echo "  - Total: 10-30 minutes"
echo
echo "🎉 Test complete! Check your frontend to see the build progress." 