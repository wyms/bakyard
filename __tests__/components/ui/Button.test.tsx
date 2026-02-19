import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Button from '@/components/ui/Button';

describe('Button', () => {
  const defaultProps = {
    title: 'Press Me',
    onPress: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Rendering ---

  it('renders the title text', () => {
    render(<Button {...defaultProps} />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders icon when provided', () => {
    const icon = <Text testID="test-icon">IC</Text>;
    render(<Button {...defaultProps} icon={icon} />);
    expect(screen.getByTestId('test-icon')).toBeTruthy();
    // Title should still be present alongside the icon
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('shows ActivityIndicator when loading', () => {
    const { UNSAFE_getByType } = render(
      <Button {...defaultProps} loading={true} />,
    );
    const { ActivityIndicator } = require('react-native');
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('hides title text when loading', () => {
    render(<Button {...defaultProps} loading={true} />);
    expect(screen.queryByText('Press Me')).toBeNull();
  });

  // --- Press behaviour ---

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    render(<Button title="Press Me" onPress={onPress} />);
    fireEvent.press(screen.getByText('Press Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT call onPress when disabled', () => {
    const onPress = jest.fn();
    render(<Button title="Press Me" onPress={onPress} disabled={true} />);
    fireEvent.press(screen.getByText('Press Me'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does NOT call onPress when loading', () => {
    const onPress = jest.fn();
    const { UNSAFE_getByType } = render(
      <Button title="Press Me" onPress={onPress} loading={true} />,
    );
    const { ActivityIndicator } = require('react-native');
    fireEvent.press(UNSAFE_getByType(ActivityIndicator));
    expect(onPress).not.toHaveBeenCalled();
  });

  // --- Variants ---

  it('renders with primary variant (default)', () => {
    render(<Button {...defaultProps} />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders with secondary variant', () => {
    render(<Button {...defaultProps} variant="secondary" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders with outline variant', () => {
    render(<Button {...defaultProps} variant="outline" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders with ghost variant', () => {
    render(<Button {...defaultProps} variant="ghost" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  // --- Sizes ---

  it('renders with sm size', () => {
    render(<Button {...defaultProps} size="sm" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders with md size (default)', () => {
    render(<Button {...defaultProps} size="md" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  it('renders with lg size', () => {
    render(<Button {...defaultProps} size="lg" />);
    expect(screen.getByText('Press Me')).toBeTruthy();
  });

  // --- Disabled + loading opacity ---

  it('applies opacity-50 className when disabled', () => {
    const { toJSON } = render(
      <Button {...defaultProps} disabled={true} />,
    );
    const root = toJSON();
    expect(root).toBeTruthy();
    // The root element's className (Pressable rendered as View) should contain opacity-50
    expect(root!.props.className).toContain('opacity-50');
  });

  it('applies opacity-50 className when loading', () => {
    const { toJSON } = render(
      <Button {...defaultProps} loading={true} />,
    );
    const root = toJSON();
    expect(root).toBeTruthy();
    expect(root!.props.className).toContain('opacity-50');
  });

  it('does not apply opacity-50 when neither disabled nor loading', () => {
    const { toJSON } = render(<Button {...defaultProps} />);
    const root = toJSON();
    expect(root).toBeTruthy();
    expect(root!.props.className).not.toContain('opacity-50');
  });

  // --- Spinner colour varies by variant ---

  it('uses white spinner colour for primary variant', () => {
    const { UNSAFE_getByType } = render(
      <Button {...defaultProps} variant="primary" loading={true} />,
    );
    const { ActivityIndicator } = require('react-native');
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe('#FFFFFF');
  });

  it('uses white spinner colour for secondary variant', () => {
    const { UNSAFE_getByType } = render(
      <Button {...defaultProps} variant="secondary" loading={true} />,
    );
    const { ActivityIndicator } = require('react-native');
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe('#FFFFFF');
  });

  it('uses accent spinner colour for outline variant', () => {
    const { UNSAFE_getByType } = render(
      <Button {...defaultProps} variant="outline" loading={true} />,
    );
    const { ActivityIndicator } = require('react-native');
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe('#D4A574');
  });

  it('uses accent spinner colour for ghost variant', () => {
    const { UNSAFE_getByType } = render(
      <Button {...defaultProps} variant="ghost" loading={true} />,
    );
    const { ActivityIndicator } = require('react-native');
    const spinner = UNSAFE_getByType(ActivityIndicator);
    expect(spinner.props.color).toBe('#D4A574');
  });

  // --- Custom className ---

  it('applies custom className to the container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} className="mt-4" />,
    );
    const root = toJSON();
    expect(root).toBeTruthy();
    expect(root!.props.className).toContain('mt-4');
  });

  // --- Variant className on container ---

  it('applies primary variant classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} variant="primary" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('bg-[#D4A574]');
  });

  it('applies secondary variant classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} variant="secondary" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('bg-[#1A5E63]');
  });

  it('applies outline variant classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} variant="outline" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('border-2');
    expect(root!.props.className).toContain('border-[#D4A574]');
  });

  it('applies ghost variant classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} variant="ghost" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('bg-transparent');
  });

  // --- Size className on container ---

  it('applies sm size classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} size="sm" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('px-4');
    expect(root!.props.className).toContain('py-2');
    expect(root!.props.className).toContain('rounded-lg');
  });

  it('applies md size classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} size="md" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('px-6');
    expect(root!.props.className).toContain('py-3');
    expect(root!.props.className).toContain('rounded-xl');
  });

  it('applies lg size classes to container', () => {
    const { toJSON } = render(
      <Button {...defaultProps} size="lg" />,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('px-8');
    expect(root!.props.className).toContain('py-4');
    expect(root!.props.className).toContain('rounded-xl');
  });

  // --- Text variant classes ---

  it('applies primary text classes', () => {
    render(<Button {...defaultProps} variant="primary" />);
    const text = screen.getByText('Press Me');
    expect(text.props.className).toContain('text-white');
  });

  it('applies outline text classes', () => {
    render(<Button {...defaultProps} variant="outline" />);
    const text = screen.getByText('Press Me');
    expect(text.props.className).toContain('text-[#D4A574]');
  });

  it('applies ghost text classes', () => {
    render(<Button {...defaultProps} variant="ghost" />);
    const text = screen.getByText('Press Me');
    expect(text.props.className).toContain('text-[#1A5E63]');
  });

  // --- Icon spacing ---

  it('adds ml-2 to text when icon is present', () => {
    const icon = <Text>IC</Text>;
    render(<Button {...defaultProps} icon={icon} />);
    const title = screen.getByText('Press Me');
    expect(title.props.className).toContain('ml-2');
  });

  it('does not add ml-2 to text when no icon', () => {
    render(<Button {...defaultProps} />);
    const title = screen.getByText('Press Me');
    expect(title.props.className).not.toContain('ml-2');
  });
});
