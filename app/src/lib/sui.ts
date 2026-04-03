import { SuiGrpcClient } from "@mysten/sui/grpc";

const client = new SuiGrpcClient({
  network: "mainnet",
  baseUrl: "https://fullnode.mainnet.sui.io:443",
});

export interface MoveModule {
  name: string;
  bytes: Uint8Array;
}

function parsePackageBcs(data: Uint8Array): Map<string, Uint8Array> {
  // BCS layout: discriminator(1) + id(32) + version(8) + Map<String, Vec<u8>>
  let pos = 1 + 32 + 8;

  function readULEB(): number {
    let result = 0,
      shift = 0;
    while (true) {
      const b = data[pos++];
      result |= (b & 0x7f) << shift;
      if (!(b & 0x80)) return result;
      shift += 7;
    }
  }

  const mapLen = readULEB();
  const modules = new Map<string, Uint8Array>();

  for (let i = 0; i < mapLen; i++) {
    const nameLen = readULEB();
    const name = new TextDecoder().decode(data.slice(pos, pos + nameLen));
    pos += nameLen;
    const bytesLen = readULEB();
    const bytes = data.slice(pos, pos + bytesLen);
    pos += bytesLen;
    modules.set(name, bytes);
  }

  return modules;
}

export async function validatePackage(
  packageId: string,
  signal?: AbortSignal
): Promise<boolean> {
  try {
    void signal; // gRPC client doesn't support abort signal yet
    const { object } = await client.core.getObject({
      objectId: packageId,
    });
    return object.type === "package";
  } catch {
    return false;
  }
}

export async function fetchPackageModules(
  packageId: string
): Promise<MoveModule[]> {
  const { object } = await client.core.getObject({
    objectId: packageId,
    include: { objectBcs: true },
  });

  if (object.type !== "package") {
    throw new Error("Not a package");
  }

  if (!object.objectBcs) {
    throw new Error("No BCS data returned");
  }

  const moduleMap = parsePackageBcs(object.objectBcs);
  if (moduleMap.size === 0) {
    throw new Error("No modules found");
  }

  return [...moduleMap.entries()].map(([name, bytes]) => ({ name, bytes }));
}
