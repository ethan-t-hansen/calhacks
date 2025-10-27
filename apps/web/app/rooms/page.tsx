"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AuthWrapper from "../wrap/AuthWrapper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";

interface Room {
  document_id: string;
  name: string;
  timestamp: string;
}

export default function Rooms() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const response = await fetch("http://localhost:3001/room/list");
      const data = await response.json();
      setRooms(data.rooms || []);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) return;

    try {
      setCreating(true);
      const response = await fetch("http://localhost:3001/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newRoomName }),
      });

      const data = await response.json();

      if (response.ok) {
        setCreateDialogOpen(false);
        setNewRoomName("");
        router.push(`/rooms/${data.document_id}`);
      } else {
        console.error("Failed to create room:", data.error);
      }
    } catch (error) {
      console.error("Failed to create room:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <AuthWrapper>
      <div className="px-10 py-16 max-w-[1400px] mx-auto">
        <h1 className="text-center text-5xl font-normal mb-16">rooms</h1>

        {loading ? (
          <div className="flex justify-center items-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-6">
            {/* Create Room Button */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <button className="border-2 border-dashed border-gray-400 p-8 rounded-none min-h-[200px] flex flex-col items-center justify-center gap-4 cursor-pointer hover:bg-gray-50 hover:border-gray-600 transition">
                  <Plus className="h-12 w-12 text-gray-400" />
                  <h2 className="text-2xl font-semibold m-0 text-gray-600">
                    Create New Room
                  </h2>
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Room</DialogTitle>
                  <DialogDescription>
                    Give your room a name to get started.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input
                    placeholder="Room name..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !creating) {
                        createRoom();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <DialogFooter>
                  <Button
                    onClick={createRoom}
                    disabled={!newRoomName.trim() || creating}
                  >
                    {creating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Room"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Existing Rooms */}
            {rooms.map((room) => (
              <button
                key={room.document_id}
                onClick={() => router.push(`/rooms/${room.document_id}`)}
                className="border border-gray-800 p-8 rounded-none min-h-[200px] flex flex-col gap-3 cursor-pointer hover:bg-gray-50 transition"
              >
                <h2 className="text-2xl font-semibold m-0">{room.name}</h2>
                <p className="text-sm m-0 opacity-60">
                  Created {new Date(room.timestamp).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
        )}
      </div>
    </AuthWrapper>
  );
}
