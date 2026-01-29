'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FiRefreshCw, FiX, FiChevronDown } from 'react-icons/fi';

interface Office {
    id: string;
    building_name: string;
    address: string;
    address2: string;
    city: string;
    state: string;
    zip_code: string;
    building_type: string;
}

export default function OfficeManagement() {
    const router = useRouter();
    const [searchTerm, setSearchTerm] = useState('');
    const [isAddOfficeModalOpen, setIsAddOfficeModalOpen] = useState(false);
    const [filterStatus, setFilterStatus] = useState('Enabled');
    const [offices, setOffices] = useState<Office[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetch offices on component mount
    useEffect(() => {
        fetchOffices();
    }, []);

    const fetchOffices = async () => {
        try {
            setIsLoading(true);
            const response = await fetch('/api/offices');
            const data = await response.json();

            if (data.success) {
                setOffices(data.offices || []);
            }
        } catch (error) {
            console.error('Error fetching offices:', error);
        } finally {
            setIsLoading(false);
        }
    };

    // Filter offices based on search term
    const filteredOffices = offices.filter(office => {
        const searchableFields = [
            office.building_name,
            office.address,
            office.address2,
            office.city,
            office.state,
            office.zip_code,
            office.building_type
        ].join(' ').toLowerCase();

        return searchableFields.includes(searchTerm.toLowerCase());
    });

    const handleAddOffice = () => {
        setIsAddOfficeModalOpen(true);
    };

    const handleGoBack = () => {
        router.push('/dashboard/admin/user-management');
    };

    const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearchTerm(e.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    const handleFilterChange = (status: string) => {
        setFilterStatus(status);
    };

    const tableHeaders = [
        { id: 'buildingName', label: 'Building Name' },
        { id: 'address', label: 'Address' },
        { id: 'address2', label: 'Address 2' },
        { id: 'city', label: 'City' },
        { id: 'state', label: 'State' },
        { id: 'zipCode', label: 'Zip Code' },
        { id: 'buildingType', label: 'Building Type' }
    ];

    return (
        <div className="bg-gray-100 min-h-screen">
            {/* Header area */}
            <div className="bg-white border-b border-gray-300 flex items-center justify-between p-4">
                <div className="flex items-center">
                    <div className="h-8 w-8 bg-gray-400 rounded-full mr-2 flex items-center justify-center">
                        <span className="text-white">O</span>
                    </div>
                    <h1 className="text-xl font-semibold">Offices</h1>
                </div>

                <div className="flex items-center space-x-2">
                    <button
                        onClick={handleAddOffice}
                        className="bg-white border border-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-100"
                    >
                        Add Office
                    </button>
                    <button onClick={fetchOffices} className="p-2 rounded hover:bg-gray-200">
                        <FiRefreshCw size={18} />
                    </button>
                    <button onClick={handleGoBack} className="p-2 rounded hover:bg-gray-200">
                        <FiX size={18} />
                    </button>
                </div>
            </div>

            {/* Search and filter area */}
            <div className="p-4 flex items-center space-x-4">
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleSearch}
                        placeholder="Find"
                        className="border border-gray-300 rounded px-3 py-2 w-56"
                    />
                    {searchTerm && (
                        <button
                            onClick={handleClearSearch}
                            className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        >
                            <FiX size={16} />
                        </button>
                    )}
                </div>

                <button onClick={handleClearSearch} className="bg-gray-200 px-4 py-2 rounded text-gray-700 hover:bg-gray-300">
                    Clear
                </button>

                <div className="relative">
                    <button className="bg-white border border-gray-300 px-4 py-2 rounded flex items-center">
                        {filterStatus}
                        <FiChevronDown className="ml-2" />
                    </button>
                </div>

                <div className="text-gray-500">
                    ( {filteredOffices.length} ) Records
                </div>
            </div>

            {/* Table */}
            <div className="px-4 pb-4">
                <div className="bg-white rounded-md shadow overflow-x-auto">
                    <table className="min-w-full">
                        <thead>
                            <tr className="bg-gray-50 border-b">
                                {tableHeaders.map(header => (
                                    <th key={header.id} className="px-4 py-3 text-left text-sm font-medium text-gray-500">
                                        {header.label}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan={tableHeaders.length} className="px-4 py-4 text-center text-gray-500">
                                        Loading offices...
                                    </td>
                                </tr>
                            ) : filteredOffices.length > 0 ? (
                                filteredOffices.map(office => (
                                    <tr key={office.id} className="border-b hover:bg-gray-50">
                                        <td className="px-4 py-3 text-sm">{office.building_name}</td>
                                        <td className="px-4 py-3 text-sm">{office.address}</td>
                                        <td className="px-4 py-3 text-sm">{office.address2 || '-'}</td>
                                        <td className="px-4 py-3 text-sm">{office.city}</td>
                                        <td className="px-4 py-3 text-sm">{office.state}</td>
                                        <td className="px-4 py-3 text-sm">{office.zip_code}</td>
                                        <td className="px-4 py-3 text-sm">{office.building_type || '-'}</td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={tableHeaders.length} className="px-4 py-4 text-center text-gray-500">
                                        No offices found
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Office Modal */}
            {isAddOfficeModalOpen && (
                <AddOfficeModal
                    onClose={() => setIsAddOfficeModalOpen(false)}
                    onOfficeAdded={fetchOffices}
                />
            )}
        </div>
    );
}

// Add Office Modal Component
function AddOfficeModal({ onClose, onOfficeAdded }: { onClose: () => void, onOfficeAdded: () => void }) {
    const [formData, setFormData] = useState({
        buildingName: '',
        address: '',
        address2: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'United States',
        buildingType: ''
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData({
            ...formData,
            [name]: value
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Basic validation
        if (!formData.buildingName || !formData.address || !formData.city || !formData.state || !formData.zipCode) {
            setError('Please fill in all required fields');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/offices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                onOfficeAdded();
                onClose();
            } else {
                setError(data.message || 'Failed to create office');
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Building types for dropdown
    const buildingTypes = [
        'Corporate Office',
        'Branch Office',
        'Regional Headquarters',
        'Operations Center',
        'Research Facility',
        'Training Center',
        'Retail Location',
        'Distribution Center',
        'Manufacturing Facility'
    ];

    // Countries for dropdown
    const countries = [
        'United States',
        'Canada',
        'United Kingdom',
        'Australia',
        'Germany',
        'France',
        'Japan',
        'China',
        'Brazil',
        'India'
    ];

    // States for dropdown
    const states = [
        'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
        'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
        'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
        'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
        'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
        'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
        'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
        'Wisconsin', 'Wyoming'
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-md shadow-lg w-full max-w-3xl overflow-hidden">
                <div className="flex justify-between items-center bg-gray-100 p-4 border-b">
                    <h2 className="text-lg font-semibold">Add Office</h2>
                    <button onClick={onClose} className="p-1 rounded hover:bg-gray-200">
                        <FiX size={20} />
                    </button>
                </div>

                <div className="p-6 max-h-[80vh] overflow-y-auto">
                    {error && (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit}>
                        <div className="space-y-6">
                            {/* Building Name */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Building Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="buildingName"
                                    value={formData.buildingName}
                                    onChange={handleChange}
                                    placeholder="Enter the building name"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {/* Street Address */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Address <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    placeholder="Enter the full street address"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    required
                                />
                            </div>

                            {/* City, State, ZIP Row */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-gray-600 text-sm">City <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="city"
                                        value={formData.city}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm">State / Province <span className="text-red-500">*</span></label>
                                    <div className="relative">
                                        <select
                                            name="state"
                                            value={formData.state}
                                            onChange={handleChange}
                                            className="w-full p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500 appearance-none pr-10"
                                            required
                                        >
                                            <option value="">Select State</option>
                                            {states.map(state => (
                                                <option key={state} value={state}>{state}</option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                                            <FiChevronDown />
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-gray-600 text-sm">ZIP / Postal code <span className="text-red-500">*</span></label>
                                    <input
                                        type="text"
                                        name="zipCode"
                                        value={formData.zipCode}
                                        onChange={handleChange}
                                        className="w-full p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Address 2 */}
                            <div>
                                <label className="block text-gray-600 text-sm">Address 2</label>
                                <input
                                    type="text"
                                    name="address2"
                                    value={formData.address2}
                                    onChange={handleChange}
                                    placeholder="Apartment, suite, unit, building, floor, etc."
                                    className="w-full p-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-teal-500"
                                />
                            </div>

                            {/* Country */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Country
                                </label>
                                <select
                                    name="country"
                                    value={formData.country}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {countries.map(country => (
                                        <option key={country} value={country}>{country}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Building Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Building Type
                                </label>
                                <select
                                    name="buildingType"
                                    value={formData.buildingType}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">Select Building Type</option>
                                    {buildingTypes.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-8 flex justify-end space-x-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-md"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-4 py-2 text-white bg-blue-500 hover:bg-blue-600 rounded-md flex items-center"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Processing...
                                    </>
                                ) : 'Save'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}