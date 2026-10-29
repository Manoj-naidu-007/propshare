import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/src/auth";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const { user, loading } = useAuth();
  if (!loading && !user) return <Redirect href="/(auth)/signup" />;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surfaceSecondary, borderTopColor: colors.border, height: 60 + insets.bottom, paddingBottom: insets.bottom + 6, paddingTop: 6 },
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.onSurfaceTertiary,
        tabBarLabelStyle: { fontSize: 11 },
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Overview", tabBarIcon: ({ color, size }) => <Ionicons name="stats-chart" size={size} color={color} /> }} />
      <Tabs.Screen name="approvals" options={{ title: "Approvals", tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} /> }} />
      <Tabs.Screen name="users" options={{ title: "Users", tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} /> }} />
      <Tabs.Screen name="interest" options={{ title: "Interest", tabBarIcon: ({ color, size }) => <Ionicons name="trending-up" size={size} color={color} /> }} />
    </Tabs>
  );
}