const target = new URL(process.argv[2] ?? "http://127.0.0.1:3000/");

async function check(url, expectedType) {
  const response = await fetch(url, { redirect: "follow" });
  const type = response.headers.get("content-type") ?? "";

  if (!response.ok) throw new Error(`${url} → HTTP ${response.status}`);
  if (expectedType && !type.includes(expectedType)) {
    throw new Error(`${url} → 예상 타입 ${expectedType}, 실제 타입 ${type || "없음"}`);
  }

  console.log(`✓ ${response.status} ${type.split(";")[0]} ${url}`);
  return response.text();
}

const html = await check(target, "text/html");
const cssHref = html.match(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*>/)?.[1];

if (!cssHref) throw new Error("페이지 HTML에서 Next.js CSS 경로를 찾지 못했습니다.");

await check(new URL(cssHref.replaceAll("&amp;", "&"), target), "text/css");
await check(new URL("manifest.webmanifest", target), "json");
await check(new URL("icon.svg", target), "image/svg+xml");
await check(new URL("alien-portrait.png", target), "image/png");

console.log("정적 자산 점검을 통과했습니다.");
