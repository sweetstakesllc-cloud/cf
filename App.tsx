import React, { useCallback } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme, type Theme } from '@react-navigation/native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { SpaceMono_400Regular } from '@expo-google-fonts/space-mono';

import { color } from './src/theme';
import RootNavigator from './src/navigation/RootNavigator';

// Keep the splash up until the brand faces are ready — avoids a flash of the
// system fallback fonts on first paint.
SplashScreen.preventAutoHideAsync().catch(() => {});

// Keep the navigation container's own background in the brand ink so there's no
// white flash between screen transitions.
const navTheme: Theme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    background: color.ink,
    card: color.ink,
    border: color.line,
    text: color.paper,
    primary: color.hiVis,
    notification: color.hiVis,
  },
};

export default function App() {
  // The keys here are the family names referenced in theme.ts. Map each to the
  // weight we actually want loaded. Swap weights here once and the app follows.
  const [fontsLoaded] = useFonts({
    Archivo: Archivo_600SemiBold, // display / titles — tight grotesque, uppercase
    'Archivo-Bold': Archivo_700Bold,
    Inter: Inter_400Regular, // body / running text
    'Inter-Medium': Inter_500Medium,
    SpaceMono: SpaceMono_400Regular, // price / size / SKU — the spec-tag mono
  });

  const onReady = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    // Render the ink page (not white) while faces load.
    return <View style={{ flex: 1, backgroundColor: color.ink }} />;
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer theme={navTheme} onReady={onReady}>
        <StatusBar style="dark" />
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
