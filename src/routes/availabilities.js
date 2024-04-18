const { Hono } = require("hono");
const ensureAuthenticated = require("../middlewares/ensure-authenticated");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });

const app = new Hono();

app.post(
  "/:scheduleId/users/:userId/candidates/:candidateId", 
  ensureAuthenticated(),
  async (c) => {
    const scheduleId = c.req.param("scheduleId");
    const userId = parseInt(c.req.param("userId"), 10);
    const candidateId = parseInt(c.req.param("candidateId"), 10);

    const body = await c.req.json();
    const availability = body.availability ? parseInt(body.availability, 10) : 0;

    const data = {
      userId,
      scheduleId,
      candidateId,
      availability,
    };
    await prisma.availability.upsert({
      where: {
        availabilityCompositeId: {
          candidateId,
          userId,
        },
      },
      create: data,
      update: data,
    });

    return c.json({ status: "OK", availability });
  },
);

module.exports = app;
