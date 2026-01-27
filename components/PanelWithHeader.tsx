'use client'

import Image from 'next/image';
import { ReactNode } from 'react';
import { FiEdit2 } from 'react-icons/fi';

interface PanelWithHeaderProps {
    title: string;
    children: ReactNode;
    onRefresh?: () => void;
    onClose?: () => void;
    onEdit?: () => void;
    editButtonTitle?: string;
    editButtonAriaLabel?: string;
    className?: string;
}

export default function PanelWithHeader({
    title,
    children,
    onRefresh,
    onClose,
    onEdit,
    editButtonTitle = 'Edit Fields',
    editButtonAriaLabel = 'Edit Fields',
    className = ''
}: PanelWithHeaderProps) {
    return (
        <div className={`bg-white p-4 rounded shadow relative ${className}`}>
            <div className="flex justify-between border-b border-gray-300 pb-2 mb-2">
                <h2 className="font-semibold">{title}</h2>
                <div className="flex space-x-1">
                    {onEdit && (
                        <button
                            onClick={onEdit}
                            className="no-print text-gray-500 hover:text-gray-700"
                            aria-label={editButtonAriaLabel}
                            title={editButtonTitle}
                        >
                            <FiEdit2 size={16} />
                        </button>
                    )}
                    {onRefresh && (
                        <button
                            onClick={onRefresh}
                            className="no-print text-blue-500 hover:text-blue-700"
                            aria-label="Refresh"
                        >
                            <Image src="/refresh-small.svg" alt="Refresh" width={16} height={16} />
                        </button>
                    )}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="no-print text-gray-500 hover:text-gray-700"
                            aria-label="Close"
                        >
                            <Image src="/x-small.svg" alt="Close" width={16} height={16} />
                        </button>
                    )}
                </div>
            </div>

            <div>
                {children}
            </div>
        </div>
    );
}