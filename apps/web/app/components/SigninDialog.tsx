"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserIdentity } from "../hooks/useUserIdentity";

export function SigninDialog() {
  const { userId, userName, userColor, saveUserIdentity } = useUserIdentity();

  const [tempName, setTempName] = useState(userName || "");
  const [tempColor, setTempColor] = useState(userColor || "#667eea");
  const [tempId, setTempId] = useState(userId || "");

  useEffect(() => {
    setTempName(userName);
    setTempColor(userColor);
    setTempId(userId);
  }, [userId, userName, userColor]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserIdentity({
      userId: tempId,
      userName: tempName.trim() || "Anonymous",
      userColor: tempColor,
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          {userName ? "Edit Profile" : "Set Profile"}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSave}>
          <DialogHeader>
            <DialogTitle>User Identity</DialogTitle>
            <DialogDescription>
              Set your username and color used across collaborative sessions.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* User ID */}
            <div className="grid gap-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={tempId}
                onChange={(e) => setTempId(e.target.value)}
                className="font-mono text-xs text-gray-600"
              />
              <p className="text-xs text-muted-foreground">
                This uniquely identifies you in collaboration sessions.
              </p>
            </div>

            {/* User Name */}
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                placeholder="Enter your name"
                value={tempName}
                onChange={(e) => setTempName(e.target.value)}
              />
            </div>

            {/* User Color */}
            <div className="grid gap-2">
              <Label htmlFor="color">Profile Color</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="color"
                  type="color"
                  value={tempColor}
                  onChange={(e) => setTempColor(e.target.value)}
                  className="w-16 h-10 p-1 border rounded"
                />
                <span
                  className="px-3 py-1 rounded text-xs text-white"
                  style={{ backgroundColor: tempColor }}
                >
                  {tempColor.toUpperCase()}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">
                Cancel
              </Button>
            </DialogClose>
            <DialogClose asChild>
              <Button type="submit">Save</Button>
            </DialogClose>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}