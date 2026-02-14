
import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Clipboard, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Settings, 
  Trash2, 
  Type as TypeIcon,
  Sparkles,
  Download,
  Save,
  CheckCircle2,
  FileText,
  Bluetooth,
  BluetoothConnected,
  BluetoothOff,
  RefreshCw
} from 'lucide-react';
import { PrinterConfig, ViewMode } from './types';
// Fix: Import Gemini functions from the dedicated service to avoid duplication and ensure correct API usage
import { extractContentFromUrl, formatThermalText } from './services/geminiService';

// --- ESC/POS Helper for Bluetooth ---
const encodeEscPos = (config: PrinterConfig): Uint8Array => {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];

  // Reset printer
  chunks.push(new Uint8Array([0x1B, 0x40]));

  // Alignment: 0=Left, 1=Center, 2=Right
  const alignMap = { left: 0, center: 1, right: 2 };
  
  // Header
  if (config.headerText) {
    chunks.push(new Uint8Array([0x1B, 0x61, alignMap.center]));
    chunks.push(new Uint8Array([0x1B, 0x45, 0x01])); // Bold on
    chunks.push(encoder.encode(config.headerText.toUpperCase() + "\n\n"));
    chunks.push(new Uint8Array([0x1B, 0x45, 0x00])); // Bold off
  }

  // Body Alignment
  chunks.push(new Uint8Array([0x1B, 0x61, alignMap[config.textAlign]]));
  
  // Font Size (Simplified GS ! n)
  const sizeMap = { sm: 0x00, base: 0x00, lg: 0x11, xl: 0x22 };
  chunks.push(new Uint8Array([0x1D, 0x21, sizeMap[config.fontSize]]));
  
  chunks.push(encoder.encode(config.content + "\n\n"));

  // Footer
  chunks.push(new Uint8Array([0x1B, 0x61, 1])); // Center
  chunks.push(new Uint8Array([0x1D, 0x21, 0x00])); // Normal size
  chunks.push(encoder.encode("* * Thank You * *\n\n\n\n"));

  // Cut (if supported)
  chunks.push(new Uint8Array([0x1D, 0x56, 0x00]));

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
    content: 'Welcome to Suraj Thermal Printer.\n\nReady to print your receipts.\n\nBy: Mubasshir Husain',
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
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  // Fix: Use any for BluetoothDevice as it is not natively available in all TypeScript environments without additional type definitions
  const [btDevice, setBtDevice] = useState<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) { console.error(e); }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const linkBluetooth = async () => {
    try {
      setIsConnecting(true);
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
      });
      
      setBtDevice(device);
      setConfig(p => ({ ...p, linkedPrinterName: device.name, useBluetooth: true }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, linkedPrinterName: device.name, useBluetooth: true }));
    } catch (error) {
      console.error("Bluetooth pairing failed", error);
      alert("Bluetooth pairing canceled or failed. Ensure printer is on and in pairing mode.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleBluetoothPrint = async () => {
    if (!btDevice && !config.linkedPrinterName) {
      alert("No printer linked. Please go to Settings and Link a Printer.");
      return;
    }

    setLoading(true);
    try {
      let activeDevice = btDevice;
      
      // If we only have the name from storage, we must re-request or try to find
      if (!activeDevice) {
        activeDevice = await (navigator as any).bluetooth.requestDevice({
          filters: [{ name: config.linkedPrinterName }],
          optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb']
        });
        setBtDevice(activeDevice);
      }

      if (!activeDevice) throw new Error("Device not found");

      const server = await activeDevice.gatt?.connect();
      const service = await server?.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
      const characteristic = await service?.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');

      const data = encodeEscPos(config);
      
      // Send in chunks (BLE has limited MTU)
      const chunkSize = 20;
      for (let i = 0; i < data.length; i += chunkSize) {
        const chunk = data.slice(i, i + chunkSize);
        await characteristic?.writeValue(chunk);
      }
      
      alert("Print job sent successfully!");
    } catch (error) {
      console.error(error);
      alert("Bluetooth Print Failed. Make sure printer is connected.");
    } finally {
      setLoading(false);
    }
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      setDeferredPrompt(null);
    } else {
      alert("Installation: Tap Chrome Menu > Install App");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setConfig(p => ({ ...p, content: text }));
    } catch (e) { alert("Paste failed. Check permissions."); }
  };

  const handleUrlFetch = async () => {
    if (!url) return;
    setLoading(true);
    const text = await extractContentFromUrl(url);
    setConfig(p => ({ ...p, content: text }));
    setLoading(false);
  };

  const handleMagic = async () => {
    setLoading(true);
    const text = await formatThermalText(config.content);
    setConfig(p => ({ ...p, content: text }));
    setLoading(false);
  };

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setConfig(p => ({ ...p, headerImage: reader.result as string }));
      reader.readAsDataURL(file);
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
    <div className="max-w-md mx-auto min-h-screen flex flex-col bg-slate-50 shadow-2xl relative overflow-x-hidden">
      {/* Header Bar */}
      <header className="bg-indigo-700 text-white p-5 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
              <Printer className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-extrabold text-xl tracking-tighter">SURAJ PRINT</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                {config.useBluetooth ? (
                   <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-emerald-500/30 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-400/20">
                     <BluetoothConnected className="w-2.5 h-2.5" /> {config.linkedPrinterName || 'BT MODE'}
                   </span>
                ) : (
                  <span className="flex items-center gap-1 text-[8px] font-black uppercase bg-white/10 text-indigo-200 px-2 py-0.5 rounded-full">
                     <BluetoothOff className="w-2.5 h-2.5" /> SYSTEM PRINT
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleInstall} title="Install App" className="bg-indigo-600 p-2.5 rounded-xl hover:bg-indigo-500 transition-colors shadow-inner">
              <Download className="w-5 h-5" />
            </button>
            <button onClick={handleSave} title="Save Draft" className={`p-2.5 rounded-xl transition-all shadow-lg ${saveStatus ? 'bg-green-500' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
              {saveStatus ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 space-y-6 pb-40">
        {/* Navigation Tabs */}
        <div className="flex bg-white rounded-2xl p-1.5 shadow-sm border border-slate-200">
          <button onClick={() => setViewMode(ViewMode.EDIT)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${viewMode === ViewMode.EDIT ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
            Configure
          </button>
          <button onClick={() => setViewMode(ViewMode.PREVIEW)} className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${viewMode === ViewMode.PREVIEW ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>
            Preview
          </button>
        </div>

        {viewMode === ViewMode.EDIT ? (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            
            {/* Bluetooth Settings */}
            <div className={`bg-white rounded-3xl p-6 shadow-sm border transition-all ${config.useBluetooth ? 'border-indigo-500/30 bg-indigo-50/10' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Bluetooth className="w-4 h-4" />
                  <h2 className="font-black uppercase text-xs tracking-widest">Bluetooth Settings</h2>
                </div>
                <div className="flex items-center bg-slate-100 rounded-full p-1 border border-slate-200">
                   <button onClick={() => setConfig(p => ({ ...p, useBluetooth: false }))} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${!config.useBluetooth ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-400'}`}>System</button>
                   <button onClick={() => setConfig(p => ({ ...p, useBluetooth: true }))} className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${config.useBluetooth ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400'}`}>BT Print</button>
                </div>
              </div>

              {config.useBluetooth && (
                <div className="space-y-4 animate-in zoom-in-95 duration-200">
                   <div className="flex items-center justify-between p-4 bg-white border border-indigo-100 rounded-2xl shadow-sm">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-indigo-600 text-white rounded-xl">
                            <BluetoothConnected className="w-5 h-5" />
                         </div>
                         <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase leading-none mb-1">Current Printer</p>
                            <p className="font-black text-slate-800 tracking-tight">{config.linkedPrinterName || 'Not Linked'}</p>
                         </div>
                      </div>
                      <button onClick={linkBluetooth} disabled={isConnecting} className="p-3 bg-indigo-50 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors disabled:opacity-50">
                        <RefreshCw className={`w-5 h-5 ${isConnecting ? 'animate-spin' : ''}`} />
                      </button>
                   </div>
                   {!config.linkedPrinterName && (
                     <button onClick={linkBluetooth} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100">
                        Link 58mm Printer
                     </button>
                   )}
                </div>
              )}
            </div>

            {/* Header Settings */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-5">
              <div className="flex items-center gap-2 text-indigo-700">
                <Settings className="w-4 h-4" />
                <h2 className="font-black uppercase text-xs tracking-widest">Header Setup</h2>
              </div>
              
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block ml-1">Company / Title</label>
                <input type="text" value={config.headerText} onChange={(e) => setConfig({...config, headerText: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-100 transition-all font-bold" placeholder="E.g. SURAJ PRINTER" />
              </div>

              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-2 block ml-1">Brand Logo</label>
                <div className="flex gap-2">
                  <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-2xl text-sm font-black transition-all">
                    <ImageIcon className="w-4 h-4" /> {config.headerImage ? 'Change Image' : 'Add Image'}
                  </button>
                  {config.headerImage && (
                    <button onClick={() => setConfig({...config, headerImage: null})} className="bg-rose-50 text-rose-500 p-3.5 rounded-2xl hover:bg-rose-100 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={onImageChange} />
              </div>
            </div>

            {/* Web to Print */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center gap-2 text-indigo-700">
                <LinkIcon className="w-4 h-4" />
                <h2 className="font-black uppercase text-xs tracking-widest">Web to Print</h2>
              </div>
              <div className="flex gap-2">
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Enter URL (e.g. google.com)" className="flex-1 px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
                <button onClick={handleUrlFetch} disabled={loading} className="bg-indigo-700 text-white px-6 py-3.5 rounded-2xl font-black text-sm disabled:opacity-50 shadow-lg shadow-indigo-100">
                  {loading ? '...' : 'GET'}
                </button>
              </div>
            </div>

            {/* Receipt Content */}
            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-700">
                  <FileText className="w-4 h-4" />
                  <h2 className="font-black uppercase text-xs tracking-widest">Content</h2>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePaste} className="bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 active:bg-slate-200">
                    <Clipboard className="w-3 h-3" /> Paste
                  </button>
                  <button onClick={handleMagic} disabled={loading} className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-lg text-[10px] font-black uppercase flex items-center gap-1.5 shadow-md disabled:opacity-50">
                    <Sparkles className="w-3 h-3" /> AI Magic
                  </button>
                </div>
              </div>
              <textarea value={config.content} onChange={(e) => setConfig({...config, content: e.target.value})} className="w-full h-48 px-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-sm resize-none outline-none focus:ring-4 focus:ring-indigo-100 transition-all" />
              
              <div className="grid grid-cols-2 gap-4 pt-2">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Font Size</label>
                    <select value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: e.target.value as any})} className="w-full p-3.5 text-sm font-bold bg-slate-50 border border-slate-200 rounded-2xl outline-none">
                      <option value="sm">Small</option>
                      <option value="base">Medium</option>
                      <option value="lg">Large</option>
                      <option value="xl">Extra Large</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Align</label>
                    <div className="flex bg-slate-50 p-1 border border-slate-200 rounded-2xl">
                      {(['left', 'center', 'right'] as const).map(a => (
                        <button key={a} onClick={() => setConfig({...config, textAlign: a})} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-xl transition-all ${config.textAlign === a ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-400'}`}>
                          {a[0]}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-200">
             <p className="text-[10px] text-slate-400 font-bold uppercase mb-4 tracking-tighter italic">Previewing 58mm Roll Output</p>
             <div id="print-area" className="thermal-paper p-6 shadow-2xl rounded-sm border border-slate-200">
               {config.headerImage && (
                 <div className="flex justify-center mb-6">
                   <img src={config.headerImage} alt="Logo" className="max-w-[80%] h-auto grayscale contrast-150" />
                 </div>
               )}
               {config.headerText && (
                 <div className="text-center font-black text-[15px] mb-4 border-b-2 border-black border-dotted pb-4 uppercase tracking-wider">
                   {config.headerText}
                 </div>
               )}
               <div className={`whitespace-pre-wrap leading-relaxed ${config.textAlign === 'center' ? 'text-center' : config.textAlign === 'right' ? 'text-right' : 'text-left'} ${config.fontSize === 'sm' ? 'text-[10px]' : config.fontSize === 'lg' ? 'text-[14px]' : config.fontSize === 'xl' ? 'text-[16px]' : 'text-[12px]'}`}>
                 {config.content}
               </div>
               <div className="mt-12 pt-4 border-t border-dotted border-black text-center space-y-1">
                 <p className="text-[10px] font-bold uppercase tracking-widest">* * THANK YOU * *</p>
                 <p className="text-[8px] font-medium text-slate-500 uppercase">Printed via {config.useBluetooth ? 'Bluetooth' : 'Suraj'} Printer</p>
               </div>
             </div>
          </div>
        )}
      </main>

      {/* Action Footer */}
      <footer className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pointer-events-none z-40">
        <button 
          onClick={triggerPrint} 
          disabled={loading}
          className={`pointer-events-auto w-full max-w-md mx-auto py-5 rounded-[2.5rem] shadow-2xl font-black text-lg flex items-center justify-center gap-3 transition-all active:scale-95 group disabled:opacity-50 ${config.useBluetooth ? 'bg-emerald-600 shadow-emerald-100' : 'bg-indigo-700 shadow-indigo-100'} text-white`}
        >
          {loading ? (
            <RefreshCw className="w-6 h-6 animate-spin" />
          ) : config.useBluetooth ? (
            <BluetoothConnected className="w-6 h-6 group-hover:scale-110 transition-transform" />
          ) : (
            <Printer className="w-6 h-6 group-hover:rotate-12 transition-transform" /> 
          )}
          {loading ? 'SENDING...' : config.useBluetooth ? 'BT PRINT' : 'GENERATE PRINT'}
        </button>
      </footer>
    </div>
  );
};

export default App;
