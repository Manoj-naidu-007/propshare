import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CompanyLayout() {
  const insets = useSafeAreaInsets();
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
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard", tabBarIcon: ({ color, size }) => <Ionicons name="grid" size={size} color={color} /> }} />
      <Tabs.Screen name="properties" options={{ title: "Properties", tabBarIcon: ({ color, size }) => <Ionicons name="business" size={size} color={color} /> }} />
      <Tabs.Screen name="add-property" options={{ title: "Add", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" size={size + 4} color={color} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: ({ color, size }) => <Ionicons name="wallet" size={size} color={color} /> }} />
    </Tabs>
  );
}
