import { validateDescriptor, validateResult } from "./vm.js";
export async function evaluate(descriptor, { timeout = 12000 } = {}) {
  validateDescriptor(descriptor);
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) throw Error("TYPESAFE_API_KEY is missing on the server");
  const start = performance.now();
  let response;
  try {
    response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "jev-latest", ...descriptor }),
      signal: AbortSignal.timeout(timeout),
    });
  } catch (e) {
    throw Error(
      e.name === "TimeoutError"
        ? "Jev request timed out. Reset or retry."
        : "Cannot reach Jev. Retry when connected.",
    );
  }
  if (!response.ok)
    throw Error(`Jev returned HTTP ${response.status}. Retry later.`);
  const result = validateResult(descriptor, await response.json());
  return {
    ...result,
    latencyMs: Math.round(performance.now() - start),
    questionCount: Object.keys(descriptor.questions).length,
    recordedAt: new Date().toISOString(),
  };
}
