import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API_URL = "http://localhost:3001";

export interface Room {
  document_id: string;
  name: string;
  timestamp: string;
  message_count: number;
  user_count: number;
}

export interface RoomResponse {
  room: Room;
}

export const fetchRoomById = async (roomId: string): Promise<RoomResponse> => {
  const response = await fetch(`${API_URL}/room/rooms/${roomId}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch room: ${response.statusText}`);
  }

  return response.json();
};

export const useRoomById = (roomId: string) => {
  return useQuery({
    queryKey: ["room", roomId],
    queryFn: () => fetchRoomById(roomId),
    enabled: !!roomId,
  });
};

// Update room name
export const updateRoomName = async (
  roomId: string,
  name: string
): Promise<{ success: boolean; name: string }> => {
  const response = await fetch(`${API_URL}/room/rooms/${roomId}/name`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error(`Failed to update room name: ${response.statusText}`);
  }

  return response.json();
};

export const useUpdateRoomName = (roomId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => updateRoomName(roomId, name),
    // Optimistic update - update immediately before request completes
    onMutate: async (newName) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["room", roomId] });

      // Snapshot the previous value
      const previousRoom = queryClient.getQueryData<RoomResponse>(["room", roomId]);

      // Optimistically update to the new value
      queryClient.setQueryData<RoomResponse>(["room", roomId], (old) => {
        if (!old) return old;
        return {
          ...old,
          room: {
            ...old.room,
            name: newName,
          },
        };
      });

      // Return context with the previous value
      return { previousRoom };
    },
    // If mutation fails, rollback to previous value
    onError: (err, newName, context) => {
      if (context?.previousRoom) {
        queryClient.setQueryData(["room", roomId], context.previousRoom);
      }
    },
    // Always refetch after error or success to ensure consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["room", roomId] });
    },
  });
};
