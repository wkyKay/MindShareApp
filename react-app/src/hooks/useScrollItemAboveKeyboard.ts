import { useCallback, useEffect, useRef, useState } from 'react';
import { Keyboard, Platform, type FlatList, type LayoutChangeEvent } from 'react-native';

type ItemLayout = {
  y: number;
  height: number;
};

type ScrollItemOptions = {
  fallbackIndex: number;
  animated?: boolean;
  gap?: number;
};

export function useScrollItemAboveKeyboard<ItemT>() {
  const listRef = useRef<FlatList<ItemT>>(null);
  const itemLayouts = useRef(new Map<number, ItemLayout>());
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [listViewportHeight, setListViewportHeight] = useState(0);
  const [bottomAccessoryHeight, setBottomAccessoryHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setKeyboardInset(event.endCoordinates.height);
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const registerItemLayout = useCallback((itemId: number, event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout;
    itemLayouts.current.set(itemId, { y, height });
  }, []);

  const handleListLayout = useCallback((event: LayoutChangeEvent) => {
    setListViewportHeight(event.nativeEvent.layout.height);
  }, []);

  const handleBottomAccessoryLayout = useCallback((event: LayoutChangeEvent) => {
    setBottomAccessoryHeight(event.nativeEvent.layout.height);
  }, []);

  const scrollItemAboveKeyboard = useCallback((itemId: number, options: ScrollItemOptions) => {
    const gap = options.gap ?? 12;
    const layout = itemLayouts.current.get(itemId);
    if (layout && listViewportHeight > 0) {
      const targetOffset = Math.max(0, layout.y + layout.height - listViewportHeight + gap);
      listRef.current?.scrollToOffset({ offset: targetOffset, animated: options.animated ?? true });
      return;
    }

    listRef.current?.scrollToIndex({
      index: options.fallbackIndex,
      animated: options.animated ?? true,
      viewPosition: 1,
      viewOffset: gap,
    });
  }, [listViewportHeight]);

  return {
    bottomAccessoryHeight,
    handleBottomAccessoryLayout,
    handleListLayout,
    keyboardInset,
    listRef,
    registerItemLayout,
    scrollItemAboveKeyboard,
  };
}
