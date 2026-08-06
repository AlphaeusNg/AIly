/** Tutorial chapter metadata + copy for AIly */

export const CHAPTERS = [
  {
    id: "meet",
    title: "Meet AIly",
    required: true,
    body: `Hi — I'm **AIly**, your AI Ally.

I help you hit the **targets you set**. I'll walk you through setup on this computer — no terminal, no tech maze.

I'll plan with you, notice where time goes (if you allow), and only block apps **you** put off-limits.`,
  },
  {
    id: "first_target",
    title: "Your first Target",
    required: true,
    body: `A **Target** is something real you're journeying toward — not a vague wish.

Pick one metric you can measure (pages, sessions, shippable pieces). We'll keep it honest.`,
  },
  {
    id: "capacity",
    title: "Your capacity",
    required: true,
    body: `How many hours this week can you really give?

AIly won't let a day plan silently exceed that — so you replan instead of pretending.`,
  },
  {
    id: "attention",
    title: "Attention map",
    required: false,
    body: `With your permission, AIly can watch **which apps** you use so your journey stays honest.

Data stays on this device by default. You can revoke anytime in Setup.`,
    grant: "usage",
  },
  {
    id: "off_limits",
    title: "Off-limits apps",
    required: false,
    body: `Choose apps that pull you off course. AIly only blocks what you list — you're the admin.`,
  },
  {
    id: "ally_admin",
    title: "Ally admin",
    required: false,
    body: `Grant AIly power to **block** those apps during focus windows you set.

You can always **break glass** (unlock with a short delay + reason). AIly logs it so your journey stays honest — no shame, just clarity.`,
    grant: "blockAdmin",
  },
  {
    id: "stay_in_touch",
    title: "Stay in touch",
    required: false,
    body: `Allow notifications so AIly can nudge plan/review times with gentle, generic messages.`,
    grant: "notifications",
  },
  {
    id: "smarter",
    title: "Smarter AIly (optional)",
    required: false,
    body: `Optional: download a local AI model for smarter planning. Skip anytime — the planner works without it.

*(Model bootstrap lands in a later build; skip is always fine.)*`,
  },
];

export function canArmBlocks(state) {
  return !!(state.tutorial.permissions.usage && state.tutorial.permissions.blockAdmin);
}

export function isReady(state) {
  const req = CHAPTERS.filter((c) => c.required);
  return req.every((c) => state.tutorial.chapters[c.id] === "done");
}

export function chapterStatus(state, id) {
  return state.tutorial.chapters[id] || "pending";
}
