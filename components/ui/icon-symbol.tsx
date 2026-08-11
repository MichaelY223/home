// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'calendar': 'calendar-today',
  'camera.fill': 'camera-alt',
  'cart.fill': 'shopping-cart',
  'chart.bar.fill': 'bar-chart',
  'checkmark.circle.fill': 'check-circle',
  'chevron.left': 'chevron-left',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'circle': 'radio-button-unchecked',
  'figure.walk': 'directions-walk',
  'heart': 'favorite-border',
  'heart.fill': 'favorite',
  'house.fill': 'home',
  'key.fill': 'key',
  'leaf.fill': 'eco',
  'list.bullet': 'format-list-bulleted',
  'paperplane.fill': 'send',
  'pencil': 'edit',
  'person.2.fill': 'group',
  'person.badge.plus': 'person-add',
  'person.crop.circle.fill': 'account-circle',
  'photo.on.rectangle.angled': 'photo-library',
  'plus.circle.fill': 'add-circle',
  'snowflake': 'ac-unit',
  'trash.fill': 'delete',
  'xmark.circle.fill': 'cancel',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
