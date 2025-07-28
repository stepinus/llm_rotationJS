#!/bin/bash

# Build the Docker image
echo "Building LLM Rotation Server Docker image..."
docker build -t llm-rotation-server .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo ""
    echo "To run the container:"
    echo "  docker run -p 3000:3000 llm-rotation-server"
    echo ""
    echo "Or use docker-compose:"
    echo "  docker-compose up"
    echo ""
    echo "Don't forget to set your API keys as environment variables!"
else
    echo "❌ Docker build failed!"
    exit 1
fi