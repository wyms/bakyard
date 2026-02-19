import React from 'react';
import { render } from '@testing-library/react-native';
import { View } from 'react-native';
import Skeleton from '@/components/ui/Skeleton';

// react-native-reanimated is mocked globally in jest.setup.js

describe('Skeleton', () => {
  // --- Basic rendering ---

  it('renders without crashing', () => {
    const { UNSAFE_getAllByType } = render(
      <Skeleton width={100} height={20} />,
    );
    // Should render at least one View (the outer wrapper)
    const views = UNSAFE_getAllByType(View);
    expect(views.length).toBeGreaterThanOrEqual(1);
  });

  // --- Width and height ---

  it('renders with given numeric width and height', () => {
    const { toJSON } = render(<Skeleton width={200} height={40} />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    // The Animated.View (rendered as View by mock) should carry the style
    const json = JSON.stringify(tree);
    expect(json).toContain('200');
    expect(json).toContain('40');
  });

  it('renders with string width and height', () => {
    const { toJSON } = render(<Skeleton width="100%" height="50%" />);
    const tree = toJSON();
    expect(tree).toBeTruthy();
    const json = JSON.stringify(tree);
    expect(json).toContain('100%');
    expect(json).toContain('50%');
  });

  // --- Border radius ---

  it('uses default borderRadius of 8', () => {
    const { toJSON } = render(<Skeleton width={100} height={20} />);
    const json = JSON.stringify(toJSON());
    // borderRadius: 8 should appear in the style
    expect(json).toContain('"borderRadius":8');
  });

  it('accepts custom borderRadius', () => {
    const { toJSON } = render(
      <Skeleton width={100} height={20} borderRadius={16} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderRadius":16');
  });

  it('accepts borderRadius of 0', () => {
    const { toJSON } = render(
      <Skeleton width={100} height={20} borderRadius={0} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('"borderRadius":0');
  });

  // --- Background color ---

  it('uses #E0E0E0 as the background color', () => {
    const { toJSON } = render(<Skeleton width={100} height={20} />);
    const json = JSON.stringify(toJSON());
    expect(json).toContain('#E0E0E0');
  });

  // --- className prop ---

  it('applies custom className to the outer View', () => {
    const { UNSAFE_getAllByType } = render(
      <Skeleton width={100} height={20} className="mt-4 mx-2" />,
    );
    const views = UNSAFE_getAllByType(View);
    // The first View is the outer wrapper that receives className
    const outerView = views[0];
    expect(outerView.props.className).toContain('mt-4 mx-2');
  });

  it('uses empty className by default', () => {
    const { UNSAFE_getAllByType } = render(
      <Skeleton width={100} height={20} />,
    );
    const views = UNSAFE_getAllByType(View);
    const outerView = views[0];
    // className should be empty string by default
    expect(outerView.props.className).toBe('');
  });

  // --- Different dimension combinations ---

  it('renders a thin line skeleton', () => {
    const { toJSON } = render(<Skeleton width={300} height={2} />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders a square skeleton', () => {
    const { toJSON } = render(
      <Skeleton width={50} height={50} borderRadius={25} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('50');
    expect(json).toContain('"borderRadius":25');
  });

  it('renders a full-width skeleton with percentage', () => {
    const { toJSON } = render(
      <Skeleton width="100%" height={16} borderRadius={4} />,
    );
    const json = JSON.stringify(toJSON());
    expect(json).toContain('100%');
    expect(json).toContain('16');
    expect(json).toContain('"borderRadius":4');
  });
});
