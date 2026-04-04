/**
 * EditableCell Component
 * 
 * Editable table cell with validation support.
 */

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface EditableCellProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
  validate?: (value: string | number) => string | null;
  disabled?: boolean;
  className?: string;
}

export function EditableCell({
  value,
  onChange,
  type = 'text',
  options = [],
  validate,
  disabled = false,
  className,
}: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(String(value));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(String(value));
  }, [value]);

  const handleDoubleClick = () => {
    if (!disabled) {
      setIsEditing(true);
      setError(null);
    }
  };

  const handleBlur = () => {
    commitChange();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      commitChange();
    } else if (e.key === 'Escape') {
      setEditValue(String(value));
      setIsEditing(false);
      setError(null);
    }
  };

  const commitChange = () => {
    let finalValue: string | number = editValue;

    // Convert to number if type is number
    if (type === 'number') {
      const num = parseFloat(editValue);
      if (isNaN(num)) {
        setError('Please enter a valid number');
        return;
      }
      finalValue = num;
    }

    // Validate
    if (validate) {
      const validationError = validate(finalValue);
      if (validationError) {
        setError(validationError);
        return;
      }
    }

    setIsEditing(false);
    setError(null);
    onChange(finalValue);
  };

  if (isEditing) {
    return (
      <div className="relative">
        {type === 'select' ? (
          <select
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full px-2 py-1 text-sm border rounded",
              "focus:outline-none focus:ring-2 focus:ring-corporate-primary",
              error ? "border-red-500" : "border-slate-300 dark:border-slate-600"
            )}
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            type={type}
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full px-2 py-1 text-sm border rounded",
              "focus:outline-none focus:ring-2 focus:ring-corporate-primary",
              error ? "border-red-500" : "border-slate-300 dark:border-slate-600"
            )}
          />
        )}
        {error && (
          <p className="absolute -bottom-5 left-0 text-xs text-red-500 whitespace-nowrap">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className={cn(
        "px-2 py-1 rounded cursor-text",
        !disabled && "hover:bg-slate-100 dark:hover:bg-slate-700",
        disabled && "cursor-not-allowed opacity-60",
        error && "bg-red-50 dark:bg-red-900/20",
        className
      )}
    >
      {type === 'select' && options.length > 0
        ? options.find((opt) => opt.value === value)?.label ?? String(value)
        : String(value)
      }
    </div>
  );
}

// Inline Editable Table Cell (for use in tables)
export interface InlineEditableCellProps {
  value: string | number;
  onChange: (value: string | number) => void;
  type?: 'text' | 'number' | 'date';
  disabled?: boolean;
  className?: string;
}

export function InlineEditableCell({
  value,
  onChange,
  type = 'text',
  disabled = false,
  className,
}: InlineEditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (localValue !== String(value)) {
      onChange(type === 'number' ? parseFloat(localValue) || 0 : localValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setLocalValue(String(value));
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={cn(
          "w-full px-1 py-0.5 text-sm border rounded",
          "focus:outline-none focus:ring-1 focus:ring-corporate-primary",
          "bg-white dark:bg-slate-800",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
    );
  }

  return (
    <span
      onDoubleClick={() => !disabled && setIsEditing(true)}
      className={cn(
        "cursor-text",
        !disabled && "hover:bg-slate-100 dark:hover:bg-slate-700 rounded px-1 -mx-1 py-0.5",
        disabled && "cursor-not-allowed opacity-60",
        className
      )}
    >
      {value}
    </span>
  );
}
