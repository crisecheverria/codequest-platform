#!/bin/bash

# Build optimized Go runner Docker image with performance enhancements

set -e

echo "🏗️  Building optimized Go challenge execution environment..."

# Build the Go executor binary
echo "📦 Building Go executor binary..."
cd go-executor
go build -ldflags "-s -w" -o go-executor executor.go
echo "✅ Go executor binary built successfully"

# Build the Docker image
echo "🐳 Building Docker image: go-runner..."
cd ..
docker build -t go-runner -f Dockerfile.go-runner .

echo "📊 Docker image built. Checking size..."
docker images go-runner

echo "🧹 Creating Docker volumes for persistent cache..."
docker volume create go-mod-cache 2>/dev/null || echo "Volume go-mod-cache already exists"
docker volume create go-build-cache 2>/dev/null || echo "Volume go-build-cache already exists"

echo "✅ Optimized Go runner environment ready!"
echo ""
echo "🚀 Performance optimizations applied:"
echo "   - Persistent Go module and build cache"
echo "   - Pre-warmed dependencies"
echo "   - Optimized build flags (-ldflags -s -w)"
echo "   - Increased memory and CPU limits for production"
echo "   - Faster compilation timeouts"
echo ""
echo "💡 To use in production, set these environment variables:"
echo "   NODE_ENV=production"
echo "   DOCKER_MEMORY_LIMIT=512m"
echo "   DOCKER_CPU_QUOTA=200000" 
echo "   DOCKER_GO_TIMEOUT=120000"
echo "   USE_NATIVE_GO_EXECUTOR=true"