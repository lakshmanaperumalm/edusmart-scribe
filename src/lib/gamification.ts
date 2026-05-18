// XP → level curve: level n requires n*100 cumulative XP (1→100, 2→200 total, etc.)
export function levelFromXp(xp: number) {
  const level = Math.floor((-1 + Math.sqrt(1 + (8 * xp) / 100)) / 2) + 1;
  const currentBase = ((level - 1) * level * 100) / 2;
  const nextBase = (level * (level + 1) * 100) / 2;
  const into = xp - currentBase;
  const span = nextBase - currentBase;
  return {
    level,
    into,
    span,
    progress: Math.min(100, Math.round((into / span) * 100)),
    toNext: span - into,
  };
}

export type Badge = {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  unlocked: (s: { xp: number; streak: number; quizzes: number; accuracy: number }) => boolean;
};

export const BADGES: Badge[] = [
  { id: "first-step", name: "First Step", desc: "Earn your first 10 XP", emoji: "🌱", unlocked: (s) => s.xp >= 10 },
  { id: "spark", name: "Spark", desc: "Reach 100 XP", emoji: "⚡", unlocked: (s) => s.xp >= 100 },
  { id: "scholar", name: "Scholar", desc: "Reach 500 XP", emoji: "📚", unlocked: (s) => s.xp >= 500 },
  { id: "streak-3", name: "On Fire", desc: "3-day streak", emoji: "🔥", unlocked: (s) => s.streak >= 3 },
  { id: "streak-7", name: "Unstoppable", desc: "7-day streak", emoji: "🚀", unlocked: (s) => s.streak >= 7 },
  { id: "streak-30", name: "Legend", desc: "30-day streak", emoji: "👑", unlocked: (s) => s.streak >= 30 },
  { id: "quiz-5", name: "Quiz Whiz", desc: "Complete 5 quizzes", emoji: "🎯", unlocked: (s) => s.quizzes >= 5 },
  { id: "sharpshooter", name: "Sharpshooter", desc: "80%+ accuracy", emoji: "🏹", unlocked: (s) => s.accuracy >= 80 && s.quizzes >= 3 },
];

export function dailyMission(seed: number) {
  const missions = [
    { title: "Take 1 adaptive quiz", reward: 20, to: "/quiz" },
    { title: "Generate notes on a new topic", reward: 15, to: "/notes" },
    { title: "Chat with your tutor for 5 min", reward: 10, to: "/chat" },
    { title: "Review 1 lesson from your plan", reward: 15, to: "/plan" },
  ];
  return missions[seed % missions.length];
}
