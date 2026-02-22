import React, { useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { View, Text, Pressable } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

export interface BottomSheetRef {
  expand: () => void;
  close: () => void;
}

interface BottomSheetProps {
  children: React.ReactNode;
  snapPoints?: string[];
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  function BottomSheet(
    {
      children,
      snapPoints = ['50%'],
      isOpen,
      onClose,
      title,
    },
    ref,
  ) {
    const sheetRef = useRef<GorhomBottomSheet>(null);

    useImperativeHandle(ref, () => ({
      expand: () => sheetRef.current?.expand(),
      close: () => sheetRef.current?.close(),
    }));

    useEffect(() => {
      if (isOpen) {
        sheetRef.current?.expand();
      } else {
        sheetRef.current?.close();
      }
    }, [isOpen]);

    const handleSheetChanges = useCallback(
      (index: number) => {
        if (index === -1) {
          onClose();
        }
      },
      [onClose],
    );

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.5}
          pressBehavior="close"
        />
      ),
      [],
    );

    return (
      <GorhomBottomSheet
        ref={sheetRef}
        index={isOpen ? 0 : -1}
        snapPoints={snapPoints}
        onChange={handleSheetChanges}
        backdropComponent={renderBackdrop}
        enablePanDownToClose
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        backgroundStyle={{ backgroundColor: '#FBF7F2', borderRadius: 24 }}
        handleIndicatorStyle={{ backgroundColor: 'rgba(17,24,39,0.12)', width: 40 }}
      >
        <BottomSheetView className="flex-1 px-4 pb-4">
          {title && (
            <View className="flex-row items-center justify-between mb-4">
              <Text className="text-lg font-bold text-text">{title}</Text>
              <Pressable
                onPress={onClose}
                className="w-8 h-8 rounded-full bg-bg items-center justify-center"
              >
                <Text className="text-base text-gray-500">✕</Text>
              </Pressable>
            </View>
          )}
          {children}
        </BottomSheetView>
      </GorhomBottomSheet>
    );
  },
);

export default BottomSheet;
