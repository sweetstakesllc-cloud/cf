import React from 'react';
import { Platform } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { color, font, border } from '../theme';
import { features } from '../features';
import type { RootStackParamList, TabParamList } from './types';

import HomeScreen from '../screens/HomeScreen';
import SavedScreen from '../screens/SavedScreen';
import AlertsScreen from '../screens/AlertsScreen';
import SellScreen from '../screens/SellScreen';
import AccountScreen from '../screens/AccountScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import RewardsScreen from '../screens/RewardsScreen';
import ReferScreen from '../screens/ReferScreen';
import LiveScreen from '../screens/LiveScreen';
import ChatScreen from '../screens/ChatScreen';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

type TabIconName = keyof typeof Ionicons.glyphMap;
const ICONS: Record<keyof TabParamList, { on: TabIconName; off: TabIconName }> = {
  Home: { on: 'grid', off: 'grid-outline' },
  Saved: { on: 'bookmark', off: 'bookmark-outline' },
  Alerts: { on: 'notifications', off: 'notifications-outline' },
  Sell: { on: 'pricetag', off: 'pricetag-outline' },
  Account: { on: 'person', off: 'person-outline' },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // One accent per screen: the active tab is the only hi-vis element in
        // the bar. Inactive tabs stay mono-ink.
        tabBarActiveTintColor: color.hiVis,
        tabBarInactiveTintColor: color.paperDim,
        tabBarStyle: {
          backgroundColor: color.ink,
          borderTopColor: color.line,
          borderTopWidth: border.hairline,
          height: Platform.OS === 'ios' ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: font.mono,
          fontSize: 10,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        },
        tabBarIcon: ({ focused, color: tint, size }) => {
          const name = ICONS[route.name].on;
          const off = ICONS[route.name].off;
          return <Ionicons name={focused ? name : off} size={size - 2} color={tint} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Saved" component={SavedScreen} />
      {features.alerts && <Tab.Screen name="Alerts" component={AlertsScreen} />}
      {features.sell && <Tab.Screen name="Sell" component={SellScreen} />}
      <Tab.Screen name="Account" component={AccountScreen} />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: color.ink },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen
        name="Product"
        component={ProductDetailScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
      {features.rewards && <Stack.Screen name="Rewards" component={RewardsScreen} />}
      {features.refer && <Stack.Screen name="Refer" component={ReferScreen} />}
      {features.live && <Stack.Screen name="Live" component={LiveScreen} />}
      {features.chat && (
        <Stack.Screen
          name="Chat"
          component={ChatScreen}
          options={{ animation: 'slide_from_bottom' }}
        />
      )}
    </Stack.Navigator>
  );
}
