'use client'

import { useState, useRef, useEffect } from 'react';

interface ActionOption {
    label: string;
    action: () => void;
    disabled?: boolean;
}

interface ActionDropdownProps {
    label?: string;
    options: ActionOption[];
    buttonClassName?: string;
    menuClassName?: string;
    optionClassName?: string;
}

export default function ActionDropdown({
    label = 'Actions',
    options,
    buttonClassName = 'px-3 py-1 bg-gray-100 border border-gray-300 rounded flex items-center text-gray-600',
    menuClassName = 'absolute right-0 mt-1 w-40 bg-white border border-gray-300 shadow-lg rounded z-10',
    optionClassName = 'hover:bg-gray-100 px-3 py-2 cursor-pointer'
}: ActionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => {
        setIsOpen(!isOpen);
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleOptionClick = (option: ActionOption) => {
        if (option.disabled) return;
        option.action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={toggleDropdown}
                className={buttonClassName}
            >
                {label} <span className="ml-1">▼</span>
            </button>

            {isOpen && (
                <div className={menuClassName}>
                    <ul>
                        {options.map((option, index) => (
                            <li
                                key={index}
                                className={`${optionClassName} ${
                                    option.disabled
                                        ? "opacity-50 cursor-not-allowed text-gray-400"
                                        : ""
                                }`}
                                onClick={() => handleOptionClick(option)}
                            >
                                {option.label}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}