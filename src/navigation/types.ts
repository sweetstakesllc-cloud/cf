import type { NavigatorScreenParams } from '@react-navigation/native';

/** Bottom tabs. */
export type TabParamList = {
  Home: undefined;
  Saved: undefined;
  Alerts: undefined;
  Sell: undefined;
  Account: undefined;
};

/**
 * Root stack. Product detail lives ABOVE the tabs so it covers the bar and
 * reads as a focused conversion screen — reachable from Home, Saved or Alerts.
 * Rewards / Refer / Live / Chat are the v2/v3 engagement screens, pushed from
 * the Account hub.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList>;
  Product: { id: string };
  Rewards: undefined;
  Refer: undefined;
  Live: undefined;
  Chat: undefined;
};

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
