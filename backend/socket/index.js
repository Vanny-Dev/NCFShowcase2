const { Server } = require("socket.io");

const EVENTS = {
  // Server → Client
  QUEUE_UPDATED: "queue:updated",
  TICKET_CALLED: "ticket:called",
  TICKET_SERVED: "ticket:served",
  TICKET_SKIPPED: "ticket:skipped",
  ANALYTICS_UPDATED: "analytics:updated",
  // Client → Server
  JOIN_QUEUE_ROOM: "join:queue-room",
  JOIN_TICKET_ROOM: "join:ticket-room",
  LEAVE_TICKET_ROOM: "leave:ticket-room",
};

let io;

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`🔌 Client connected: ${socket.id}`);

    // Payor joins room for their specific ticket
    socket.on(EVENTS.JOIN_TICKET_ROOM, (ticketId) => {
      socket.join(`ticket:${ticketId}`);
      console.log(`   → Joined ticket room: ticket:${ticketId}`);
    });

    socket.on(EVENTS.LEAVE_TICKET_ROOM, (ticketId) => {
      socket.leave(`ticket:${ticketId}`);
    });

    // Anyone (cashier/payor) can join the global queue room
    socket.on(EVENTS.JOIN_QUEUE_ROOM, () => {
      socket.join("queue:global");
      console.log(`   → Joined queue room`);
    });

    socket.on("disconnect", () => {
      console.log(`🔌 Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

// Helper emitters used by controllers
const emitQueueUpdated = (queueData) => {
  if (io) io.to("queue:global").emit(EVENTS.QUEUE_UPDATED, queueData);
};

const emitTicketCalled = (ticketId, data) => {
  if (io) {
    io.to(`ticket:${ticketId}`).emit(EVENTS.TICKET_CALLED, data);
    io.to("queue:global").emit(EVENTS.QUEUE_UPDATED, data);
  }
};

const emitTicketServed = (ticketId, data) => {
  if (io) {
    io.to(`ticket:${ticketId}`).emit(EVENTS.TICKET_SERVED, data);
    io.to("queue:global").emit(EVENTS.QUEUE_UPDATED, data);
  }
};

const emitTicketSkipped = (ticketId, data) => {
  if (io) {
    io.to(`ticket:${ticketId}`).emit(EVENTS.TICKET_SKIPPED, data);
    io.to("queue:global").emit(EVENTS.QUEUE_UPDATED, data);
  }
};

const emitAnalyticsUpdated = (analyticsData) => {
  if (io) io.to("queue:global").emit(EVENTS.ANALYTICS_UPDATED, analyticsData);
};

module.exports = initSocket;
module.exports.emitQueueUpdated = emitQueueUpdated;
module.exports.emitTicketCalled = emitTicketCalled;
module.exports.emitTicketServed = emitTicketServed;
module.exports.emitTicketSkipped = emitTicketSkipped;
module.exports.emitAnalyticsUpdated = emitAnalyticsUpdated;
module.exports.EVENTS = EVENTS;