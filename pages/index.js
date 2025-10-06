import { useState } from 'react';

export default function OverlayConfig() {
  const [config, setConfig] = useState({
    channel: 'xqc',
    animation: 'slide',
    size: 3,
    font: 0,
    fontCustom: '',
    stroke: 0,
    shadow: 0,
    smallCaps: false,
    hideNames: false
  });

  const [overlayUrl, setOverlayUrl] = useState('');

  const fontOptions = [
    { value: 0, label: 'Baloo Thambi' },
    { value: 1, label: 'Segoe UI' },
    { value: 2, label: 'Roboto' },
    { value: 3, label: 'Lato' },
    { value: 4, label: 'Noto Sans' },
    { value: 5, label: 'Source Code Pro' },
    { value: 6, label: 'Impact' },
    { value: 7, label: 'Comfortaa' },
    { value: 8, label: 'Dancing Script' },
    { value: 9, label: 'Indie Flower' },
    { value: 10, label: 'Open Sans' },
    { value: 11, label: 'Alsina Ultrajada' }
  ];

  const generateUrl = () => {
    const params = new URLSearchParams();
    params.append('channel', config.channel);
    if (config.animation !== 'slide') params.append('animation', config.animation);
    if (config.size !== 3) params.append('size', config.size);
    if (config.font !== 0) params.append('font', config.font);
    if (config.fontCustom) params.append('fontCustom', config.fontCustom);
    if (config.stroke !== 0) params.append('stroke', config.stroke);
    if (config.shadow !== 0) params.append('shadow', config.shadow);
    if (config.smallCaps) params.append('smallCaps', 'true');
    if (config.hideNames) params.append('hideNames', 'true');
    
    const url = `${window.location.origin}/overlay?${params.toString()}`;
    setOverlayUrl(url);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(overlayUrl);
    alert('URL copied to clipboard!');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 text-white p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-extrabold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
            Kick Chat Overlay
          </h1>
          <p className="text-xl text-gray-300">Configure your custom chat overlay for OBS/Streamlabs</p>
        </div>

        <div className="bg-gray-800 rounded-lg shadow-2xl p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Channel Name */}
            <div>
              <label className="block text-sm font-bold mb-2">Channel Name</label>
              <input
                type="text"
                value={config.channel}
                onChange={(e) => setConfig({...config, channel: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                placeholder="xqc"
              />
            </div>

            {/* Animation */}
            <div>
              <label className="block text-sm font-bold mb-2">Animation</label>
              <select
                value={config.animation}
                onChange={(e) => setConfig({...config, animation: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                <option value="slide">Slide</option>
                <option value="none">None</option>
              </select>
            </div>

            {/* Size */}
            <div>
              <label className="block text-sm font-bold mb-2">Text Size</label>
              <select
                value={config.size}
                onChange={(e) => setConfig({...config, size: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                <option value="1">Small</option>
                <option value="2">Medium</option>
                <option value="3">Large</option>
              </select>
            </div>

            {/* Font */}
            <div>
              <label className="block text-sm font-bold mb-2">Font</label>
              <select
                value={config.font}
                onChange={(e) => setConfig({...config, font: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                {fontOptions.map(font => (
                  <option key={font.value} value={font.value}>{font.label}</option>
                ))}
              </select>
            </div>

            {/* Custom Font */}
            <div>
              <label className="block text-sm font-bold mb-2">Custom Font (optional)</label>
              <input
                type="text"
                value={config.fontCustom}
                onChange={(e) => setConfig({...config, fontCustom: e.target.value})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
                placeholder="Arial, sans-serif"
              />
            </div>

            {/* Stroke */}
            <div>
              <label className="block text-sm font-bold mb-2">Text Stroke</label>
              <select
                value={config.stroke}
                onChange={(e) => setConfig({...config, stroke: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                <option value="0">None</option>
                <option value="1">Thin</option>
                <option value="2">Medium</option>
                <option value="3">Thick</option>
                <option value="4">Thicker</option>
              </select>
            </div>

            {/* Shadow */}
            <div>
              <label className="block text-sm font-bold mb-2">Text Shadow</label>
              <select
                value={config.shadow}
                onChange={(e) => setConfig({...config, shadow: parseInt(e.target.value)})}
                className="w-full px-4 py-2 bg-gray-700 rounded border border-gray-600 focus:border-green-500 focus:outline-none"
              >
                <option value="0">None</option>
                <option value="1">Small</option>
                <option value="2">Medium</option>
                <option value="3">Large</option>
              </select>
            </div>

            {/* Small Caps */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="smallCaps"
                checked={config.smallCaps}
                onChange={(e) => setConfig({...config, smallCaps: e.target.checked})}
                className="w-5 h-5 bg-gray-700 rounded border-gray-600 focus:ring-green-500"
              />
              <label htmlFor="smallCaps" className="ml-3 text-sm font-bold">Small Caps</label>
            </div>

            {/* Hide Names */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="hideNames"
                checked={config.hideNames}
                onChange={(e) => setConfig({...config, hideNames: e.target.checked})}
                className="w-5 h-5 bg-gray-700 rounded border-gray-600 focus:ring-green-500"
              />
              <label htmlFor="hideNames" className="ml-3 text-sm font-bold">Hide Usernames</label>
            </div>
          </div>

          <button
            onClick={generateUrl}
            className="w-full mt-8 bg-gradient-to-r from-green-500 to-blue-500 hover:from-green-600 hover:to-blue-600 text-white font-bold py-4 px-6 rounded-lg text-xl transition-all transform hover:scale-105"
          >
            Generate Overlay URL
          </button>
        </div>

        {overlayUrl && (
          <div className="bg-gray-800 rounded-lg shadow-2xl p-8">
            <h2 className="text-2xl font-bold mb-4">Your Overlay URL</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={overlayUrl}
                readOnly
                className="flex-1 px-4 py-3 bg-gray-700 rounded border border-gray-600 text-sm"
              />
              <button
                onClick={copyToClipboard}
                className="bg-green-600 hover:bg-green-700 text-white font-bold px-6 py-3 rounded transition-all"
              >
                Copy
              </button>
            </div>
            <div className="mt-6 p-4 bg-gray-700 rounded">
              <h3 className="font-bold mb-2">How to use in OBS:</h3>
              <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
                <li>Add a new Browser Source in OBS</li>
                <li>Paste the URL above into the URL field</li>
                <li>Set Width to 1920 and Height to 1080 (or your canvas size)</li>
                <li>Check "Shutdown source when not visible" (optional)</li>
                <li>Click OK and position the overlay on your scene</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
