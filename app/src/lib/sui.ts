const GQL_URL = "https://graphql.mainnet.sui.io/graphql";

export interface MoveModule {
  name: string;
  bytes: Uint8Array;
}

async function gql(query: string, signal?: AbortSignal) {
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);
  const json = await res.json();
  if (json.errors?.length) throw new Error(json.errors[0].message);
  return json.data;
}

export async function validatePackage(
  packageId: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    const data = await gql(
      `{ object(address: "${packageId}") { asMovePackage { modules(first: 1) { nodes { name } } } } }`,
      signal
    );
    const nodes = data?.object?.asMovePackage?.modules?.nodes;
    return Array.isArray(nodes) && nodes.length > 0;
  } catch {
    return false;
  }
}

export async function fetchPackageModules(
  packageId: string
): Promise<MoveModule[]> {
  const all: MoveModule[] = [];
  let cursor: string | null = null;

  while (true) {
    const afterClause = cursor ? `, after: "${cursor}"` : "";
    const data = await gql(`{
      object(address: "${packageId}") {
        asMovePackage {
          modules(first: 50${afterClause}) {
            pageInfo { hasNextPage endCursor }
            nodes { name bytes }
          }
        }
      }
    }`);

    const modules = data?.object?.asMovePackage?.modules;
    if (!modules?.nodes?.length) {
      if (all.length === 0) {
        throw new Error("No modules found — is this a valid package ID?");
      }
      break;
    }

    for (const m of modules.nodes) {
      all.push({
        name: m.name,
        bytes: Uint8Array.from(atob(m.bytes), (c) => c.charCodeAt(0)),
      });
    }

    if (!modules.pageInfo.hasNextPage) break;
    cursor = modules.pageInfo.endCursor;
  }

  return all;
}
