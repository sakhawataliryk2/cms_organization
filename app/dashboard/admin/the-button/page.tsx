'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FiX } from 'react-icons/fi';

export default function TheButton() {
    const router = useRouter();
    const [buttonColor, setButtonColor] = useState('#3B82F6'); // Default blue color

    // Generate a random color
    const generateRandomColor = () => {
        const colors = [
            '#3B82F6', // blue
            '#EF4444', // red
            '#10B981', // green
            '#F59E0B', // amber
            '#8B5CF6', // purple
            '#EC4899', // pink
            '#06B6D4', // cyan
            '#F97316', // orange
            '#84CC16', // lime
            '#6366F1', // indigo
            '#14B8A6', // teal
            '#A855F7', // violet
        ];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    // Handle button click - change to random color
    const handleColorChange = () => {
        const newColor = generateRandomColor();
        setButtonColor(newColor);
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin');
    };

    return (
        <div className="bg-gray-200 min-h-screen p-8">
            <div className="max-w-5xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow p-6 mb-8">
                    <div className="flex justify-between items-center">
                        <h1 className="text-2xl font-bold text-gray-800">The Button</h1>
                        <button
                            onClick={handleGoBack}
                            className="text-gray-500 hover:text-gray-700"
                            aria-label="Close"
                        >
                            <FiX size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="bg-white rounded-lg shadow p-8">
                    <div className="flex flex-col items-center justify-center min-h-[400px]">
                        {/* Click Me! Button */}
                        <button
                            onClick={handleColorChange}
                            style={{ backgroundColor: buttonColor }}
                            className="px-8 py-4 text-white text-lg font-semibold rounded-lg shadow-lg hover:opacity-90 transition-opacity transform hover:scale-105 transition-transform"
                        >
                            Click Me!
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

