"use client";

import React, { useState, useRef, useEffect } from "react";
import { FiChevronDown, FiX, FiCheck } from "react-icons/fi";

interface MultiSelectDropdownProps {
  options: string[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export default function MultiSelectDropdown({
  options,
  selectedValues,
  onChange,
  placeholder = "Select options...",
  disabled = false,
  className = "",
}: MultiSelectDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search query
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (disabled) return;

    const isSelected = selectedValues.includes(option);
    const newValues = isSelected
      ? selectedValues.filter((v) => v !== option)
      : [...selectedValues, option];

    onChange(newValues);
  };

  const removeValue = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;

    onChange(selectedValues.filter((v) => v !== value));
  };

  const handleFocus = () => {
    if (!disabled && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleInputClick = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    } else if (e.key === "Enter" && !isOpen) {
      setIsOpen(true);
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
      setSearchQuery("");
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Input/Display Area */}
      <div
        className={`
          w-full min-h-[42px] px-3 py-2 border border-gray-300 rounded-md
          bg-white cursor-pointer
          ${disabled ? "bg-gray-100 cursor-not-allowed" : "hover:border-gray-400"}
          ${isOpen ? "border-blue-500 ring-2 ring-blue-200" : ""}
          flex flex-wrap items-center gap-1.5
        `}
        onClick={handleInputClick}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
      >
        {/* Selected Tags */}
        {selectedValues.length > 0 ? (
          selectedValues.map((value) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm"
            >
              <span>{value}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeValue(value, e)}
                  className="hover:bg-blue-200 rounded p-0.5 focus:outline-none"
                  aria-label={`Remove ${value}`}
                >
                  <FiX className="w-3 h-3" />
                </button>
              )}
            </span>
          ))
        ) : (
          <span className="text-gray-500 text-sm">{placeholder}</span>
        )}

        {/* Dropdown Icon */}
        <div className="ml-auto flex items-center">
          <FiChevronDown
            className={`w-5 h-5 text-gray-400 transition-transform ${
              isOpen ? "transform rotate-180" : ""
            }`}
          />
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-200">
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search options..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Options List */}
          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                {searchQuery ? "No options found" : "No options available"}
              </div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selectedValues.includes(option);
                return (
                  <div
                    key={option}
                    onClick={() => toggleOption(option)}
                    className={`
                      px-4 py-2 cursor-pointer flex items-center justify-between
                      hover:bg-blue-50 transition-colors
                      ${isSelected ? "bg-blue-50" : ""}
                    `}
                  >
                    <span className="text-sm text-gray-700">{option}</span>
                    {isSelected && (
                      <FiCheck className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected Count */}
          {selectedValues.length > 0 && (
            <div className="px-4 py-2 border-t border-gray-200 bg-gray-50 text-xs text-gray-600">
              {selectedValues.length} selected
            </div>
          )}
        </div>
      )}
    </div>
  );
}
