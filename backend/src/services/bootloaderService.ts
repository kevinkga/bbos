import fs from 'fs/promises';
import path from 'path';

export interface BootloaderFile {
  filename: string;
  path: string;
  size: number;
  chipType: string;
  type: 'idbloader' | 'uboot' | 'trust' | 'loader';
}

export class BootloaderService {
  private readonly bootloaderDir: string;

  constructor() {
    this.bootloaderDir = path.join(process.cwd(), 'data', 'bootloader');
    this.ensureBootloaderDir();
  }

  private async ensureBootloaderDir(): Promise<void> {
    try {
      await fs.mkdir(this.bootloaderDir, { recursive: true });
      console.log('📁 Bootloader directory ensured:', this.bootloaderDir);
    } catch (error) {
      console.error('❌ Failed to create bootloader directory:', error);
    }
  }

  // Serve bootloader file for specific chip type - NO fallback creation
  async getBootloaderFile(chipType: string, filename: string): Promise<Buffer | null> {
    try {
      const chipDir = path.join(this.bootloaderDir, chipType.toLowerCase());
      const filePath = path.join(chipDir, filename);
      
      console.log(`📁 Looking for bootloader file: ${filePath}`);
      
      // Check if file exists
      try {
        await fs.access(filePath);
      } catch {
        console.log(`❌ Bootloader file not found: ${filePath}`);
        console.log(`💡 To fix this issue:`);
        console.log(`   1. Run: cd backend && npm run setup-bootloaders`);
        console.log(`   2. Or manually place real bootloader files in: ${chipDir}/`);
        console.log(`   3. Required files: ${filename}`);
        return null;
      }
      
      const fileBuffer = await fs.readFile(filePath);
      
      // Validate that this is a real bootloader file, not a placeholder
      if (fileBuffer.length < 50 * 1024) {
        console.log(`❌ Bootloader file too small (${(fileBuffer.length / 1024).toFixed(1)}KB): ${filePath}`);
        console.log(`💡 This appears to be a placeholder file. Real bootloader files should be much larger.`);
        return null;
      }
      
      console.log(`✅ Served bootloader file: ${filename} (${fileBuffer.length} bytes)`);
      return fileBuffer;
      
    } catch (error) {
      console.error('❌ Error serving bootloader file:', error);
      return null;
    }
  }

  // Store bootloader file from build process
  async storeBootloaderFile(chipType: string, filename: string, fileBuffer: Buffer): Promise<void> {
    try {
      const chipDir = path.join(this.bootloaderDir, chipType.toLowerCase());
      await fs.mkdir(chipDir, { recursive: true });
      
      const filePath = path.join(chipDir, filename);
      await fs.writeFile(filePath, fileBuffer);
      
      console.log(`✅ Stored bootloader file: ${filePath} (${fileBuffer.length} bytes)`);
    } catch (error) {
      console.error('❌ Error storing bootloader file:', error);
      throw error;
    }
  }

  // Copy bootloader files from build output
  async collectBootloaderFromBuild(buildId: string, chipType: string): Promise<void> {
    console.log(`🔍 Collecting bootloader files for ${chipType} from build ${buildId}`);
    
    try {
      // Define potential bootloader file patterns for different chip types
      const bootloaderPatterns = this.getBootloaderPatternsForChip(chipType);
      
      // Look in common Armbian build output locations
      const buildPaths = [
        path.join(process.cwd(), 'builds', buildId, 'output', 'debs'),
        path.join(process.cwd(), 'builds', buildId, 'output', 'images'),
        path.join(process.cwd(), 'builds', buildId, 'cache', 'sources', 'u-boot'),
        path.join('/tmp', 'armbian-build', 'output', 'debs'),
        path.join('/tmp', 'armbian-build', 'output', 'images'),
      ];

      for (const buildPath of buildPaths) {
        if (await this.pathExists(buildPath)) {
          console.log(`🔍 Scanning build path: ${buildPath}`);
          await this.scanForBootloaderFiles(buildPath, chipType, bootloaderPatterns);
        }
      }
      
    } catch (error) {
      console.error('❌ Error collecting bootloader files:', error);
    }
  }

