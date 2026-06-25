import { loadSettings } from "@/lib/pos-store";
import { useEffect, useState } from "react";

export function useAdminAuth() {
  const [authed, setAuthed] = useState(false);
  const [pin, setPin] = useState("");
  const [storedPin, setStoredPin] = useState("1234");

  useEffect(() => {
    loadSettings().then((s) => setStoredPin(s.pin));
  }, []);

  function tryLogin(): boolean {
    if (pin !== storedPin) return false;
    setAuthed(true);
    setPin("");
    return true;
  }

  return { authed, pin, setPin, tryLogin, logout: () => setAuthed(false) };
}
