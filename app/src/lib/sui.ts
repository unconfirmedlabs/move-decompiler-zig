const GQL_URL = "https://graphql.mainnet.sui.io/graphql";

export interface MoveModule {
  name: string;
  bytes: Uint8Array;
}

export async function validatePackage(
  packageId: string,
  signal?: AbortSignal
): Promise<boolean> {
  const query = `{ object(address: "${packageId}") { asMovePackage { modules { nodes { name } } } } }`;
  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
    signal,
  });
  if (!res.ok) return false;
  const json = await res.json();
  const nodes = json.data?.object?.asMovePackage?.modules?.nodes;
  return Array.isArray(nodes) && nodes.length > 0;
}

export async function fetchPackageModules(
  packageId: string
): Promise<MoveModule[]> {
  const query = `{
    object(address: "${packageId}") {
      asMovePackage {
        modules {
          nodes {
            name
            bytes
          }
        }
      }
    }
  }`;

  const res = await fetch(GQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });

  if (!res.ok) throw new Error(`GraphQL error: ${res.status}`);

  const json = await res.json();
  const modules = json.data?.object?.asMovePackage?.modules?.nodes;
  if (!modules || modules.length === 0) {
    throw new Error("No modules found — is this a valid package ID?");
  }

  return modules.map((m: { name: string; bytes: string }) => ({
    name: m.name,
    bytes: Uint8Array.from(atob(m.bytes), (c) => c.charCodeAt(0)),
  }));
}
