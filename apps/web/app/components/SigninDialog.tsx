"use client";

import { useState } from "react";
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
  const { userId, saveUserIdentity } = useUserIdentity();

  const [tempId, setTempId] = useState(userId || "");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveUserIdentity({
      userId: tempId,
    });
    window.location.reload();
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          {userId ? "Edit Profile" : "Set Profile"}
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