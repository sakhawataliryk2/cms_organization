'use client'

import { useState, useEffect } from 'react';
import { FiCopy, FiRefreshCw } from 'react-icons/fi';
import { useRouter } from 'nextjs-toploader/app';

export default function ApiManagement() {
    const router = useRouter();
    const [apiKey, setApiKey] = useState<string>('a1ee82ec0409828b01f519216fd1ac0');
    const [copySuccess, setCopySuccess] = useState<boolean>(false);
    const [isGenerating, setIsGenerating] = useState<boolean>(false);

    // Reset copy success message after 3 seconds
    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (copySuccess) {
            timer = setTimeout(() => {
                setCopySuccess(false);
            }, 3000);
        }
        return () => clearTimeout(timer);
    }, [copySuccess]);

    // Function to copy API key to clipboard
    const handleCopyApiKey = async () => {
        try {
            await navigator.clipboard.writeText(apiKey);
            setCopySuccess(true);
        } catch (err) {
            console.error('Failed to copy API key:', err);
        }
    };

    // Function to generate a new API key
    const handleGenerateNewApiKey = () => {
        // In a real app, this would make an API call to generate a new key
        setIsGenerating(true);

        setTimeout(() => {
            // Generate a random API key for demonstration
            const newKey = Array.from({ length: 32 }, () =>
                Math.floor(Math.random() * 16).toString(16)
            ).join('');

            setApiKey(newKey);
            setIsGenerating(false);
        }, 1000);
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin');
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md overflow-hidden">
                {/* Header */}
                <div className="border-b border-gray-300 p-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">API Management</h1>
                        <p className="text-gray-600 mt-1">Manage your API keys for integration with external systems</p>
                    </div>
                    <button
                        onClick={handleGoBack}
                        className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md transition duration-150 ease-in-out flex items-center"
                    >
                        Back
                    </button>
                </div>

                {/* API Key Display Section */}
                <div className="p-6 border-b border-gray-300">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">Your API Key</h2>

                    <div className="flex flex-col md:flex-row md:items-center gap-4">
                        <div className="flex-1 bg-gray-100 p-4 rounded-md font-mono text-sm relative">
                            {apiKey}
                            {copySuccess && (
                                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-green-600 text-xs font-sans">
                                    Copied!
                                </span>
                            )}
                        </div>
                        <button
                            onClick={handleCopyApiKey}
                            className="flex items-center justify-center gap-2 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition duration-150 ease-in-out"
                        >
                            <FiCopy size={18} />
                            <span>Copy</span>
                        </button>
                    </div>

                    <div className="mt-6">
                        <p className="text-gray-600 mb-4">
                            This key provides full access to your account's API. Keep it secure and never share it publicly.
                        </p>
                        <button
                            onClick={handleGenerateNewApiKey}
                            disabled={isGenerating}
                            className={`flex items-center justify-center gap-2 border border-gray-300 px-4 py-2 rounded-md transition duration-150 ease-in-out ${isGenerating ? 'bg-gray-100 cursor-not-allowed' : 'bg-white hover:bg-gray-50'
                                }`}
                        >
                            {isGenerating ? (
                                <>
                                    <FiRefreshCw size={18} className="animate-spin" />
                                    <span>Generating...</span>
                                </>
                            ) : (
                                <>
                                    <FiRefreshCw size={18} />
                                    <span>Generate New API Key</span>
                                </>
                            )}
                        </button>
                        <p className="text-gray-500 text-sm mt-2">
                            <strong>Warning:</strong> Generating a new API key will invalidate your existing key.
                            All applications using the current key will need to be updated.
                        </p>
                    </div>
                </div>


            </div>
        </div>
    );
}