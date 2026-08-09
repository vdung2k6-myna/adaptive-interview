import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "./db";
import { positions, candidates } from "./schema";

async function seed() {
  console.log("Seeding database...");

  const position = await db
    .insert(positions)
    .values({
      title: "Senior Full Stack Engineer",
      level: "Senior",
      requirements: ["React", "Node.js", "PostgreSQL", "TypeScript", "System Design"],
    })
    .returning();

  const candidate = await db
    .insert(candidates)
    .values({
      name: "Jane Doe",
      email: "jane@example.com",
      skills: ["React", "Node.js", "Python", "AWS"],
      experienceYears: 5,
      cv: "5 years of full-stack development. Led a team of 3 engineers at TechCorp building a React/Node.js SaaS platform serving 50k+ users. Strong focus on PostgreSQL query optimization and TypeScript type safety. Contributed to open-source AWS infrastructure tools.",

    })
    .returning();

  console.log("Seeded position:", position[0].id);
  console.log("Seeded candidate:", candidate[0].id);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
