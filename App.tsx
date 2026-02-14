
import React, { useState, useEffect, useRef } from 'react';
import { 
  Printer, 
  Clipboard, 
  Link as LinkIcon, 
  Image as ImageIcon, 
  Settings, 
  Trash2, 
  Type as TypeIcon,
  User,
  Sparkles,
  Download,
  Save,
  CheckCircle2
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";
import { PrinterConfig, ViewMode } from './types';

// Gemini Service Logic (Integrated to fix build errors)
const getApiKey = () => process.env.API_KEY || "";

const extractContentFromUrl = async (url: string): Promise<string> => {
  const apiKey = getApiKey();
  if (!apiKey) return "Error: API Key not found. Please set API_KEY in Vercel environment variables.";
  
  const ai = new GoogleGenAI({ apiKey });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Extract only the primary text content from the following URL and format it for a 58mm thermal printer (short lines, concise): ${url}`,
      config: {
        systemInstruction: "You are a professional thermal printer assistant. Extract the most important information from URLs (titles, prices, main body) and format it as clean, readable text. Ignore ads and navigation menus.",
      }
    });
    return response.text || "Failed to extract content.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error fetching content. Please paste text manually.";
  }
};

const formatThermalText = async (text: string): Promise<string> => {
    const apiKey = getApiKey();
    if (!apiKey) return text;
    
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Reformat this text to look like a clean thermal receipt (58mm width). Use simple dashes for separators and ensure important details are clear: ${text}`,
      });
      return response.text || text;
    } catch (error) {
      return text;
    }
};

const STORAGE_KEY = 'suraj_printer_config';

