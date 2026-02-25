import { useState, useEffect, useCallback, useMemo } from "react";
import { queueAPI } from "../services/api";
import { SOCKET_EVENTS } from "../services/socket";
import useSocket from "./useSocket";

const useCashierQueue = (counter) => {
  const [counterQueue, setCounterQueue] = useState([]);
  const [waitingQueue, setWaitingQueue] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchQueues = useCallback(async () => {
    if (!counter) return;
    try {
      const res = await queueAPI.getCounterQueue(counter);
      setCounterQueue(res.data.counterQueue || []);
      setWaitingQueue(res.data.waitingQueue || []);
    } catch (err) {
      console.error("useCashierQueue fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [counter]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const rooms = useMemo(() => [SOCKET_EVENTS.JOIN_QUEUE_ROOM], []);

  const listeners = useMemo(() => ({
    // Fired when: someone joins queue, someone leaves, payor-side changes
    // Payload: { queue, waitingQueue }
    [SOCKET_EVENTS.QUEUE_UPDATED]: (payload) => {
      // Always update the waiting pool if the payload includes it
      if (payload?.waitingQueue) setWaitingQueue(payload.waitingQueue);
    },
    // Fired when: THIS counter calls/serves/skips a ticket
    // Payload: { ticket, queue, counterQueue, waitingQueue }
    [SOCKET_EVENTS.COUNTER_UPDATED]: (payload) => {
      if (payload?.counterQueue !== undefined) setCounterQueue(payload.counterQueue);
      if (payload?.waitingQueue !== undefined) setWaitingQueue(payload.waitingQueue);
    },
  }), []);

  useSocket({
    rooms,
    listeners,
    counterRoom: counter,
  });

  return { counterQueue, waitingQueue, loading, refetch: fetchQueues };
};

export default useCashierQueue;
