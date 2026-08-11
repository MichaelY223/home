import { Platform, type ViewStyle } from 'react-native';

export const HomeCircleTheme = {
  background: '#F7F4EE',
  border: '#E7E1D5',
  coral: '#DD7856',
  coralSoft: '#FBEAE2',
  danger: '#B23A2A',
  dangerSoft: '#FBEAE6',
  gold: '#C79A44',
  goldSoft: '#FAF0D8',
  ink: '#211D1A',
  muted: '#7C766E',
  primary: '#1E5C4B',
  primaryPressed: '#16483A',
  primarySoft: '#E3EEE8',
  secondary: '#35597C',
  secondarySoft: '#E7EEF5',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  warning: '#8A5700',
  warningSoft: '#FFF1D6',
};

export const Fonts = {
  serif: 'Newsreader_500Medium',
  serifSemibold: 'Newsreader_600SemiBold',
  serifItalic: 'Newsreader_400Regular_Italic',
  serifItalicMedium: 'Newsreader_500Medium_Italic',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemibold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
  sansExtraBold: 'Inter_800ExtraBold',
};

export const Shadows = {
  sm: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1A1D21',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
    },
    android: { elevation: 1 },
    default: {},
  }) ?? {},
  md: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1A1D21',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
    },
    android: { elevation: 3 },
    default: {},
  }) ?? {},
  lg: Platform.select<ViewStyle>({
    ios: {
      shadowColor: '#1A1D21',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    android: { elevation: 6 },
    default: {},
  }) ?? {},
};

export const CardStyle: ViewStyle = {
  backgroundColor: HomeCircleTheme.surface,
  borderRadius: 22,
  borderCurve: 'continuous',
  borderWidth: 1,
  borderColor: HomeCircleTheme.border,
  ...Shadows.sm,
};

export const CardInnerStyle: ViewStyle = {
  gap: 16,
  padding: 20,
};
