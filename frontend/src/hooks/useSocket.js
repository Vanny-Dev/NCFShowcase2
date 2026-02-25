import { useEffect, useRef } from "react";
import { connectSocket, SOCKET_EVENTS } from "../services/socket";

const useSocket = ({ rooms = [], listeners = {}, ticketId = null, counterRoom = null } = {}) => {
  // Always holds the latest listeners — prevents stale closures
  const listenersRef = useRef(listeners);
  listenersRef.current = listeners;

  // Capture event names once at mount — must stay stable (use useMemo in callers)
  const eventNamesRef = useRef(Object.keys(listeners));

  const roomKey = rooms.join(",");

  useEffect(() => {
    const socket = connectSocket();

    const joinRooms = () => {
      rooms.forEach((room) => socket.emit(room));
      if (ticketId)    socket.emit(SOCKET_EVENTS.JOIN_TICKET_ROOM,  ticketId);
      if (counterRoom) socket.emit(SOCKET_EVENTS.JOIN_COUNTER_ROOM, counterRoom);
    };

    // IMPORTANT: Register handlers FIRST, then join rooms
    // This ensures we never miss an event that fires immediately on room join
    const handlers = {};
    eventNamesRef.current.forEach((event) => {
      handlers[event] = (data) => listenersRef.current[event]?.(data);
      socket.on(event, handlers[event]);
    });

    // Join now if already connected
    if (socket.connected) joinRooms();

    // Re-join on every (re)connect — handles network drops, tab switches, etc.
    socket.on("connect", joinRooms);

    return () => {
      socket.off("connect", joinRooms);
      eventNamesRef.current.forEach((event) => socket.off(event, handlers[event]));
      if (ticketId)    socket.emit(SOCKET_EVENTS.LEAVE_TICKET_ROOM,  ticketId);
      if (counterRoom) socket.emit(SOCKET_EVENTS.LEAVE_COUNTER_ROOM, counterRoom);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomKey, ticketId, counterRoom]);
};

export default useSocket;
