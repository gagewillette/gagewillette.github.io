export type PostCategory = "life" | "project";

export type PostBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "list"; items: string[] }
  | { type: "code"; code: string; language?: string }
  | { type: "quote"; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: PostCategory;
  date: string;
  tags: string[];
  blocks: PostBlock[];
}

export const blogTitle = "Gage Willette's Blog";

export const blogDescription =
  "My place for for project updates, build logs, and everyday life notes.";

export const posts: BlogPost[] = [
  {
    slug: "shipping-small-projects-every-week",
    title: "Shipping Small Projects Every Week",
    excerpt:
      "I started a weekly build cadence to keep momentum high and ideas moving into public demos.",
    category: "project",
    date: "2026-02-20",
    tags: ["process", "shipping", "indie-dev"],
    blocks: [
      {
        type: "paragraph",
        text:
          "I used to hold projects for too long, waiting for a perfect version. This month I switched to a weekly release loop and it has been way better for learning.",
      },
      {
        type: "heading",
        text: "What Changed",
      },
      {
        type: "list",
        items: [
          "Project scope is now capped at seven days.",
          "I publish a quick changelog at the end of each week.",
          "I collect feedback before deciding the next iteration.",
        ],
      },
      {
        type: "paragraph",
        text:
          "The quality has not gone down. Instead, the apps are getting clearer because each release solves one focused problem.",
      },
      {
        type: "code",
        language: "bash",
        code: "# Friday release checklist\nnpm run lint\nnpm run build\ngit tag weekly-release",
      },
    ],
  },
  {
    slug: "life-update-more-structure-better-energy",
    title: "Life Update: More Structure, Better Energy",
    excerpt:
      "I tightened up my daily routine and it directly improved how much focused coding I can do.",
    category: "life",
    date: "2026-02-12",
    tags: ["life", "routine", "focus"],
    blocks: [
      {
        type: "paragraph",
        text:
          "I started blocking my day into deep work, admin, and recharge windows. The main goal was to reduce context switching and it worked almost immediately.",
      },
      {
        type: "quote",
        text: "The best productivity system is the one that lowers friction every single day.",
      },
      {
        type: "paragraph",
        text:
          "I now treat personal maintenance like project maintenance. Sleep, workouts, and planning are not optional if I want reliable output.",
      },
      {
        type: "heading",
        text: "Current Routine",
      },
      {
        type: "list",
        items: [
          "Morning: planning + deep work block.",
          "Afternoon: meetings and collaborative work.",
          "Evening: light coding or reading with no pressure.",
        ],
      },
    ],
  },
  {
    slug: "portfolio-rebuild-postmortem",
    title: "Portfolio Rebuild Postmortem",
    excerpt:
      "A quick postmortem on the portfolio rewrite and the stack decisions I would keep next time.",
    category: "project",
    date: "2026-01-30",
    tags: ["portfolio", "react", "frontend"],
    blocks: [
      {
        type: "paragraph",
        text:
          "The goal was to simplify my personal site and make updates easy. The previous version looked fine but was too costly to maintain.",
      },
      {
        type: "heading",
        text: "Wins",
      },
      {
        type: "list",
        items: [
          "Cut unnecessary dependencies.",
          "Unified page styles under one design system.",
          "Made content edits possible in one file.",
        ],
      },
      {
        type: "heading",
        text: "Next Iteration",
      },
      {
        type: "paragraph",
        text:
          "I want lightweight search and tag pages next. That will make old posts easier to find once the archive grows.",
      },
    ],
  },
];
