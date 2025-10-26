import { useEffect, useState } from "react";

export function useUserIdentity() {
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [userColor, setUserColor] = useState("#667eea");

  useEffect(() => {
    const stored = localStorage.getItem("collabUser");
    if (stored) {
      const parsed = JSON.parse(stored);
      setUserId(parsed.userId);
      setUserName(parsed.userName);
      setUserColor(parsed.userColor);
    } else {
      const newUser = {
        userId: `user_${Math.random().toString(36).slice(2, 8)}`,
        userName: "",
        userColor: "#667eea",
      };
      localStorage.setItem("collabUser", JSON.stringify(newUser));
      setUserId(newUser.userId);
      setUserName(newUser.userName);
      setUserColor(newUser.userColor);
    }
  }, []);

  const saveUserIdentity = (data: {
    userId?: string;
    userName?: string;
    userColor?: string;
  }) => {
    const updated = { userId, userName, userColor, ...data };
    localStorage.setItem("collabUser", JSON.stringify(updated));
    setUserId(updated.userId);
    setUserName(updated.userName);
    setUserColor(updated.userColor);
  };

  return { userId, userName, userColor, saveUserIdentity };
}