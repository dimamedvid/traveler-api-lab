
const BASE_URL = "http://localhost:3000";

async function request(path, method, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  const data = response.status === 204
    ? null
    : await response.json();

  return { status: response.status, data };
}

async function main() {
  let planId;

  try {
    const plan = await request(
      "/api/travel-plans",
      "POST",
      { title: "Concurrent Update Test" }
    );

    if (plan.status !== 201) {
      throw new Error("Failed to create travel plan");
    }

    planId = plan.data.id;

    for (let i = 1; i <= 10; i++) {
      const location = await request(
        `/api/travel-plans/${planId}/locations`,
        "POST",
        { name: `Concurrent Location ${i}` }
      );

      if (location.status !== 201) {
        throw new Error("Failed to create location");
      }

      const id = location.data.id;
      const version = location.data.version;

      // Надсилаємо два запити з однаковою версією
      // майже одночасно.
      const results = await Promise.all([
        request(`/api/locations/${id}`, "PUT", {
          name: "Update A",
          version
        }),

        request(`/api/locations/${id}`, "PUT", {
          name: "Update B",
          version
        })
      ]);

      const statuses = results
        .map(result => result.status)
        .sort();

      const passed =
        statuses[0] === 200 &&
        statuses[1] === 409 &&
        results.find(r => r.status === 200).data.version === 2 &&
        results.find(r => r.status === 409).data.current_version === 2;

      console.log(
        `Test ${i}: ${statuses.join(" + ")} — ` +
        (passed ? "PASS" : "FAIL")
      );

      if (!passed) {
        throw new Error(`Concurrent test ${i} failed`);
      }
    }

    console.log("\nAll 10 tests passed!");

  } finally {
    if (planId) {
      await request(
        `/api/travel-plans/${planId}`,
        "DELETE"
      );
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
