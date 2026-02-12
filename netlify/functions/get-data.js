import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore("cohort-data");
  const data = await store.get("cohort-1", { type: "json" });

  if (!data) {
    return new Response(JSON.stringify({ error: "No data found" }), {
      status: 404,
      headers: { "Content-Type": "application/json; charset=utf-8" }
    });
  }

  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
};

export const config = {
  path: "/api/data"
};
