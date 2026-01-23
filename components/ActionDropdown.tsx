'use client';

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
    buttonClassName = 'z-50 px-3 py-1 bg-gray-100 border border-gray-300 rounded flex items-center text-gray-600',
    menuClassName = 'absolute w-40 bg-white border border-gray-300 shadow-lg rounded z-50',
    optionClassName = 'hover:bg-gray-100 px-3 py-2 cursor-pointer'
}: ActionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [openUpward, setOpenUpward] = useState(false);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);

    const toggleDropdown = () => {
        setIsOpen(prev => !prev);
    };

    // Close when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Detect available space and flip dropdown
    useEffect(() => {
        if (!isOpen || !buttonRef.current || !menuRef.current) return;

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const menuHeight = menuRef.current.offsetHeight;

        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        if (spaceBelow < menuHeight && spaceAbove > menuHeight) {
            setOpenUpward(true);
        } else {
            setOpenUpward(false);
        }
    }, [isOpen]);

    const handleOptionClick = (option: ActionOption) => {
        if (option.disabled) return;
        option.action();
        setIsOpen(false);
    };

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className={buttonClassName}
            >
                {label} <span className="ml-1">▼</span>
            </button>

            {isOpen && (
                <div
                    ref={menuRef}
                    className={`${menuClassName} ${
                        openUpward ? 'bottom-full mb-1' : 'top-full mt-1'
                    }`}
                >
                    <ul>
                        {options.map((option, index) => (
                            <li
                                key={index}
                                className={`${optionClassName} ${
                                    option.disabled
                                        ? 'opacity-50 cursor-not-allowed text-gray-400'
                                        : ''
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
