// Manual test for semantic coverage query
// Run with: node scripts/test-coverage.js

const { Pool } = require("pg");
const { drizzle } = require("drizzle-orm/node-postgres");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/ai_interview",
});

const db = drizzle(pool);

async function test() {
  try {
    // 1. Clean slate
    await pool.query(`DELETE FROM embeddings WHERE source_type IN ('requirement', 'message')`);

    // 2. Insert mock position requirement embedding
    // Simulate: requirement = "Docker experience", embedding = [1, 0, 0, ...] (simplified for test)
    // In reality we'd use real 1024-dim vectors from Ollama
    const reqVector = Array.from({ length: 1024 }, (_, i) => (i === 0 ? 1.0 : 0.0));
    await pool.query(`
      INSERT INTO embeddings (source_type, source_id, content, embedding)
      VALUES ('requirement', '00000000-0000-0000-0000-000000000001', 'Docker experience', '${JSON.stringify(reqVector)}')
    `);

    // 3. Insert a "message" embedding that is semantically close
    // Similar vector: [0.9, 0.1, 0, ...] — cosine similarity ~0.99
    const msgVector = Array.from({ length: 1024 }, (_, i) => {
      if (i === 0) return 0.9;
      if (i === 1) return 0.1;
      return 0.0;
    });
    await pool.query(`
      INSERT INTO embeddings (source_type, source_id, session_id, content, embedding)
      VALUES ('message', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'I deploy containers with Docker daily', '${JSON.stringify(msgVector)}')
    `);

    // 4. Run coverage query
    const threshold = 0.75;
    const distanceThreshold = 1 - threshold;
    const sessionId = '00000000-0000-0000-0000-000000000003';
    const positionId = '00000000-0000-0000-0000-000000000001';

    const result = await pool.query(`
      SELECT
        r.content AS content,
        MIN(r.embedding::vector(1024) <=> m.embedding::vector(1024)) AS min_distance
      FROM embeddings r
      LEFT JOIN embeddings m
        ON m.source_type = 'message'
        AND m.session_id = '${sessionId}'
      WHERE r.source_type = 'requirement'
        AND r.source_id = '${positionId}'
      GROUP BY r.id, r.content, r.embedding
    `);

    const row = result.rows[0];
    const minDistance = parseFloat(String(row.min_distance));
    const isCovered = minDistance <= distanceThreshold;

    console.log("=== Coverage Test ===");
    console.log("Requirement:", row.content);
    console.log("Min cosine distance:", minDistance.toFixed(4));
    console.log("Threshold (distance):", distanceThreshold);
    console.log("Is covered:", isCovered);

    if (isCovered) {
      console.log("✅ PASS: Requirement correctly detected as covered");
    } else {
      console.log("❌ FAIL: Requirement should be covered but isn't");
      process.exit(1);
    }

    // 5. Test with a dissimilar message
    await pool.query(`DELETE FROM embeddings WHERE source_type = 'message'`);
    const dissimilarVector = Array.from({ length: 1024 }, (_, i) => {
      if (i === 500) return 1.0;
      return 0.0;
    });
    await pool.query(`
      INSERT INTO embeddings (source_type, source_id, session_id, content, embedding)
      VALUES ('message', '00000000-0000-0000-0000-000000000004', '${sessionId}', 'I love hiking in the mountains', '${JSON.stringify(dissimilarVector)}')
    `);

    const result2 = await pool.query(`
      SELECT
        r.content AS content,
        MIN(r.embedding::vector(1024) <=> m.embedding::vector(1024)) AS min_distance
      FROM embeddings r
      LEFT JOIN embeddings m
        ON m.source_type = 'message'
        AND m.session_id = '${sessionId}'
      WHERE r.source_type = 'requirement'
        AND r.source_id = '${positionId}'
      GROUP BY r.id, r.content, r.embedding
    `);

    const row2 = result2.rows[0];
    const minDistance2 = parseFloat(String(row2.min_distance));
    const isCovered2 = minDistance2 <= distanceThreshold;

    console.log("\n=== Dissimilar Test ===");
    console.log("Requirement:", row2.content);
    console.log("Min cosine distance:", minDistance2.toFixed(4));
    console.log("Is covered:", isCovered2);

    if (!isCovered2) {
      console.log("✅ PASS: Dissimilar message correctly detected as NOT covered");
    } else {
      console.log("❌ FAIL: Dissimilar message should NOT be covered");
      process.exit(1);
    }

    // Cleanup
    await pool.query(`DELETE FROM embeddings WHERE source_type IN ('requirement', 'message')`);
    console.log("\n✅ All tests passed!");

  } catch (err) {
    console.error("Test error:", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

test();
