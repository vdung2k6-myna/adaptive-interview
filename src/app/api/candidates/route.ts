import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { candidates } from "@/lib/schema";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, skills, experienceYears, cv } = body;

    if (!name || !email || !Array.isArray(skills) || skills.length === 0) {
      return NextResponse.json(
        { error: "name, email, and at least one skill are required" },
        { status: 400 }
      );
    }

    const candidate = await db
      .insert(candidates)
      .values({
        name: String(name).trim(),
        email: String(email).trim(),
        skills: skills.map((s: unknown) => String(s).trim()).filter(Boolean),
        experienceYears: experienceYears ? Number(experienceYears) : null,
        cv: cv ? String(cv).trim() : null,
      })
      .returning();

    return NextResponse.json(candidate[0], { status: 201 });
  } catch (err) {
    console.error("POST /api/candidates error:", err);
    return NextResponse.json(
      { error: "Failed to create candidate" },
      { status: 500 }
    );
  }
}
