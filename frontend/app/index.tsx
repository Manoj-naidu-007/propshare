import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "@/src/auth";
import { colors } from "@/src/theme";

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.brand} size="large" />
      </View>
    );
  }

  if (!user) return <Redirect href="/(auth)/welcome" />;
  if (user.role === "Admin") return <Redirect href="/(admin)/dashboard" />;
  if (user.role === "Company") return <Redirect href="/(company)/dashboard" />;
  return <Redirect href="/(investor)/home" />;
}
