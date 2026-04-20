import React, { useState, useRef, useEffect } from "react";

/**
 * SearchableSelect - A searchable dropdown component
 * @param {Array} options - Array of objects with 'id', 'label', and optionally 'searchText'
 * @param {String|Number} value - Currently selected option id
 * @param {Function} onChange - Callback when selection changes: (selectedId) => {}
 * @param {String} placeholder - Placeholder text
 * @param {String} label - Label text
 * @param {Boolean} required - Is field required
 * @param {Function} getOptionLabel - Custom function to extract label from option (default: o => o.label)
 */
export default function SearchableSelect({
  options = [],
  value = "",
  onChange = () => {},
  placeholder = "Search and select...",
  label = "",
  required = false,
  getOptionLabel = (o) => o.label,
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const containerRef = useRef(null);

  // Filter options based on search
  const filteredOptions = options.filter((option) => {
    const label = getOptionLabel(option).toLowerCase();
    const searchText = (option.searchText || label).toLowerCase();
    return searchText.includes(search.toLowerCase());
  });

  // Get currently selected option
  const selectedOption = options.find((o) => o.id === value);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
          onChange(filteredOptions[highlightedIndex].id);
          setIsOpen(false);
          setSearch("");
          setHighlightedIndex(-1);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        setSearch("");
        setHighlightedIndex(-1);
        break;
      default:
        break;
    }
  };

  // Handle option selection
  const handleSelect = (optionId) => {
    onChange(optionId);
    setIsOpen(false);
    setSearch("");
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="text-xs text-gray-600 mb-1 block">
          {label}
          {required && <span className="text-red-500">*</span>}
        </label>
      )}
      <div
        className="border rounded w-full p-2 text-sm bg-white cursor-text flex items-center justify-between"
        onClick={() => {
          setIsOpen(true);
          inputRef.current?.focus();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={isOpen ? search : selectedOption ? getOptionLabel(selectedOption) : ""}
          onChange={(e) => {
            setSearch(e.target.value);
            setHighlightedIndex(-1);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={isOpen ? placeholder : "Select an option..."}
          className="outline-none flex-1 bg-transparent"
        />
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          ref={menuRef}
          className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 max-h-64 overflow-y-auto"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, index) => (
              <div
                key={option.id}
                onClick={() => handleSelect(option.id)}
                className={`px-3 py-2 text-sm cursor-pointer transition-colors ${
                  index === highlightedIndex
                    ? "bg-blue-500 text-white"
                    : "hover:bg-gray-100"
                } ${selectedOption?.id === option.id ? "bg-blue-100" : ""}`}
              >
                {getOptionLabel(option)}
              </div>
            ))
          ) : (
            <div className="px-3 py-2 text-sm text-gray-500">
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
