
import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Clipboard, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Settings, 
  Trash2, 
  Sparkles,
  Download,
  Save,
  CheckCircle2,
  FileText,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw,
  ExternalLink
} from 'lucide-react';
import { PrinterConfig, ViewMode } from './types';
import { extractContentFromUrl, formatThermalText } from './services/geminiService';

// --- ESC/POS Helper for Bluetooth (58mm) ---
const encodeEscPos = (config: PrinterConfig): Uint8Array => {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  chunks.push(new Uint8Array([0x1B, 0x40])); // Reset

  // Header
  if (config.headerText) {
    chunks.push(new Uint8Array([0x1B, 0x61, 1])); // Center
    chunks.push(new Uint8Array([0x1B, 0x45, 0x01])); // Bold
    chunks.push(encoder.encode(config.headerText.toUpperCase() + "\n\n"));
    chunks.push(new Uint8Array([0x1B, 0x45, 0x00])); // Normal
  }

  // Content
  const alignMap = { left: 0, center: 1, right: 2 };
  chunks.push(new Uint8Array([0x1B, 0x61, alignMap[config.textAlign]]));
  const sizeMap = { sm: 0x00, base: 0x00, lg: 0x11, xl: 0x22 };
  chunks.push(new Uint8Array([0x1D, 0x21, sizeMap[config.fontSize]]));
  chunks.push(encoder.encode(config.content + "\n\n"));

  // Fixed Footer Branding
  chunks.push(new Uint8Array([0x1B, 0x61, 1])); // Center
  chunks.push(new Uint8Array([0x1D, 0x21, 0x00])); // Normal size
  chunks.push(encoder.encode("\n--- Developed by ---\nMubasshir Husain\n\n\n\n"));
  
  chunks.push(new Uint8Array([0x1D, 0x56, 0x00])); // Cut

  const totalLength = chunks.reduce((acc, curr) => acc + curr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
};

const STORAGE_KEY = 'suraj_printer_v2_config';

const App: React.FC = () => {
  const [config, setConfig] = useState<PrinterConfig>({
    headerText: 'SURAJ THERMAL PRINTER',
    headerImage: null,
    headerImageName: '',
    content: 'Welcome to Suraj Thermal Printer.\n\nReady to print your receipts.\n\nDeveloped by: Mubasshir Husain',
    fontSize: 'base',
    textAlign: 'center',
    bold: false,
    useBluetooth: false,
    linkedPrinterName: null,
  });

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDIT);
  const [isConnecting, setIsConnecting] = useState(false);
  const [btDevice, setBtDevice] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load configuration and attempt auto-link
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) { console.error("Restore failed", e); }
    }
  }, []);

  const handleSave = (updatedConfig?: PrinterConfig) => {
    const dataToSave = updatedConfig || config;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const linkBluetooth = async () => {
    try {
      setIsConnecting(true);
      // Basic 58mm Printer UUID or generic printer
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
      
      setBtDevice(device);
      const newConfig = { ...config, linkedPrinterName: device.name, useBluetooth: true };
      setConfig(newConfig);
      handleSave(newConfig);
    } catch (error) {
      alert("Bluetooth connection failed. Ensure your printer is on.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!config.linkedPrinterName) {
      linkBluetooth();
      return;
    }

    setLoading(true);
    try {
      let activeDevice = btDevice;
      if (!activeDevice) {
        // Try to re-request the specific known device
        activeDevice = await (navigator as any).bluetooth.requestDevice({
          filters: [{ name: config.linkedPrinterName }],
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });
        setBtDevice(activeDevice);
      }

      const server = await activeDevice.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      const data = encodeEscPos(config);
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        await characteristic?.writeValue(data.slice(i, i + chunkSize));
      }
      alert("Print sent!");
    } catch (e) {
      alert("Printer offline or out of range. Please re-link.");
      setConfig(p => ({ ...p, useBluetooth: false }));
    } finally {
      setLoading(false);
    }
  };

  const triggerPrint = () => {
    if (config.useBluetooth) {
      handleBluetoothPrint();
    } else {
      window.print();
    }
  };

  return (
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50 relative overflow-x-hidden shadow-2xl">
      {/* App Bar */}
      <header className="bg-indigo-700 text-white p-6 sticky top-0 z-50 shadow-xl rounded-b-[2rem]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h1 className="font-black text-2xl tracking-tighter">SURAJ PRINT</h1>
              <p className="text-[9px] font-bold text-indigo-200 uppercase tracking-[0.2em]">Dev: Mubasshir Husain</p>
            </div>
          </div>
          <button onClick={() => handleSave()} className={`p-3 rounded-2xl transition-all shadow-lg ${saveStatus ? 'bg-green-500' : 'bg-indigo-600 hover:bg-indigo-500'}`}>
            {saveStatus ? <CheckCircle2 className="w-6 h-6" /> : <Save className="w-6 h-6" />}
          </button>
        </div>
        
        {/* Connection Status Badge */}
        <div className="mt-6 flex justify-center">
          <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${config.useBluetooth ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30' : 'bg-indigo-600/50 text-indigo-100'}`}>
            {config.useBluetooth ? (
              <><BluetoothConnected className="w-3 h-3" /> Linked: {config.linkedPrinterName || 'Active'}</>
            ) : (
              <><BluetoothOff className="w-3 h-3" /> System Print Mode</>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 p-5 space-y-6 pb-40">
        {/* Mode Toggle */}
        <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200">
          <button onClick={() => setViewMode(ViewMode.EDIT)} className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === ViewMode.EDIT ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            Design
          </button>
          <button onClick={() => setViewMode(ViewMode.PREVIEW)} className={`flex-1 py-3.5 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${viewMode === ViewMode.PREVIEW ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-50'}`}>
            Preview
          </button>
        </div>

        {viewMode === ViewMode.EDIT ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Bluetooth Config */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Bluetooth className="w-4 h-4" />
                  <h2 className="font-black uppercase text-[10px] tracking-widest">Printer Setup</h2>
                </div>
                <div className="flex bg-slate-100 p-1 rounded-full border border-slate-200">
                   <button onClick={() => { const nc = {...config, useBluetooth: false}; setConfig(nc); handleSave(nc); }} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${!config.useBluetooth ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>System</button>
                   <button onClick={() => { const nc = {...config, useBluetooth: true}; setConfig(nc); handleSave(nc); }} className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase transition-all ${config.useBluetooth ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>Bluetooth</button>
                </div>
              </div>

              {config.useBluetooth && (
                <button onClick={linkBluetooth} disabled={isConnecting} className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-2xl hover:bg-indigo-100 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-600 p-2 rounded-xl text-white">
                      <RefreshCw className={`w-4 h-4 ${isConnecting ? 'animate-spin' : ''}`} />
                    </div>
                    <span className="text-sm font-bold text-indigo-900">{config.linkedPrinterName || 'Pair New Printer'}</span>
                  </div>
                  <Settings className="w-4 h-4 text-indigo-400" />
                </button>
              )}
            </div>

            {/* Content & AI Tools */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700">
                  <FileText className="w-4 h-4" />
                  <h2 className="font-black uppercase text-[10px] tracking-widest">Receipt Body</h2>
                </div>
                <div className="flex gap-2">
                  {/* Fixed: Moved await out of setConfig updater to avoid syntax error */}
                  <button onClick={async () => {
                    try {
                      const text = await navigator.clipboard.readText();
                      if (text) setConfig(p => ({ ...p, content: text }));
                    } catch (e) {
                      console.error("Clipboard access failed:", e);
                    }
                  }} className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors">
                    <Clipboard className="w-4 h-4" />
                  </button>
                  {/* Fixed: Moved await out of setConfig updater to avoid syntax error */}
                  <button onClick={async () => { 
                    setLoading(true); 
                    try {
                      const formatted = await formatThermalText(config.content);
                      setConfig(p => ({ ...p, content: formatted })); 
                    } catch (e) {
                      console.error("Gemini format error:", e);
                    } finally {
                      setLoading(false); 
                    }
                  }} className="p-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors">
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <textarea 
                value={config.content} 
                onChange={(e) => setConfig({...config, content: e.target.value})} 
                className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-xs resize-none focus:ring-4 focus:ring-indigo-100 outline-none transition-all"
                placeholder="Enter receipt content here..."
              />

              <div className="flex gap-2">
                <input 
                  type="url" 
                  value={url} 
                  onChange={(e) => setUrl(e.target.value)} 
                  placeholder="Paste URL to extract..." 
                  className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none" 
                />
                {/* Fixed: Moved await out of setConfig updater to avoid syntax error */}
                <button 
                  onClick={async () => { 
                    setLoading(true); 
                    try {
                      const result = await extractContentFromUrl(url);
                      setConfig(p => ({ ...p, content: result })); 
                    } catch (e) {
                      console.error("Gemini extract error:", e);
                    } finally {
                      setLoading(false); 
                    }
                  }}
                  className="bg-indigo-700 text-white px-4 rounded-xl font-bold text-xs"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Header Branding */}
            <div className="bg-white rounded-[2rem] p-6 shadow-sm border border-slate-100 space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Receipt Header</label>
              <input 
                type="text" 
                value={config.headerText} 
                onChange={(e) => setConfig({...config, headerText: e.target.value})} 
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm outline-none focus:ring-4 focus:ring-indigo-100"
              />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-4 border-2 border-dashed border-slate-200 text-slate-400 rounded-2xl flex items-center justify-center gap-2 hover:bg-slate-50 transition-colors">
                <ImageIcon className="w-5 h-5" /> 
                <span className="text-xs font-bold uppercase tracking-widest">{config.headerImage ? 'Image Selected' : 'Add Header Image'}</span>
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = () => setConfig(p => ({ ...p, headerImage: reader.result as string }));
                  reader.readAsDataURL(file);
                }
              }} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
             <div id="print-area" className="thermal-paper p-6 shadow-2xl rounded-sm border border-slate-200">
               {config.headerImage && (
                 <div className="flex justify-center mb-6">
                   <img src={config.headerImage} alt="Logo" className="max-w-[70%] h-auto grayscale contrast-150 mix-blend-multiply" />
                 </div>
               )}
               {config.headerText && (
                 <div className="text-center font-black text-[16px] mb-4 border-b-2 border-black border-dotted pb-4 uppercase tracking-wider">
                   {config.headerText}
                 </div>
               )}
               <div className={`whitespace-pre-wrap leading-tight font-mono ${config.textAlign === 'center' ? 'text-center' : config.textAlign === 'right' ? 'text-right' : 'text-left'} ${config.fontSize === 'sm' ? 'text-[10px]' : config.fontSize === 'lg' ? 'text-[14px]' : config.fontSize === 'xl' ? 'text-[16px]' : 'text-[12px]'}`}>
                 {config.content}
               </div>
               <div className="mt-10 pt-4 border-t border-dotted border-black text-center">
                 <p className="text-[10px] font-black tracking-[0.2em] mb-1">--- THANK YOU ---</p>
                 <p className="text-[8px] font-bold text-slate-900 uppercase">Developed by: Mubasshir Husain</p>
                 <p className="text-[7px] text-slate-500 mt-1 italic">Suraj Thermal Printer Utility</p>
               </div>
             </div>
          </div>
        )}
      </main>

      {/* Floating Action Bar */}
      <footer className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pointer-events-none z-40">
        <button 
          onClick={triggerPrint} 
          disabled={loading}
          className={`pointer-events-auto w-full max-w-md mx-auto py-5 rounded-[2.5rem] shadow-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 group disabled:opacity-50 ${config.useBluetooth ? 'bg-emerald-600 shadow-emerald-200' : 'bg-indigo-700 shadow-indigo-200'} text-white`}
        >
          {loading ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : config.useBluetooth ? (
            <BluetoothConnected className="w-6 h-6 group-hover:scale-110 transition-transform" />
          ) : (
            <Printer className="w-6 h-6 group-hover:rotate-12 transition-transform" /> 
          )}
          {loading ? 'PROCESSING...' : config.useBluetooth ? 'BT PRINT NOW' : 'GENERATE PRINT'}
        </button>
      </footer>
    </div>
  );
};

export default App;
