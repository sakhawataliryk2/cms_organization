'use client';

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
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
    disabled?: boolean;
}

function getScrollParents(element: HTMLElement | null): HTMLElement[] {
    const parents: HTMLElement[] = [];
    let el = element?.parentElement ?? null;
    while (el) {
        const style = getComputedStyle(el);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        if (['auto', 'scroll', 'overlay'].includes(overflowY) || ['auto', 'scroll', 'overlay'].includes(overflowX)) {
            parents.push(el);
        }
        el = el.parentElement;
    }
    return parents;
}

export default function ActionDropdown({
    label = 'Actions',
    options,
    buttonClassName = 'z-50 px-3 py-1 bg-gray-100 border border-gray-300 rounded flex items-center text-gray-600',
    menuClassName = 'absolute min-w-max w-max bg-white border border-gray-300 shadow-sm rounded z-[100]',
    optionClassName = 'hover:bg-gray-100 px-3 py-2 cursor-pointer whitespace-nowrap w-full text-left',
    disabled = false
}: ActionDropdownProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

    const dropdownRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const menuRef = useRef<HTMLDivElement>(null);
    const optionsLengthRef = useRef(options.length);
    optionsLengthRef.current = options.length;

    const toggleDropdown = () => {
        if (disabled) return;
        setIsOpen(prev => !prev);
    };

    const updateMenuPosition = useCallback(() => {
        if (!buttonRef.current) return;
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const menuHeight = (optionsLengthRef.current * 40) + 16;
        const menuWidth = 160;
        const spaceBelow = window.innerHeight - buttonRect.bottom;
        const spaceAbove = buttonRect.top;
        const openUpward = spaceBelow < menuHeight && spaceAbove > menuHeight;
        const top = openUpward ? buttonRect.top - menuHeight - 4 : buttonRect.bottom + 4;
        let left = buttonRect.left;
        if (left + menuWidth > window.innerWidth) left = window.innerWidth - menuWidth;
        if (left < 0) left = 0;
        setMenuPosition({ top, left });
    }, []);

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

    // Position menu in viewport (portal) and keep it aligned with button on scroll/resize
    useLayoutEffect(() => {
        if (!isOpen) {
            setMenuPosition(null);
            return;
        }
        if (!buttonRef.current || typeof document === 'undefined') return;

        updateMenuPosition();

        const scrollParents = getScrollParents(buttonRef.current);
        const handleScroll = () => setIsOpen(false);
        const handleResize = () => updateMenuPosition();

        window.addEventListener('scroll', handleScroll, true);
        window.addEventListener('resize', handleResize);
        scrollParents.forEach((el) => el.addEventListener('scroll', handleScroll));

        return () => {
            window.removeEventListener('scroll', handleScroll, true);
            window.removeEventListener('resize', handleResize);
            scrollParents.forEach((el) => el.removeEventListener('scroll', handleScroll));
        };
    }, [isOpen, updateMenuPosition]);

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
                disabled={disabled}
                className={`${buttonClassName} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                {label} <span className="ml-1">▼</span>
            </button>

            {typeof document !== 'undefined' && menuContent && createPortal(menuContent, document.body)}
        </div>
    );
}
