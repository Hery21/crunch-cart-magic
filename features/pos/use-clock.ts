import { useEffect, useState } from "react";

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);
  return now.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
