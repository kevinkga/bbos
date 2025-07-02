import React, { useState, useEffect } from 'react';
import { WebSerialFlasher, SerialDevice, FlashProgressWeb, webSerialSupported } from '../services/webSerialFlasher';

interface Build {
  id: string;
  name: string;
  status: string;
  outputPath?: string;
  size?: number;
}

interface BackendDevice {
  id: string;
  type: string;
  chipInfo?: string;
}

interface HardwareFlashPanelProps {
  builds: Build[];
  onRefresh?: () => void;
}

export const HardwareFlashPanel: React.FC<HardwareFlashPanelProps> = ({ builds, onRefresh }) => {
  const [selectedBuild, setSelectedBuild] = useState<string>('');
  const [backendDevices, setBackendDevices] = useState<BackendDevice[]>([]);
  const [serialDevices, setSerialDevices] = useState<SerialDevice[]>([]);
  const [flashMethod, setFlashMethod] = useState<'backend' | 'browser'>('backend');
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<FlashProgressWeb | null>(null);
  
  const webSerialFlasher = new WebSerialFlasher();

  // Fetch backend devices
  const fetchBackendDevices = async () => {
    try {
      const response = await fetch('/api/hardware/devices');
      const data = await response.json();
      setBackendDevices(data.devices || []);
    } catch (error) {
      console.error('Failed to fetch backend devices:', error);
    }
  };

  // Fetch serial devices (browser)
  const fetchSerialDevices = async () => {
    if (!webSerialSupported) return;
    
    try {
      const devices = await webSerialFlasher.getAvailableDevices();
      setSerialDevices(devices);
    } catch (error) {
      console.error('Failed to fetch serial devices:', error);
    }
  };

  useEffect(() => {
    fetchBackendDevices();
    fetchSerialDevices();
  }, []);

  // Handle backend flashing
  const handleBackendFlash = async (deviceId: string) => {
    if (!selectedBuild) return;

    try {
      setIsFlashing(true);
      const response = await fetch('/api/hardware/flash', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ buildId: selectedBuild, deviceId })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Flash started:', result.flashJobId);
        // WebSocket will handle progress updates
      } else {
        throw new Error('Failed to start flash process');
      }
    } catch (error) {
      console.error('Backend flash failed:', error);
      setIsFlashing(false);
    }
  };

  // Handle browser flashing
  const handleBrowserFlash = async () => {
    if (!selectedBuild || !webSerialSupported) return;

    try {
      setIsFlashing(true);
      
      // Request device selection
      const device = await webSerialFlasher.requestDevice();
      if (!device) {
        setIsFlashing(false);
        return;
      }

      // Download the build file
      const buildResponse = await fetch(`/api/builds/${selectedBuild}/download`);
      if (!buildResponse.ok) {
        throw new Error('Failed to download build');
      }

      const blob = await buildResponse.blob();
      const file = new File([blob], `build-${selectedBuild}.img`, { type: 'application/octet-stream' });

      // Connect and flash
      await webSerialFlasher.connect();
      await webSerialFlasher.flashImage(file, setFlashProgress);
      
    } catch (error) {
      console.error('Browser flash failed:', error);
      setFlashProgress({
        phase: 'failed',
        progress: 0,
        message: `Flash failed: ${(error as Error).message}`
      });
    } finally {
      setIsFlashing(false);
      await webSerialFlasher.disconnect();
    }
  };

  // Request new serial device
  const handleRequestSerialDevice = async () => {
    try {
      const device = await webSerialFlasher.requestDevice();
      if (device) {
        await fetchSerialDevices();
      }
    } catch (error) {
      console.error('Failed to request device:', error);
    }
  };

  const completedBuilds = builds.filter(build => build.status === 'completed');

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-white">Hardware Flashing</h2>
        <button
          onClick={onRefresh}
          className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Refresh
        </button>
      </div>

      {/* Flash Method Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Flash Method</label>
        <div className="flex gap-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="backend"
              checked={flashMethod === 'backend'}
              onChange={(e) => setFlashMethod(e.target.value as 'backend')}
              className="mr-2"
            />
            <span className="text-white">Backend (rkdeveloptool)</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="browser"
              checked={flashMethod === 'browser'}
              onChange={(e) => setFlashMethod(e.target.value as 'browser')}
              disabled={!webSerialSupported}
              className="mr-2"
            />
            <span className={webSerialSupported ? "text-white" : "text-gray-500"}>
              Browser (Web Serial API)
              {!webSerialSupported && " - Not Supported"}
            </span>
          </label>
        </div>
      </div>

      {/* Build Selection */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-300 mb-2">Select Build</label>
        <select
          value={selectedBuild}
          onChange={(e) => setSelectedBuild(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
          disabled={isFlashing}
        >
          <option value="">Select a completed build...</option>
          {completedBuilds.map(build => (
            <option key={build.id} value={build.id}>
              {build.name} ({build.size ? `${Math.round(build.size / 1024 / 1024)}MB` : 'Unknown size'})
            </option>
          ))}
        </select>
      </div>

      {/* Backend Method */}
      {flashMethod === 'backend' && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-white">Connected Devices (Backend)</h3>
            <button
              onClick={fetchBackendDevices}
              className="px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Refresh
            </button>
          </div>
          
          {backendDevices.length === 0 ? (
            <div className="p-4 bg-gray-800 rounded border border-gray-600">
              <p className="text-gray-300 mb-2">No devices detected</p>
              <p className="text-sm text-gray-400">
                Put your Rockchip device in maskrom mode and connect via USB-C
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {backendDevices.map(device => (
                <div key={device.id} className="p-3 bg-gray-800 rounded border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">Device {device.id}</span>
                      <span className="ml-2 px-2 py-1 text-xs bg-green-600 text-white rounded">
                        {device.type}
                      </span>
                      {device.chipInfo && (
                        <p className="text-sm text-gray-400 mt-1">{device.chipInfo}</p>
                      )}
                    </div>
                    <button
                      onClick={() => handleBackendFlash(device.id)}
                      disabled={!selectedBuild || isFlashing}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      Flash
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Browser Method */}
      {flashMethod === 'browser' && webSerialSupported && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-medium text-white">Serial Devices (Browser)</h3>
            <button
              onClick={handleRequestSerialDevice}
              className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Add Device
            </button>
          </div>

          {serialDevices.length === 0 ? (
            <div className="p-4 bg-gray-800 rounded border border-gray-600">
              <p className="text-gray-300 mb-2">No serial devices configured</p>
              <p className="text-sm text-gray-400 mb-3">
                Click "Add Device" to select a serial port for flashing
              </p>
              <button
                onClick={handleRequestSerialDevice}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Select Serial Device
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {serialDevices.map(device => (
                <div key={device.id} className="p-3 bg-gray-800 rounded border border-gray-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-white font-medium">{device.name}</span>
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded">
                        Serial
                      </span>
                    </div>
                    <button
                      onClick={handleBrowserFlash}
                      disabled={!selectedBuild || isFlashing}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
                    >
                      Flash
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 p-3 bg-blue-900 bg-opacity-50 rounded border border-blue-600">
            <h4 className="text-blue-300 font-medium mb-2">🌐 Browser-Based Flashing</h4>
            <ul className="text-sm text-blue-200 space-y-1">
              <li>• Direct hardware access from your browser</li>
              <li>• No backend dependencies required</li>
              <li>• Works with Web Serial API compatible devices</li>
              <li>• Requires HTTPS or localhost</li>
            </ul>
          </div>
        </div>
      )}

      {/* Flash Progress */}
      {isFlashing && flashProgress && (
        <div className="mt-4 p-4 bg-gray-800 rounded border border-gray-600">
          <h3 className="text-lg font-medium text-white mb-2">Flash Progress</h3>
          <div className="mb-2">
            <div className="flex justify-between text-sm text-gray-300">
              <span>{flashProgress.message}</span>
              <span>{flashProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 mt-1">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  flashProgress.phase === 'failed' ? 'bg-red-600' :
                  flashProgress.phase === 'completed' ? 'bg-green-600' : 'bg-blue-600'
                }`}
                style={{ width: `${flashProgress.progress}%` }}
              ></div>
            </div>
          </div>
          
          {flashProgress.bytesTransferred && flashProgress.totalBytes && (
            <p className="text-sm text-gray-400">
              {Math.round(flashProgress.bytesTransferred / 1024 / 1024)}MB / 
              {Math.round(flashProgress.totalBytes / 1024 / 1024)}MB
            </p>
          )}
        </div>
      )}

      {/* Feature Comparison */}
      <div className="mt-auto pt-4 border-t border-gray-600">
        <h3 className="text-lg font-medium text-white mb-2">Feature Comparison</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="p-3 bg-gray-800 rounded">
            <h4 className="text-green-400 font-medium mb-2">🖥️ Backend Method</h4>
            <ul className="text-gray-300 space-y-1">
              <li>• Uses rkdeveloptool</li>
              <li>• Robust device detection</li>
              <li>• Server-side processing</li>
              <li>• Proven reliability</li>
            </ul>
          </div>
          <div className="p-3 bg-gray-800 rounded">
            <h4 className="text-blue-400 font-medium mb-2">🌐 Browser Method</h4>
            <ul className="text-gray-300 space-y-1">
              <li>• Direct hardware access</li>
              <li>• No server required</li>
              <li>• Modern web capabilities</li>
              <li>• Experimental feature</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}; 