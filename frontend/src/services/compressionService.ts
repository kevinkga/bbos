// Modern compression/decompression service optimized for image transfers
import { inflate } from 'pako'; // Fast gzip decompression

interface CompressionProgress {
  progress: number; // 0-100
  decompressedBytes: number;
  totalBytes?: number;
  speed: number; // MB/s
}

interface CompressionCapabilities {
  brotli: boolean;
  gzip: boolean;
  streaming: boolean;
  webAssembly: boolean;
  recommended: 'http' | 'streaming' | 'custom';
}

class CompressionService {
  private capabilities: CompressionCapabilities;

  constructor() {
    this.capabilities = this.detectCapabilities();
    console.log(`🔧 Compression capabilities:`, this.capabilities);
  }

  /**
   * Detect browser compression capabilities
   */
  private detectCapabilities(): CompressionCapabilities {
    const brotli = 'CompressionStream' in window && 
                   new CompressionStream('deflate-raw') !== undefined;
    const gzip = 'CompressionStream' in window;
    const streaming = 'ReadableStream' in window && 'DecompressionStream' in window;
    const webAssembly = typeof WebAssembly !== 'undefined';

    // Determine best strategy
    let recommended: 'http' | 'streaming' | 'custom' = 'http';
    if (streaming) {
      recommended = 'streaming';
    } else if (webAssembly) {
      recommended = 'custom';
    }

    return { brotli, gzip, streaming, webAssembly, recommended };
  }

  /**
   * Download image with optimal compression strategy
   * 
   * For most cases, this will use standard HTTP compression (brotli/gzip)
   * which is automatically handled by the browser.
   */
  async downloadImage(
    buildId: string,
    artifactName: string,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<Uint8Array> {
    
    // Strategy 1: Use standard HTTP compression (recommended for most cases)
    if (this.capabilities.recommended === 'http') {
      return this.downloadWithHTTPCompression(buildId, artifactName, onProgress);
    }
    
    // Strategy 2: Use streaming decompression for custom compressed files
    if (this.capabilities.recommended === 'streaming') {
      return this.downloadWithStreamingDecompression(buildId, artifactName, onProgress);
    }
    
    // Strategy 3: Custom decompression (fallback)
    return this.downloadWithCustomDecompression(buildId, artifactName, onProgress);
  }

  /**
   * Standard HTTP compression - let the browser handle it
   * This is usually the most efficient approach
   */
  private async downloadWithHTTPCompression(
    buildId: string,
    artifactName: string,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<Uint8Array> {
    console.log(`📦 Using standard HTTP compression for ${artifactName}`);
    
    const url = `/api/builds/${buildId}/artifacts/${artifactName}`;
    const startTime = Date.now();
    
    const response = await fetch(url, {
      headers: {
        // Request the best compression the server supports
        'Accept-Encoding': 'br, gzip, deflate',
        // Prevent any custom compression
        'X-No-Custom-Compression': '1'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const reader = response.body!.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        totalBytes += value.length;

        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = totalBytes / (1024 * 1024) / elapsed;
          
          onProgress({
            progress: contentLength > 0 ? Math.min(100, (totalBytes / contentLength) * 100) : 50,
            decompressedBytes: totalBytes,
            totalBytes: contentLength,
            speed
          });
        }
      }
    } finally {
      reader.releaseLock();
    }

    // Combine chunks
    const result = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`✅ HTTP compression download complete: ${this.formatBytes(totalBytes)}`);
    return result;
  }

  /**
   * Streaming decompression for modern browsers
   */
  private async downloadWithStreamingDecompression(
    buildId: string,
    artifactName: string,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<Uint8Array> {
    console.log(`⚡ Using streaming decompression for ${artifactName}`);
    
    const url = `/api/builds/${buildId}/artifacts/${artifactName}/compressed`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0');
    const startTime = Date.now();
    let downloadedBytes = 0;
    
    // Create decompression stream
    const decompressedStream = response.body!.pipeThrough(
      new DecompressionStream('gzip')
    );

    const reader = decompressedStream.getReader();
    const chunks: Uint8Array[] = [];
    let totalDecompressed = 0;

    try {
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        chunks.push(value);
        totalDecompressed += value.length;
        downloadedBytes += value.length;
        
        if (onProgress) {
          const elapsed = (Date.now() - startTime) / 1000;
          const speed = totalDecompressed / (1024 * 1024) / elapsed;
          
          onProgress({
            progress: contentLength > 0 ? Math.min(95, (downloadedBytes / contentLength) * 100) : 50,
            decompressedBytes: totalDecompressed,
            totalBytes: contentLength,
            speed
          });
        }
      }
    } finally {
      reader.releaseLock();
    }

    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`✅ Streaming decompression complete: ${this.formatBytes(totalLength)}`);
    return result;
  }

  /**
   * Custom decompression fallback
   */
  private async downloadWithCustomDecompression(
    buildId: string,
    artifactName: string,
    onProgress?: (progress: CompressionProgress) => void
  ): Promise<Uint8Array> {
    console.log(`🚀 Using custom decompression for ${artifactName}`);
    
    const url = `/api/builds/${buildId}/artifacts/${artifactName}/compressed`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const compressedData = await response.arrayBuffer();
    const startTime = Date.now();
    
    const result = inflate(new Uint8Array(compressedData));
    
    const elapsed = (Date.now() - startTime) / 1000;
    const speed = result.length / (1024 * 1024) / elapsed;
    
    if (onProgress) {
      onProgress({
        progress: 100,
        decompressedBytes: result.length,
        totalBytes: compressedData.byteLength,
        speed
      });
    }
    
    console.log(`✅ Custom decompression complete: ${this.formatBytes(result.length)} in ${elapsed.toFixed(1)}s`);
    return result;
  }

  /**
   * Get compression capabilities and recommendations
   */
  getCapabilities(): CompressionCapabilities & { recommendation: string } {
    let recommendation = '';
    
    switch (this.capabilities.recommended) {
      case 'http':
        recommendation = 'Using standard HTTP compression (brotli/gzip) - most efficient';
        break;
      case 'streaming':
        recommendation = 'Using browser streaming decompression - good for large files';
        break;
      case 'custom':
        recommendation = 'Using JavaScript decompression - universal fallback';
        break;
    }

    return { ...this.capabilities, recommendation };
  }

  /**
   * Format bytes for display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Export singleton instance
export const compressionService = new CompressionService();
export type { CompressionProgress, CompressionCapabilities }; 