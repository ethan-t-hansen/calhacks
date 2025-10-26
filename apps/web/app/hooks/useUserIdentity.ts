import { useEffect, useState } from "react";

export function useUserIdentity() {
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("collabUser");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUserId(parsed.userId || "");
    } else {
      const newUser = {
        userId: `user_${Math.random().toString(36).slice(2, 8)}`,
        userName: "",
        userColor: "#667eea",
      };
      localStorage.setItem("collabUser", JSON.stringify(newUser));
      setUserId(newUser.userId);
    }
  }, []);

  const saveUserIdentity = (data: {
    userId?: string;
  }) => {
    const updated = { userId, ...data };
    localStorage.setItem("collabUser", JSON.stringify(updated));
    if (data.userId !== undefined) setUserId(data.userId);
  };

  return { userId, saveUserIdentity };
}