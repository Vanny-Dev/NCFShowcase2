import { useState, useEffect, useCallback, useMemo } from "react";
import { queueAPI } from "../services/api";
import { SOCKET_EVENTS } from "../services/socket";
import useSocket from "./useSocket";

const useQueue = () => {
  const [queue, setQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await queueAPI.getAll();
      setQueue(res.data.queue);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  const rooms = useMemo(() => [SOCKET_EVENTS.JOIN_QUEUE_ROOM], []);

  const listeners = useMemo(() => ({
    [SOCKET_EVENTS.QUEUE_UPDATED]: (payload) => {
      // payload always has { queue } — the full active queue for payor position tracking
      if (payload?.queue) setQueue(payload.queue);
    },
  }), []);

  useSocket({ rooms, listeners });

  const waiting = queue.filter((q) => q.status === "waiting");
  const called  = queue.filter((q) => q.status === "called" || q.status === "serving");

  return { queue, waiting, called, loading, error, refetch: fetchQueue };
};

export default useQueue;
