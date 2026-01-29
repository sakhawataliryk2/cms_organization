// components/FieldNamingModal.tsx
import { useState } from 'react';
import { FiInfo, FiX } from 'react-icons/fi';

interface FieldNamingModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const FieldNamingModal: React.FC<FieldNamingModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    const fieldMappings = [
        { field: 'Field 1', description: 'Field Label - The display name for the field' },
        { field: 'Field 2', description: 'Field Name - The internal database field name' },
        { field: 'Field 3', description: 'Field Type - The data type (text, email, select, etc.)' },
        { field: 'Field 4', description: 'Hidden - Whether the field is hidden from forms' },
        { field: 'Field 5', description: 'Required - Whether the field is mandatory' },
        { field: 'Field 6', description: 'Sort Order - Display order in forms' },
        { field: 'Field 7', description: 'Last Modified - When the field was last updated' },
        { field: 'Field 8', description: 'Modified By - Who last modified the field' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow-xl max-w-2xl w-full mx-4 my-8 max-h-[90vh] overflow-y-auto">
                <div className="bg-gray-100 p-4 border-b flex justify-between items-center">
                    <h2 className="text-lg font-semibold">Field Column Definitions</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded hover:bg-gray-200"
                    >
                        <FiX size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 mb-4">
                        The table columns are numbered for easy reference. Here's what each field represents:
                    </p>
                    <div className="space-y-3">
                        {fieldMappings.map((mapping, index) => (
                            <div key={index} className="flex items-start">
                                <div className="w-20 font-semibold text-blue-600">{mapping.field}:</div>
                                <div className="flex-1 text-gray-700">{mapping.description}</div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-6 p-4 bg-blue-50 rounded border-l-4 border-blue-500">
                        <h3 className="font-semibold text-blue-800 mb-2">Field Customization</h3>
                        <ul className="text-sm text-blue-700 space-y-1">
                            <li>• Click on Field 4 (Hidden) to toggle field visibility</li>
                            <li>• Click on Field 5 (Required) to toggle whether the field is mandatory</li>
                            <li>• Click the edit icon to modify field properties</li>
                            <li>• Use "Add Custom Field" to create new fields with custom names</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FieldNamingModal;