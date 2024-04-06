const { Hono } = require("hono");
const { html } = require("hono/html");
const layout = require("../layout");
const ensureAuthenticated = require("../middlewares/ensure-authenticated");
const { v4: uuidv4 } = require("uuid");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient({ log: ["query"] });

const app = new Hono();

app.use("/new", ensureAuthenticated());
app.get("/new", (c) => {
  return c.html(
    layout(
      "予定の作成",
      html`
        <form method="post" action="/schedules">
          <div>
            <h5>予定名</h5>
            <input type="text" name="scheduleName" />
          </div>
          <div>
            <h5>メモ</h5>
            <textarea name="memo"></textarea>
          </div>
          <div>
            <h5>候補日程 (改行して複数入力してください)</h5>
            <textarea name="candidates"></textarea>
          </div>
          <button type="submit">予定をつくる</button>
        </form>
      `,
    ),
  );
});

app.use("/", ensureAuthenticated());
app.post("/", async (c) => {
  const { user } = c.get("session");
  const body = await c.req.parseBody();

  // 予定を登録
  const schedule = await prisma.schedule.create({
    data: {
      scheduleId: uuidv4(),
      scheduleName: body.scheduleName.slice(0, 255) || "（名称未設定）",
      memo: body.memo,
      createdBy: user.id,
      updatedAt: new Date(),
    },
  });

  // 候補日程を登録
  const candidateNames = body.candidates
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s !== "");
  const candidates = candidateNames.map((candidateName) => ({
    candidateName,
    scheduleId: schedule.scheduleId,
  }));
  await prisma.candidate.createMany({
    data: candidates,
  });

  // 作成した予定のページにリダイレクト
  return c.redirect("/schedules/" + schedule.scheduleId);
});

app.use("/:scheduleId", ensureAuthenticated());
app.get("/:scheduleId", async (c) => {
  const { user } = c.get("session");
  const schedule = await prisma.schedule.findUnique({
    where: { scheduleId: c.req.param("scheduleId") },
    include: {
      user: {
        select: {
          userId: true,
          username: true,
        },
      },
    },
  });

  if (!schedule) {
    return c.notFound();
  }

  const candidates = await prisma.candidate.findMany({
    where: { scheduleId: schedule.scheduleId },
    orderBy: { candidateId: "asc" },
  });

  const users = [
    {
      userId: user.id,
      username: user.login,
    },
  ];

  return c.html(
    layout(
      `予定: ${schedule.scheduleName}`,
      html`
        <h4>${schedule.scheduleName}</h4>
        <p style="white-space: pre;">${schedule.memo}</p>
        <p>作成者: ${schedule.user.username}</p>
        <h3>出欠表</h3>
        <table>
          <tr>
            <th>予定</th>
            ${users.map((user) => html`<th>${user.username}</th>`)}
          </tr>
          ${candidates.map(
            (candidate) => html`
              <tr>
                <th>${candidate.candidateName}</th>
                ${users.map(
                  (user) => html`
                    <td>
                      <button>欠席</button>
                    </td>
                  `,
                )}
              </tr>
            `,
          )}
        </table>
      `,
    ),
  );
});

module.exports = app;
