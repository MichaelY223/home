import DateTimePicker from '@react-native-community/datetimepicker';
import { useState } from 'react';
import { Dimensions, Platform, Pressable, View } from 'react-native';

// The iOS "inline" calendar has a fixed intrinsic width (~320pt) that doesn't
// shrink to fit the screen, so it gets clipped in a padded card on smaller
// phones (e.g. iPhone SE). Fall back to the compact "spinner" wheel there,
// which fits any width.
const IS_NARROW_SCREEN = Dimensions.get('window').width < 375;

import { ThemedText } from '@/components/themed-text';
import { Fonts, HomeCircleTheme as Theme } from '@/constants/home-circle-theme';

// react-native-web has no host component for <input>; casting to `any`
// sidesteps the JSX.IntrinsicElements check while still rendering a real
// DOM date input at runtime (only reached in the Platform.OS === 'web' branch).
const WebDateInput = 'input' as any;

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

type BirthdayFieldProps = {
  value: Date | null;
  onChange: (date: Date) => void;
  placeholder?: string;
  hasError?: boolean;
};

export function BirthdayField({ value, onChange, placeholder = 'Tap to select', hasError = false }: BirthdayFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  const fieldStyle = {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: hasError ? 2 : 1,
    borderColor: hasError ? Theme.danger : Theme.border,
    backgroundColor: Theme.background,
    paddingHorizontal: 16,
    color: Theme.ink,
    fontSize: 16,
    fontFamily: Fonts.sans,
  };

  // @react-native-community/datetimepicker has no web implementation
  // (it renders null there), so fall back to a native HTML date input.
  if (Platform.OS === 'web') {
    return (
      <WebDateInput
        type="date"
        value={value ? toDateKey(value) : ''}
        max={toDateKey(new Date())}
        onChange={(e: { target: { value: string } }) => {
          if (!e.target.value) return;
          const [y, m, d] = e.target.value.split('-').map(Number);
          onChange(new Date(y, m - 1, d));
        }}
        style={{
          ...fieldStyle,
          borderCurve: 'continuous',
          border: `${fieldStyle.borderWidth}px solid ${fieldStyle.borderColor}`,
          outline: 'none',
          boxSizing: 'border-box',
          width: '100%',
        }}
      />
    );
  }

  return (
    <View>
      <Pressable
        onPress={() => setShowPicker((prev) => !prev)}
        style={[fieldStyle, { borderCurve: 'continuous', justifyContent: 'center' }]}>
        <ThemedText
          lightColor={value ? Theme.ink : Theme.muted}
          darkColor={value ? Theme.ink : Theme.muted}
          style={{ fontSize: 16, fontFamily: Fonts.sans }}>
          {value ? toDateKey(value) : placeholder}
        </ThemedText>
      </Pressable>
      {showPicker && (
        <View
          style={{
            marginTop: 8,
            borderRadius: 14,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: Theme.border,
            backgroundColor: Theme.surface,
            overflow: 'hidden',
          }}>
          <DateTimePicker
            value={value ?? new Date(2000, 0, 1)}
            mode="date"
            display={Platform.OS === 'ios' ? (IS_NARROW_SCREEN ? 'spinner' : 'inline') : 'default'}
            themeVariant="light"
            maximumDate={new Date()}
            style={{ alignSelf: 'stretch' }}
            onChange={(_, date) => {
              setShowPicker(Platform.OS === 'ios');
              if (date) onChange(date);
            }}
          />
        </View>
      )}
    </View>
  );
}
