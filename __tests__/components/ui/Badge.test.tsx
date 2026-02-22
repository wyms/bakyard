import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { View } from 'react-native';
import Badge from '@/components/ui/Badge';

describe('Badge', () => {
  // --- Basic rendering ---

  it('renders the label text', () => {
    render(<Badge label="New" />);
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('renders different label values', () => {
    const { rerender } = render(<Badge label="Active" />);
    expect(screen.getByText('Active')).toBeTruthy();

    rerender(<Badge label="Expired" />);
    expect(screen.getByText('Expired')).toBeTruthy();
  });

  // --- Default props ---

  it('uses default variant and size when none specified', () => {
    const { UNSAFE_getAllByType } = render(<Badge label="Default" />);
    const views = UNSAFE_getAllByType(View);
    const container = views[0];
    // default variant container: 'bg-accent/20'
    expect(container.props.className).toContain('bg-accent/20');
    // md size container: 'px-3 py-1'
    expect(container.props.className).toContain('px-3');
    expect(container.props.className).toContain('py-1');
  });

  // --- Variants ---

  describe('variants', () => {
    it('renders with default variant', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Test" variant="default" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('bg-accent/20');
    });

    it('renders with success variant', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Test" variant="success" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('bg-primary/20');
    });

    it('renders with warning variant', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Test" variant="warning" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('bg-accent/20');
    });

    it('renders with info variant', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Test" variant="info" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('bg-primary/20');
    });

    it('renders with accent variant', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Test" variant="accent" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('bg-error/20');
    });
  });

  // --- Sizes ---

  describe('sizes', () => {
    it('renders with sm size', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Small" size="sm" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('px-2');
      expect(container.props.className).toContain('py-0.5');
    });

    it('renders with md size', () => {
      const { UNSAFE_getAllByType } = render(
        <Badge label="Medium" size="md" />,
      );
      const container = UNSAFE_getAllByType(View)[0];
      expect(container.props.className).toContain('px-3');
      expect(container.props.className).toContain('py-1');
    });
  });

  // --- Text styling per variant ---

  describe('text styling', () => {
    it('applies correct text class for default variant', () => {
      render(<Badge label="Default" variant="default" />);
      const text = screen.getByText('Default');
      expect(text.props.className).toContain('text-accent');
    });

    it('applies correct text class for success variant', () => {
      render(<Badge label="Success" variant="success" />);
      const text = screen.getByText('Success');
      expect(text.props.className).toContain('text-primary');
    });

    it('applies correct text class for warning variant', () => {
      render(<Badge label="Warning" variant="warning" />);
      const text = screen.getByText('Warning');
      expect(text.props.className).toContain('text-accent');
    });

    it('applies correct text class for info variant', () => {
      render(<Badge label="Info" variant="info" />);
      const text = screen.getByText('Info');
      expect(text.props.className).toContain('text-primary');
    });

    it('applies correct text class for accent variant', () => {
      render(<Badge label="Accent" variant="accent" />);
      const text = screen.getByText('Accent');
      expect(text.props.className).toContain('text-error');
    });
  });

  // --- Text sizing ---

  describe('text sizing', () => {
    it('applies text-xs for sm size', () => {
      render(<Badge label="Small" size="sm" />);
      const text = screen.getByText('Small');
      expect(text.props.className).toContain('text-xs');
    });

    it('applies text-sm for md size', () => {
      render(<Badge label="Medium" size="md" />);
      const text = screen.getByText('Medium');
      expect(text.props.className).toContain('text-sm');
    });
  });

  // --- Base classes ---

  it('always includes rounded-full and self-start', () => {
    const { UNSAFE_getAllByType } = render(<Badge label="Test" />);
    const container = UNSAFE_getAllByType(View)[0];
    expect(container.props.className).toContain('rounded-full');
    expect(container.props.className).toContain('self-start');
  });

  it('always includes font-semibold on text', () => {
    render(<Badge label="Test" />);
    const text = screen.getByText('Test');
    expect(text.props.className).toContain('font-semibold');
  });
});
