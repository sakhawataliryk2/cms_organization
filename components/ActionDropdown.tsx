'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';

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
    menuClassName = 'absolute w-40 bg-white border border-gray-300 shadow-lg rounded z-[100]',
    optionClassName = 'hover:bg-gray-100 px-3 py-2 cursor-pointer'
}: ActionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

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
                !dropdownRef.current.contains(event.target as Node) &&
                menuRef.current &&
                !menuRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Position menu in viewport (portal) so it is never clipped by overflow
    useLayoutEffect(() => {
        if (!isOpen) {
            setMenuPosition(null);
            return;
        }
        if (!buttonRef.current || typeof document === 'undefined') return;

        const buttonRect = buttonRef.current.getBoundingClientRect();
        const menuHeight = (options.length * 40) + 16; // approximate menu height
        const menuWidth = 160;
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;

        const openUpward = spaceBelow < menuHeight && spaceAbove > menuHeight;
        const top = openUpward
            ? buttonRect.top - menuHeight - 4
            : buttonRect.bottom + 4;
        let left = buttonRect.left;
        // Keep menu in viewport horizontally
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth;
        if (left < 0) left = 0;

        setMenuPosition({ top, left });
    }, [isOpen, options.length]);

    const handleOptionClick = (option: ActionOption) => {
        if (option.disabled) return;
        option.action();
        setIsOpen(false);
    };

    const menuContent = isOpen && menuPosition && (
        <div
            ref={menuRef}
            className={menuClassName}
            style={{
                position: 'fixed',
                top: menuPosition.top,
                left: menuPosition.left,
                minWidth: '10rem',
            }}
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
    );

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                ref={buttonRef}
                onClick={toggleDropdown}
                className={buttonClassName}
            >
                {label} <span className="ml-1">▼</span>
            </button>

            {typeof document !== 'undefined' && menuContent && createPortal(menuContent, document.body)}
        </div>
    );
}
