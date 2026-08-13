
import React, { useCallback, useRef } from 'react';

interface FileUploadProps {
  onFileUpload: (content: string, file: File) => void;
  disabled?: boolean;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onFileUpload, disabled }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        onFileUpload(text, file); // Pass the file object as well
        // Reset file input to allow uploading the same file again
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
      };
      reader.readAsText(file);
    }
  }, [onFileUpload]);

  return (
    <div className="space-y-2">
      <label htmlFor="decklist-upload" className="block text-sm font-semibold text-cyan-400">
        Upload Decklist (.txt, .csv)
      </label>
      <input
        id="decklist-upload"
        type="file"
        accept=".txt,.csv" // Accept .csv files
        onChange={handleFileChange}
        ref={fileInputRef}
        disabled={disabled}
        className="block w-full text-sm text-gray-300
                   file:mr-4 file:py-2 file:px-4
                   file:rounded-md file:border-0
                   file:text-sm file:font-semibold
                   file:bg-cyan-600 file:text-cyan-50
                   hover:file:bg-cyan-500 transition-colors
                   disabled:opacity-50 disabled:cursor-not-allowed"
      />
      <p className="text-xs text-gray-400">
        Supports .txt (one card per line, e.g., "4 Sol Ring") or .csv (with "name"/"cardname" and optional "quantity"/"count" columns).
      </p>
    </div>
  );
};
