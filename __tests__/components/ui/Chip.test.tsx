import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Chip from '@/components/ui/Chip';

describe('Chip', () => {
  const defaultProps = {
    label: 'Filter',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Basic rendering ---

  it('renders the label text', () => {
    render(<Chip {...defaultProps} />);
    expect(screen.getByText('Filter')).toBeTruthy();
  });

  it('renders different label values', () => {
    render(<Chip {...defaultProps} label="Category" />);
    expect(screen.getByText('Category')).toBeTruthy();
  });

  // --- Press behaviour ---

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Chip label="Filter" onPress={onPress} />);
    fireEvent.press(screen.getByText('Filter'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress on each press', () => {
    const onPress = jest.fn();
    render(<Chip label="Filter" onPress={onPress} />);
    fireEvent.press(screen.getByText('Filter'));
    fireEvent.press(screen.getByText('Filter'));
    expect(onPress).toHaveBeenCalledTimes(2);
  });

  // --- Selected state ---

  describe('selected state', () => {
    it('defaults to unselected (selected=false)', () => {
      const { toJSON } = render(<Chip {...defaultProps} />);
      const root = toJSON();
      expect(root!.props.className).toContain('bg-surface');
      expect(root!.props.className).not.toContain('bg-primary');
    });

    it('applies selected container style when selected=true', () => {
      const { toJSON } = render(
        <Chip {...defaultProps} selected={true} />,
      );
      const root = toJSON();
      expect(root!.props.className).toContain('bg-primary');
      expect(root!.props.className).not.toContain('bg-surface');
    });

    it('applies unselected text style when not selected', () => {
      render(<Chip {...defaultProps} selected={false} />);
      const text = screen.getByText('Filter');
      expect(text.props.className).toContain('text-text');
    });

    it('applies selected text style when selected', () => {
      render(<Chip {...defaultProps} selected={true} />);
      const text = screen.getByText('Filter');
      expect(text.props.className).toContain('text-white');
    });
  });

  // --- Icon ---

  it('renders icon when provided', () => {
    const icon = <Text testID="chip-icon">*</Text>;
    render(<Chip {...defaultProps} icon={icon} />);
    expect(screen.getByTestId('chip-icon')).toBeTruthy();
    expect(screen.getByText('Filter')).toBeTruthy();
  });

  it('adds ml-1.5 to text when icon is present', () => {
    const icon = <Text testID="chip-icon">*</Text>;
    render(<Chip {...defaultProps} icon={icon} />);
    const text = screen.getByText('Filter');
    expect(text.props.className).toContain('ml-1.5');
  });

  it('does not add ml-1.5 to text when no icon', () => {
    render(<Chip {...defaultProps} />);
    const text = screen.getByText('Filter');
    expect(text.props.className).not.toContain('ml-1.5');
  });

  it('renders without icon by default', () => {
    render(<Chip {...defaultProps} />);
    expect(screen.queryByTestId('chip-icon')).toBeNull();
  });

  // --- Base classes ---

  it('always includes flex-row, items-center, rounded-full on container', () => {
    const { toJSON } = render(<Chip {...defaultProps} />);
    const root = toJSON();
    expect(root!.props.className).toContain('flex-row');
    expect(root!.props.className).toContain('items-center');
    expect(root!.props.className).toContain('rounded-full');
  });

  it('always includes padding classes on container', () => {
    const { toJSON } = render(<Chip {...defaultProps} />);
    const root = toJSON();
    expect(root!.props.className).toContain('px-4');
    expect(root!.props.className).toContain('py-2');
  });

  it('always includes text-sm and font-medium on text', () => {
    render(<Chip {...defaultProps} />);
    const text = screen.getByText('Filter');
    expect(text.props.className).toContain('text-sm');
    expect(text.props.className).toContain('font-medium');
  });
});