const App: React.FC = () => {
  const [config, setConfig] = useState<PrinterConfig>({
    headerText: 'SURAJ THERMAL PRINTER',
    headerImage: null,
    headerImageName: 'My_Header',
    content: 'Welcome to your professional printing solution.\n\nItems:\n- Sample A   $10.00\n- Sample B   $15.00\n\nTotal: $25.00',
    fontSize: 'base',
    textAlign: 'left',
    bold: false,
  });

  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.EDIT);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to load config", e);
      }
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleSaveToDevice = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    setSaveStatus(true);
    setTimeout(() => setSaveStatus(false), 2000);
  };

  const downloadProcessedHeader = () => {
    if (!config.headerImage) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.filter = 'grayscale(100%) contrast(150%) brightness(110%)';
      ctx.drawImage(img, 0, 0);

      const link = document.createElement('a');
      link.download = `${config.headerImageName || 'header'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = config.headerImage;
  };

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') setDeferredPrompt(null);
    } else {
      alert("To install: Tap Chrome Menu (3 dots) > Install App");
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setConfig(prev => ({ ...prev, content: text }));
    } catch (err) {
      alert("Please allow clipboard access or paste manually.");
    }
  };

  const handleUrlFetch = async () => {
    if (!url) return;
    setLoading(true);
    const content = await extractContentFromUrl(url);
    setConfig(prev => ({ ...prev, content }));
    setLoading(false);
  };

  const handleMagicFormat = async () => {
    setLoading(true);
    const formatted = await formatThermalText(config.content);
    setConfig(prev => ({ ...prev, content: formatted }));
    setLoading(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setConfig(prev => ({ 
          ...prev, 
          headerImage: reader.result as string,
          headerImageName: file.name.split('.')[0]
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerPrint = () => {
    window.print();
  };

  const fontSizeClasses = {
    sm: 'text-[10px]',
    base: 'text-[12px]',
    lg: 'text-[14px]',
    xl: 'text-[16px]'
  };

  return (
    <div className="max-w-md mx-auto min-h-screen bg-gray-50 flex flex-col shadow-xl pb-safe">
      <header className="bg-indigo-700 text-white p-4 sticky top-0 z-10 shadow-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white p-1.5 rounded-lg">
              <Printer className="text-indigo-700 w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight uppercase tracking-wide">Suraj Thermal Printer</h1>
              <p className="text-[10px] text-indigo-200">Developed by : Mubasshir Husain</p>
            </div>
          </div>
          <div className="flex gap-2">
             <button onClick={handleInstall} className="bg-indigo-600/50 hover:bg-indigo-600 p-2 rounded-full transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button onClick={handleSaveToDevice} className={`p-2 rounded-full transition-all shadow-lg ${saveStatus ? 'bg-green-400' : 'bg-indigo-500 hover:bg-indigo-600'}`}>
                {saveStatus ? <CheckCircle2 className="w-5 h-5" /> : <Save className="w-5 h-5" />}
              </button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-6 pb-28">
        <div className="flex bg-white rounded-xl p-1 shadow-sm border border-gray-200">
          <button onClick={() => setViewMode(ViewMode.EDIT)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === ViewMode.EDIT ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Settings</button>
          <button onClick={() => setViewMode(ViewMode.PREVIEW)} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${viewMode === ViewMode.PREVIEW ? 'bg-indigo-600 text-white shadow-md' : 'text-gray-500 hover:bg-gray-50'}`}>Preview</button>
        </div>

        {viewMode === ViewMode.EDIT ? (
          <div className="space-y-6">
            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4">
                <Settings className="w-4 h-4 text-indigo-600" />
                <h2 className="font-bold text-gray-800 tracking-tight">Header Setup</h2>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Central Header Text</label>
                  <input type="text" value={config.headerText} onChange={(e) => setConfig({...config, headerText: e.target.value})} className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Header Image</label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => fileInputRef.current?.click()} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-colors">
                      <ImageIcon className="w-4 h-4" /> {config.headerImage ? 'Replace Image' : 'Select Image'}
                    </button>
                    {config.headerImage && (
                      <button onClick={() => setConfig({...config, headerImage: null, headerImageName: ''})} className="bg-red-50 text-red-500 p-3 rounded-xl hover:bg-red-100"><Trash2 className="w-5 h-5" /></button>
                    )}
                  </div>
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                  {config.headerImage && (
                    <div className="mt-2 border-2 border-dashed border-gray-200 rounded-xl p-4 bg-gray-50 flex justify-center">
                      <img src={config.headerImage} alt="Preview" className="max-h-24 object-contain mix-blend-multiply grayscale contrast-125" />
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 mb-4"><LinkIcon className="w-4 h-4 text-indigo-600" /><h2 className="font-bold text-gray-800 tracking-tight">Direct URL Print</h2></div>
              <div className="flex gap-2">
                <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Paste URL here..." className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none" />
                <button onClick={handleUrlFetch} disabled={loading} className="bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-bold disabled:opacity-50">{loading ? '...' : 'Extract'}</button>
              </div>
            </section>

            <section className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><TypeIcon className="w-4 h-4 text-indigo-600" /><h2 className="font-bold text-gray-800 tracking-tight">Receipt Body</h2></div>
                <div className="flex gap-2">
                  <button onClick={handlePaste} className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold flex items-center gap-1"><Clipboard className="w-3 h-3" /> Paste</button>
                  <button onClick={handleMagicFormat} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Magic</button>
                </div>
              </div>
              <textarea value={config.content} onChange={(e) => setConfig({...config, content: e.target.value})} className="w-full h-56 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl font-mono text-sm resize-none outline-none focus:ring-2 focus:ring-indigo-500" />
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Font Size</label>
                  <select value={config.fontSize} onChange={(e) => setConfig({...config, fontSize: e.target.value as any})} className="w-full p-3 text-sm border border-gray-200 rounded-xl bg-gray-50 font-bold">
                    <option value="sm">Small</option><option value="base">Normal</option><option value="lg">Large</option><option value="xl">Extra Large</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1.5 ml-1">Alignment</label>
                  <div className="flex border border-gray-200 rounded-xl overflow-hidden bg-gray-50 p-1">
                    {(['left', 'center', 'right'] as const).map((align) => (
                      <button key={align} onClick={() => setConfig({...config, textAlign: align})} className={`flex-1 py-2 text-[10px] font-black uppercase rounded-md transition-all ${config.textAlign === align ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-500 hover:text-indigo-600'}`}>{align}</button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div id="print-area" className="thermal-paper p-5 text-black shadow-lg">
              {config.headerImage && <div className="flex justify-center mb-5"><img src={config.headerImage} alt="Header" className="max-w-[80%] h-auto grayscale mix-blend-multiply" style={{ filter: 'contrast(2) brightness(1.1)' }} /></div>}
              {config.headerText && <div className="text-center font-black text-[14px] mb-4 border-b-2 border-dotted border-black pb-3 uppercase tracking-wider">{config.headerText}</div>}
              <div className={`whitespace-pre-wrap break-words leading-[1.2] ${fontSizeClasses[config.fontSize]} ${config.textAlign === 'center' ? 'text-center' : config.textAlign === 'right' ? 'text-right' : 'text-left'}`}>{config.content}</div>
              <div className="mt-10 border-t border-dashed border-gray-400 pt-3 text-center text-[9px] text-gray-500 uppercase tracking-widest">* * * Thank You * * *<br /><span className="font-bold">Suraj Thermal Printer</span></div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-gradient-to-t from-gray-50 to-transparent">
        <button onClick={triggerPrint} className="w-full bg-indigo-700 text-white py-4.5 rounded-2xl shadow-xl font-black text-lg flex items-center justify-center gap-3 active:scale-95 transition-all">
          <Printer className="w-6 h-6" /> GENERATE PRINT
        </button>
      </footer>
    </div>
  );
};

export default App;
