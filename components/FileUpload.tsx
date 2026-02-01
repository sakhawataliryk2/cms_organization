'use client'

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import LoadingScreen from './LoadingScreen';

interface FileUploadProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function FileUpload({ isOpen, onClose }: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const router = useRouter();

    // If the modal is not open, don't render anything
    if (!isOpen) return null;

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFiles = e.dataTransfer.files;
        if (droppedFiles.length > 0) {
            validateFile(droppedFiles[0]);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            validateFile(e.target.files[0]);
        }
    };

    const validateFile = (file: File) => {
        setError(null);

        // Check if file is a PDF
        if (file.type !== 'application/pdf') {
            setError('Only PDF files are allowed');
            return;
        }

        // Check file size (limit to 10MB)
        if (file.size > 10 * 1024 * 1024) {
            setError('File size should be less than 10MB');
            return;
        }

        setFile(file);
    };

    const handleUpload = async () => {
        if (!file) return;

        setIsUploading(true);
        setError(null);

        try {
            // Simulate network delay
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Close the modal
            onClose();

            // Redirect to the file type selection page
            router.push('/dashboard/parse/file-type');

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unexpected error occurred');
        } finally {
            setIsUploading(false);
        }
    };

    const triggerFileInput = () => {
        fileInputRef.current?.click();
    };

    if (isUploading) {
        return <LoadingScreen message="Uploading PDF..." />;
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b">
                    <h2 className="text-xl font-semibold">Upload Resume/CV</h2>
                    <button
                        onKeyDown={(e) => {
                            if (e.key === 'escape' || e.key === ' ') {
                                e.stopPropagation();
                                onClose();
                            }
                        }}
                        onClick={onClose}
                        className="text-gray-500 hover:text-gray-700"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="p-6">
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 mb-4 text-center cursor-pointer
              ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400'}`}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={triggerFileInput}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".pdf"
                            onChange={handleFileSelect}
                        />

                        <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>

                        <p className="mt-2 text-gray-600">Drag and drop a PDF file here, or click to select</p>
                        <p className="text-sm text-gray-500 mt-1">Only PDF files are supported (max 10MB)</p>
                    </div>

                    {file && (
                        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200 flex items-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-sm truncate flex-1">{file.name}</span>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setFile(null);
                                }}
                                className="text-gray-500 hover:text-red-500 ml-2"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg border border-red-200">
                            <p>{error}</p>
                        </div>
                    )}

                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-600 hover:text-gray-800"
                            onKeyDown={(e) => {
                                if (e.key === 'escape' || e.key === ' ') {
                                    e.stopPropagation();
                                    onClose();
                                }
                            }}
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleUpload}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.stopPropagation();
                                    onClose();
                                }
                            }}
                            disabled={!file}
                            className={`px-4 py-2 rounded ${file
                                ? 'bg-blue-500 text-white hover:bg-blue-600'
                                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            Upload
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}