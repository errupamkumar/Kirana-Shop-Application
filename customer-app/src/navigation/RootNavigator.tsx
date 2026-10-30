import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer, type LinkingOptions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { House, ReceiptText, UserRound } from 'lucide-react-native';
import { useEffect } from 'react';
import { ActivityIndicator, Platform, Text, View } from 'react-native';
import { AddressesScreen } from '../screens/AddressesScreen';
import { AddressFormScreen } from '../screens/AddressFormScreen';
import { CartScreen } from '../screens/CartScreen';
import { CategoryScreen } from '../screens/CategoryScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MyOrdersScreen } from '../screens/MyOrdersScreen';
import { OrderDetailScreen } from '../screens/OrderDetailScreen';
import { OrderSuccessScreen } from '../screens/OrderSuccessScreen';
import { OtpScreen } from '../screens/OtpScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { SearchScreen } from '../screens/SearchScreen';
import { useAuthStore } from '../store/session';
import { colors } from '../theme';
import type { AppStackParamList, AuthStackParamList, TabParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack = createNativeStackNavigator<AppStackParamList>();
const Tabs = createBottomTabNavigator<TabParamList>();

const theme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.brand, background: colors.canvas, card: colors.surface, border: colors.line, text: colors.ink },
};

/**
 * URLs for the browser build and kirana:// deep links: refresh and back work on the web,
 * and links like kirana://orders/12 open the right screen on Android.
 */
const linking: LinkingOptions<ReactNavigation.RootParamList> = {
  prefixes: ['kirana://'],
  config: {
    screens: {
      Login: 'login',
      Otp: 'verify',
      Tabs: {
        screens: {
          Home: '',
          Orders: 'orders',
          Profile: 'account',
        },
      },
      Category: { path: 'category/:categoryId', parse: { categoryId: Number } },
      Search: 'search',
      Cart: 'cart',
      Addresses: 'addresses',
      AddressForm: { path: 'address/:addressId?', parse: { addressId: Number } },
      OrderSuccess: { path: 'order-placed/:orderId', parse: { orderId: Number } },
      OrderDetail: { path: 'orders/:orderId', parse: { orderId: Number } },
    },
  } as LinkingOptions<ReactNavigation.RootParamList>['config'],
};

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        // Browsers have no bottom safe-area inset, so give the labels explicit room there
        tabBarStyle: Platform.OS === 'web' ? { borderTopColor: colors.line, height: 64, paddingTop: 6, paddingBottom: 8 } : { borderTopColor: colors.line },
      }}
    >
      <Tabs.Screen name="Home" component={HomeScreen} options={{ title: 'Home', tabBarIcon: ({ color, size }) => <House color={color} size={size - 2} /> }} />
      <Tabs.Screen
        name="Orders"
        component={MyOrdersScreen}
        options={{ title: 'Orders', tabBarIcon: ({ color, size }) => <ReceiptText color={color} size={size - 2} /> }}
      />
      <Tabs.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Account', tabBarIcon: ({ color, size }) => <UserRound color={color} size={size - 2} /> }}
      />
    </Tabs.Navigator>
  );
}

function Splash() {
  return (
    <View className="flex-1 items-center justify-center bg-accent">
      <View className="mb-4 h-20 w-20 items-center justify-center rounded-3xl bg-white">
        <Text className="text-4xl">🛒</Text>
      </View>
      <Text className="mb-6 text-3xl font-extrabold text-gray-900">Kirana</Text>
      <ActivityIndicator color={colors.brand} />
    </View>
  );
}

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  if (status === 'loading') return <Splash />;

  return (
    <NavigationContainer
      theme={theme}
      linking={linking}
      documentTitle={{ formatter: (options, route) => `${options?.title ?? route?.name ?? 'Kirana'} · Kirana` }}
    >
      {status === 'signedOut' ? (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Login" component={LoginScreen} options={{ title: 'Log in' }} />
          <AuthStack.Screen
            name="Otp"
            component={OtpScreen}
            options={{ headerShown: true, title: 'Verify', headerShadowVisible: false, headerTintColor: colors.ink }}
          />
        </AuthStack.Navigator>
      ) : (
        <AppStack.Navigator
          screenOptions={{
            headerTintColor: colors.ink,
            headerTitleStyle: { fontWeight: '800' },
            headerShadowVisible: false,
            headerStyle: { backgroundColor: colors.surface },
            animation: Platform.OS === 'web' ? 'none' : 'slide_from_right',
          }}
        >
          <AppStack.Screen name="Tabs" component={MainTabs} options={{ headerShown: false, title: 'Groceries' }} />
          <AppStack.Screen name="Category" component={CategoryScreen} />
          <AppStack.Screen name="Search" component={SearchScreen} options={{ title: 'Search' }} />
          <AppStack.Screen name="Cart" component={CartScreen} options={{ title: 'Cart & checkout' }} />
          <AppStack.Screen name="Addresses" component={AddressesScreen} options={{ title: 'Delivery address' }} />
          <AppStack.Screen name="AddressForm" component={AddressFormScreen} options={{ title: 'Address' }} />
          <AppStack.Screen name="OrderSuccess" component={OrderSuccessScreen} options={{ headerShown: false, gestureEnabled: false, title: 'Order placed' }} />
          <AppStack.Screen name="OrderDetail" component={OrderDetailScreen} options={{ title: 'Order' }} />
        </AppStack.Navigator>
      )}
    </NavigationContainer>
  );
}
