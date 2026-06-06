/**
 * EditableCell Tests
 * 
 * Integration tests for the EditableCell component:
 * - Render with mock data
 * - Simulate blur and expect state updater to be called
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { EditableCell, InlineEditableCell } from './EditableCell';

describe('EditableCell', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render with initial value', () => {
      render(
        <EditableCell 
          value="Test Value" 
          onChange={mockOnChange} 
        />
      );
      
      expect(screen.getByText('Test Value')).toBeInTheDocument();
    });

    it('should render numeric values correctly', () => {
      render(
        <EditableCell 
          value={1000} 
          onChange={mockOnChange} 
          type="number"
        />
      );
      
      expect(screen.getByText('1000')).toBeInTheDocument();
    });
  });

  describe('User Interaction', () => {
    it('should enter edit mode on double-click', () => {
      render(
        <EditableCell 
          value="Test Value" 
          onChange={mockOnChange} 
        />
      );
      
      // Double-click to enter edit mode
      const cell = screen.getByText('Test Value');
      fireEvent.doubleClick(cell);
      
      // Should now show an input
      const input = screen.getByRole('textbox');
      expect(input).toBeInTheDocument();
      expect(input).toHaveValue('Test Value');
    });

    it('should call onChange on blur with updated value', async () => {
      render(
        <EditableCell 
          value="Original Value" 
          onChange={mockOnChange} 
        />
      );
      
      // Double-click to enter edit mode
      const cell = screen.getByText('Original Value');
      fireEvent.doubleClick(cell);
      
      // Change the value
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Updated Value' } });
      
      // Blur the input to commit
      fireEvent.blur(input);
      
      // Should call onChange with the new value
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('Updated Value');
      });
    });

    it('should call onChange on Enter key', async () => {
      render(
        <EditableCell 
          value="Original Value" 
          onChange={mockOnChange} 
        />
      );
      
      // Double-click to enter edit mode
      const cell = screen.getByText('Original Value');
      fireEvent.doubleClick(cell);
      
      // Change the value
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Enter Value' } });
      
      // Press Enter
      fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });
      
      // Should call onChange with the new value
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith('Enter Value');
      });
    });

    it('should revert to original value on Escape', () => {
      render(
        <EditableCell 
          value="Original Value" 
          onChange={mockOnChange} 
        />
      );
      
      // Double-click to enter edit mode
      const cell = screen.getByText('Original Value');
      fireEvent.doubleClick(cell);
      
      // Change the value
      const input = screen.getByRole('textbox');
      fireEvent.change(input, { target: { value: 'Changed Value' } });
      
      // Press Escape
      fireEvent.keyDown(input, { key: 'Escape', code: 'Escape' });
      
      // Should NOT call onChange
      expect(mockOnChange).not.toHaveBeenCalled();
      
      // Should show original value
      expect(screen.getByText('Original Value')).toBeInTheDocument();
    });
  });

  describe('Number Type', () => {
    it('should handle numeric input correctly', async () => {
      render(
        <EditableCell 
          value={100} 
          onChange={mockOnChange} 
          type="number"
        />
      );
      
      // Double-click to enter edit mode
      const cell = screen.getByText('100');
      fireEvent.doubleClick(cell);
      
      // Change to a different number
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: '200' } });
      fireEvent.blur(input);
      
      // Should call onChange with number
      await waitFor(() => {
        expect(mockOnChange).toHaveBeenCalledWith(200);
      });
    });

    it('should show error for invalid number', async () => {
      render(
        <EditableCell 
          value={100} 
          onChange={mockOnChange} 
          type="number"
        />
      );
      
      // Double-click to enter edit mode
      const cell = screen.getByText('100');
      fireEvent.doubleClick(cell);
      
      // Enter invalid number
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);
      
      // Should show validation error
      await waitFor(() => {
        expect(screen.getByText('Please enter a valid number')).toBeInTheDocument();
      });
      
      // Should NOT call onChange
      expect(mockOnChange).not.toHaveBeenCalled();
    });
  });

  describe('Disabled State', () => {
    it('should not enter edit mode when disabled', () => {
      render(
        <EditableCell 
          value="Disabled Value" 
          onChange={mockOnChange} 
          disabled={true}
        />
      );
      
      // Try to double-click
      const cell = screen.getByText('Disabled Value');
      fireEvent.doubleClick(cell);
      
      // Should NOT show input
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });
  });
});

describe('InlineEditableCell', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render with initial value', () => {
    render(
      <InlineEditableCell 
        value="Inline Value" 
        onChange={mockOnChange} 
      />
    );
    
    expect(screen.getByText('Inline Value')).toBeInTheDocument();
  });

  it('should call onChange on blur with updated value', async () => {
    render(
      <InlineEditableCell 
        value="Original" 
        onChange={mockOnChange} 
      />
    );
    
    // Double-click to enter edit mode
    const cell = screen.getByText('Original');
    fireEvent.doubleClick(cell);
    
    // Change the value
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: 'Updated' } });
    
    // Blur to commit
    fireEvent.blur(input);
    
    // Should call onChange
    await waitFor(() => {
      expect(mockOnChange).toHaveBeenCalledWith('Updated');
    });
  });

  it('should not call onChange if value unchanged on blur', () => {
    render(
      <InlineEditableCell 
        value="Same Value" 
        onChange={mockOnChange} 
      />
    );
    
    // Double-click to enter edit mode
    const cell = screen.getByText('Same Value');
    fireEvent.doubleClick(cell);
    
    // Don't change the value
    const input = screen.getByRole('textbox');
    
    // Blur without changing
    fireEvent.blur(input);
    
    // Should NOT call onChange
    expect(mockOnChange).not.toHaveBeenCalled();
  });
});
