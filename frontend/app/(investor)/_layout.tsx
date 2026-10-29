import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/src/auth";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function InvestorLayout() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  if (!loading && !user) return <Redirect href="/(auth)/signup" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surfaceSecondary,
          borderTopColor: colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 6,
        },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="home" options={{ title: "Home", tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} /> }} />
      <Tabs.Screen name="properties" options={{ title: "Explore", tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} /> }} />
      <Tabs.Screen name="portfolio" options={{ title: "Portfolio", tabBarIcon: ({ color, size }) => <Ionicons name="pie-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="marketplace" options={{ title: "Market", tabBarIcon: ({ color, size }) => <Ionicons name="swap-horizontal" size={size} color={color} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
    </Tabs>
  );
}