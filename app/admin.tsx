import Dashboard from "@/features/admin/dashboard";
import { useAdminAuth } from "@/features/admin/hooks";
import LoginScreen from "@/features/admin/login-screen";

export default function AdminScreen() {
  const { authed, pin, setPin, tryLogin, logout } = useAdminAuth();
  if (!authed)
    return <LoginScreen pin={pin} onChangePin={setPin} onLogin={tryLogin} />;
  return <Dashboard onLogout={logout} />;
}
