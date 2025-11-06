
import React, { useState, useCallback, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UpscaleMode } from './types';
import { UploadIcon, DownloadIcon, MagicWandIcon } from './components/icons';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg'];

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      // remove the `data:mime/type;base64,` part
      resolve(result.split(',')[1]);
    };
    reader.onerror = (error) => reject(error);
  });
};

const Spinner: React.FC = () => (
  <div className="absolute inset-0 bg-slate-800 bg-opacity-70 flex flex-col justify-center items-center rounded-lg z-20">
    <div className="w-16 h-16 border-4 border-t-transparent border-blue-500 rounded-full animate-spin"></div>
    <p className="mt-4 text-slate-200 text-lg font-semibold">AI is enhancing your image...</p>
    <p className="text-slate-400 text-sm">This may take a moment.</p>
  </div>
);

const App: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [upscaleMode, setUpscaleMode] = useState<UpscaleMode>(UpscaleMode.TwoK);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [upscaledImageUrl, setUpscaledImageUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileValidation = (file: File): boolean => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      setError('Invalid file type. Please upload a JPG or PNG image.');
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB.`);
      return false;
    }
    return true;
  };

  const processFile = (file: File) => {
    if (handleFileValidation(file)) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setUpscaledImageUrl(null);
      setError(null);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };
  
  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragEvents = (event: React.DragEvent<HTMLDivElement>, dragging: boolean) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(dragging);
  };

  const handleUpscale = useCallback(async () => {
    if (!selectedFile) {
      setError('Please select an image first.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setUpscaledImageUrl(null);

    try {
      if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable is not set.");
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const base64Image = await fileToBase64(selectedFile);

      const resolution = upscaleMode === UpscaleMode.TwoK ? '2K (2560x1440)' : '4K (3840x2160)';
      const prompt = `Upscale this image to a crisp, photorealistic ${resolution} resolution. Enhance details, sharpness, and overall quality. Avoid introducing artificial textures or artifacts. The result should look like a higher-resolution photograph.`;
      
      const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: {
              parts: [
                  {
                      inlineData: {
                          data: base64Image,
                          mimeType: selectedFile.type,
                      },
                  },
                  {
                      text: prompt,
                  },
              ],
          },
          config: {
              responseModalities: [Modality.IMAGE],
          },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart && 'inlineData' in firstPart && firstPart.inlineData) {
        const upscaledBase64 = firstPart.inlineData.data;
        const mimeType = firstPart.inlineData.mimeType || 'image/png';
        setUpscaledImageUrl(`data:${mimeType};base64,${upscaledBase64}`);
      } else {
        throw new Error('The AI did not return an image. Please try again.');
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? `An error occurred: ${err.message}` : 'An unknown error occurred during upscaling.');
      setUpscaledImageUrl(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedFile, upscaleMode]);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8 font-sans">
      <header className="w-full max-w-6xl text-center mb-8">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
          OBATECH Ai Upscaler
        </h1>
        <p className="mt-2 text-lg text-slate-400">
          Transform your low-resolution images into stunning 2K & 4K masterpieces.
        </p>
      </header>
      
      <main className="w-full max-w-6xl flex flex-col lg:flex-row gap-8">
        {/* Controls Section */}
        <div className="w-full lg:w-1/3 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 backdrop-blur-sm flex flex-col space-y-6 h-fit">
          <div 
            className={`
              border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors duration-300
              ${isDragging ? 'border-blue-500 bg-blue-900/20' : 'border-slate-600 hover:border-blue-500 hover:bg-slate-700/30'}
            `}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => handleDragEvents(e, true)}
            onDragLeave={(e) => handleDragEvents(e, false)}
            onDragEnter={(e) => handleDragEvents(e, true)}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept={ACCEPTED_IMAGE_TYPES.join(',')}
              onChange={handleFileChange}
            />
            <UploadIcon className="mx-auto h-12 w-12 text-slate-400" />
            <p className="mt-4 font-semibold text-slate-200">
              Drag & drop an image or <span className="text-blue-400">browse</span>
            </p>
            <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
          </div>

          <div>
            <label htmlFor="upscaleMode" className="block text-sm font-medium text-slate-300 mb-2">Upscale Mode</label>
            <select
              id="upscaleMode"
              value={upscaleMode}
              onChange={(e) => setUpscaleMode(e.target.value as UpscaleMode)}
              className="w-full bg-slate-700 border border-slate-600 text-slate-100 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            >
              <option value={UpscaleMode.TwoK}>2K (2560x1440)</option>
              <option value={UpscaleMode.FourK}>4K (3840x2160)</option>
            </select>
          </div>

          <button
            onClick={handleUpscale}
            disabled={!selectedFile || isLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-transform transform active:scale-95 shadow-lg shadow-blue-600/20"
          >
            <MagicWandIcon className="h-5 w-5" />
            {isLoading ? 'Enhancing...' : 'Upscale Image'}
          </button>
          
          {error && <p className="text-red-400 text-sm mt-2">{error}</p>}
        </div>

        {/* Image Preview Section */}
        <div className="w-full lg:w-2/3 bg-slate-800/50 p-6 rounded-2xl border border-slate-700 flex flex-col items-center justify-center relative min-h-[300px] lg:min-h-[500px]">
          {isLoading && <Spinner />}
          
          <div className="w-full h-full flex flex-col items-center justify-center">
            {!previewUrl && !upscaledImageUrl && (
              <div className="text-center text-slate-500">
                  <svg className="mx-auto h-24 w-24 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <p className="mt-2 text-lg font-medium">Your enhanced image will appear here</p>
                  <p className="text-sm">Upload an image to get started</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full h-full items-center">
              {previewUrl && (
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-semibold mb-2 text-slate-300">Original</h3>
                  <img src={previewUrl} alt="Original preview" className="max-w-full max-h-[40vh] md:max-h-[60vh] object-contain rounded-lg shadow-lg"/>
                </div>
              )}
              
              {upscaledImageUrl && (
                <div className="flex flex-col items-center">
                  <h3 className="text-lg font-semibold mb-2 text-slate-300">AI Upscaled</h3>
                  <img src={upscaledImageUrl} alt="Upscaled result" className="max-w-full max-h-[40vh] md:max-h-[60vh] object-contain rounded-lg shadow-lg"/>
                </div>
              )}
            </div>

            {upscaledImageUrl && (
              <a
                href={upscaledImageUrl}
                download={`obatech-upscaled-${selectedFile?.name || 'image'}`}
                className="absolute bottom-6 right-6 flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-5 rounded-lg hover:bg-green-700 transition-transform transform active:scale-95 shadow-lg shadow-green-600/20"
              >
                <DownloadIcon className="h-5 w-5" />
                Download
              </a>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