  // Get bootloader file patterns for specific chip types
  private getBootloaderPatternsForChip(chipType: string): { pattern: RegExp; type: string; targetName: string }[] {
    const patterns: { pattern: RegExp; type: string; targetName: string }[] = [];
    
    switch (chipType.toUpperCase()) {
      case 'RK3588':
        patterns.push(
          { pattern: /.*idbloader.*\.img$/i, type: 'idbloader', targetName: 'rock5b_idbloader.img' },
          { pattern: /.*u-boot.*\.itb$/i, type: 'uboot', targetName: 'rock5b_u-boot.itb' },
          { pattern: /.*trust.*\.img$/i, type: 'trust', targetName: 'rock5b_trust.img' }
        );
        break;
      case 'RK3566':
        patterns.push(
          { pattern: /.*idbloader.*\.img$/i, type: 'idbloader', targetName: 'rk3566_idbloader.img' },
          { pattern: /.*u-boot.*\.itb$/i, type: 'uboot', targetName: 'rk3566_u-boot.itb' },
          { pattern: /.*trust.*\.img$/i, type: 'trust', targetName: 'rk3566_trust.img' }
        );
        break;
      case 'RK3399':
        patterns.push(
          { pattern: /.*idbloader.*\.img$/i, type: 'idbloader', targetName: 'rk3399_idbloader.img' },
          { pattern: /.*u-boot.*\.itb$/i, type: 'uboot', targetName: 'rk3399_u-boot.itb' },
          { pattern: /.*trust.*\.img$/i, type: 'trust', targetName: 'rk3399_trust.img' }
        );
        break;
      default:
        console.warn(`⚠️ No bootloader patterns defined for chip type: ${chipType}`);
    }
    
    return patterns;
  }

  // Scan directory for bootloader files
  private async scanForBootloaderFiles(
    scanPath: string, 
    chipType: string, 
    patterns: { pattern: RegExp; type: string; targetName: string }[]
  ): Promise<void> {
    try {
      const files = await fs.readdir(scanPath, { recursive: true });
      
      for (const file of files) {
        const filePath = path.join(scanPath, file.toString());
        const fileName = path.basename(file.toString());
        
        // Check if this file matches any of our patterns
        for (const { pattern, type, targetName } of patterns) {
          if (pattern.test(fileName)) {
            console.log(`✅ Found ${type} bootloader file: ${fileName}`);
            
            try {
              const fileBuffer = await fs.readFile(filePath);
              await this.storeBootloaderFile(chipType, targetName, fileBuffer);
              console.log(`📦 Collected ${type} bootloader: ${targetName}`);
            } catch (error) {
              console.error(`❌ Error copying bootloader file ${fileName}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error(`❌ Error scanning ${scanPath}:`, error);
    }
  }

  // List available bootloader files
  async listBootloaderFiles(): Promise<BootloaderFile[]> {
    const files: BootloaderFile[] = [];
    
    try {
      const chipTypes = await fs.readdir(this.bootloaderDir);
      
      for (const chipType of chipTypes) {
        const chipDir = path.join(this.bootloaderDir, chipType);
        const chipFiles = await fs.readdir(chipDir);
        
        for (const filename of chipFiles) {
          const filePath = path.join(chipDir, filename);
          const stats = await fs.stat(filePath);
          
          files.push({
            filename,
            path: filePath,
            size: stats.size,
            chipType,
            type: this.detectBootloaderType(filename)
          });
        }
      }
    } catch (error) {
      console.error('❌ Error listing bootloader files:', error);
    }
    
    return files;
  }

  private detectBootloaderType(filename: string): 'idbloader' | 'uboot' | 'trust' | 'loader' {
    if (filename.includes('idbloader')) return 'idbloader';
    if (filename.includes('u-boot')) return 'uboot';
    if (filename.includes('trust')) return 'trust';
    return 'loader';
  }

  private async pathExists(path: string): Promise<boolean> {
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  }
} 