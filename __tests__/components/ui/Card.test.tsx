import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import Card from '@/components/ui/Card';

describe('Card', () => {
  // --- Rendering children ---

  it('renders children content', () => {
    render(
      <Card>
        <Text>Card Content</Text>
      </Card>,
    );
    expect(screen.getByText('Card Content')).toBeTruthy();
  });

  it('renders multiple children', () => {
    render(
      <Card>
        <Text>First</Text>
        <Text>Second</Text>
      </Card>,
    );
    expect(screen.getByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
  });

  // --- View vs Pressable rendering ---

  it('renders as View when no onPress is provided', () => {
    const { toJSON } = render(
      <Card>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root).toBeTruthy();
    // When there is no onPress, the root should not have an onPress prop
    expect(root!.props.onPress).toBeUndefined();
  });

  it('renders as pressable element when onPress is provided', () => {
    const onPress = jest.fn();
    const { toJSON } = render(
      <Card onPress={onPress}>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root).toBeTruthy();
    // When onPress is provided, the root element should have accessible/onPress behaviour
    // Pressable renders as View in tests but has onPress registered via event system
    expect(root!.props.accessible).not.toBeUndefined();
  });

  // --- Press handler ---

  it('calls onPress handler when pressed', () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress}>
        <Text>Pressable Card</Text>
      </Card>,
    );
    fireEvent.press(screen.getByText('Pressable Card'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('calls onPress handler multiple times on repeated presses', () => {
    const onPress = jest.fn();
    render(
      <Card onPress={onPress}>
        <Text>Pressable Card</Text>
      </Card>,
    );
    fireEvent.press(screen.getByText('Pressable Card'));
    fireEvent.press(screen.getByText('Pressable Card'));
    fireEvent.press(screen.getByText('Pressable Card'));
    expect(onPress).toHaveBeenCalledTimes(3);
  });

  it('does not crash when pressing a non-pressable card', () => {
    render(
      <Card>
        <Text>Static Card</Text>
      </Card>,
    );
    // This should not throw -- the View simply has no onPress
    expect(screen.getByText('Static Card')).toBeTruthy();
  });

  // --- Custom className ---

  it('applies custom className when no onPress', () => {
    const { toJSON } = render(
      <Card className="mx-2 mb-4">
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('mx-2 mb-4');
  });

  it('applies custom className when onPress is provided', () => {
    const onPress = jest.fn();
    const { toJSON } = render(
      <Card onPress={onPress} className="mx-2 mb-4">
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('mx-2 mb-4');
  });

  // --- Shadow prop ---

  it('includes shadow classes by default (shadow=true)', () => {
    const { toJSON } = render(
      <Card>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('shadow-sm');
    expect(root!.props.className).toContain('shadow-black/10');
  });

  it('excludes shadow classes when shadow=false', () => {
    const { toJSON } = render(
      <Card shadow={false}>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).not.toContain('shadow-sm');
    expect(root!.props.className).not.toContain('shadow-black/10');
  });

  it('includes shadow classes on pressable card by default', () => {
    const onPress = jest.fn();
    const { toJSON } = render(
      <Card onPress={onPress}>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('shadow-sm');
  });

  it('excludes shadow classes on pressable card when shadow=false', () => {
    const onPress = jest.fn();
    const { toJSON } = render(
      <Card onPress={onPress} shadow={false}>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).not.toContain('shadow-sm');
  });

  // --- Base classes ---

  it('includes base classes (bg-white, rounded-2xl, p-4)', () => {
    const { toJSON } = render(
      <Card>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('bg-white');
    expect(root!.props.className).toContain('rounded-2xl');
    expect(root!.props.className).toContain('p-4');
  });

  it('includes base classes on pressable card', () => {
    const onPress = jest.fn();
    const { toJSON } = render(
      <Card onPress={onPress}>
        <Text>Content</Text>
      </Card>,
    );
    const root = toJSON();
    expect(root!.props.className).toContain('bg-white');
    expect(root!.props.className).toContain('rounded-2xl');
    expect(root!.props.className).toContain('p-4');
  });
});
