import { useEffect, useState } from "react";

function getInitialUserId() {
  if (typeof window === "undefined") return "";
  
  const stored = localStorage.getItem("collabUser");
  if (stored) {
    const parsed = JSON.parse(stored);
    return parsed.userId;
  } else {
    const newUser = {
      userId: `user_${Math.random().toString(36).slice(2, 8)}`,
    };
    localStorage.setItem("collabUser", JSON.stringify(newUser));
    return newUser.userId;
  }
}

export function useUserIdentity() {
  const [userId, setUserId] = useState(getInitialUserId);

  const saveUserIdentity = (data: {
    userId?: string;
  }) => {
    const updated = { userId, ...data };
    localStorage.setItem("collabUser", JSON.stringify(updated));
    setUserId(updated.userId);
  };

  return { userId, saveUserIdentity };
}