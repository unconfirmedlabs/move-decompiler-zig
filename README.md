# move-decompiler-zig

A Move bytecode decompiler written in Zig. Converts compiled `.mv` modules back into readable Move source code.

**3,193 lines of Zig. Zero dependencies. 87KB WASM. Tested against 1,000+ Sui mainnet packages.**

## Features

- **Full bytecode parser** — Move v5–v7, 60+ opcodes, ULEB128 encoding, enums (v7+)
- **Control flow recovery** — CFG construction, dominator trees, loop detection, if/else and while reconstruction
- **Expression reconstruction** — stack machine simulation converts flat bytecode into nested Move expressions
- **Pretty printer** — renders complete Move modules with structs, enums, functions, generics, abilities, and visibility modifiers
- **Dual targets** — native CLI binary (156KB) and WASM library (87KB) for browsers

## Quick start

```bash
# Build CLI
zig build

# Decompile a module
./zig-out/bin/move-decompile module.mv

# Build WASM
zig build wasm

# Run tests
zig build test
```

## Output example

Given `coin.mv` from Sui framework:

```move
module 0x02::coin {
    struct Coin<phantom CoinType> has key, store {
        id: object::UID,
        balance: balance::Balance<CoinType>,
    }

    struct TreasuryCap<phantom CoinType> has key, store {
        id: object::UID,
        total_supply: balance::Supply<CoinType>,
    }

    public fun total_supply<CoinType>(arg0: &TreasuryCap<CoinType>): u64 {
        balance::supply_value(&arg0.total_supply)
    }

    public fun divide_into_n<CoinType>(arg0: &mut Coin<CoinType>, arg1: u64, arg2: &mut tx_context::TxContext): vector<Coin<CoinType>> {
        let v4 = balance_mut(&mut arg0);
        let v5 = vector[];
        let v7 = 0;
        while ((v7 < (arg1 - 1))) {
            let v8 = balance::value(v4);
            vector::push_back(&mut v5, from_balance(balance::split(v4, (v8 / (arg1 - v7))), arg2));
            v7 = (v7 + 1);
        }
        v5
    }
}
```

## WASM usage

The 87KB WASM module runs in any browser or JS runtime:

```javascript
const wasm = await WebAssembly.instantiateStreaming(fetch("move_decompiler.wasm"));
const { decompile, get_input_ptr, get_output_ptr, get_max_input_size } = wasm.instance.exports;

// Write bytecode into WASM memory
const inputPtr = get_input_ptr();
const memory = new Uint8Array(wasm.instance.exports.memory.buffer);
memory.set(bytecode, inputPtr);

// Decompile
const outputLen = decompile(inputPtr, bytecode.length);
const outputPtr = get_output_ptr();
const source = new TextDecoder().decode(memory.slice(outputPtr, outputPtr + outputLen));
```

**Memory layout:** 4MB work buffer + 1MB output buffer + 1MB input buffer, all pre-allocated in WASM linear memory. No dynamic allocation visible to JavaScript.

## Architecture

```
.mv bytecode
  → binary.zig    Parse bytecode (headers, tables, instructions)
  → cfg.zig       Build control flow graph, compute dominators, detect loops
  → structure.zig Recover if/else, while, loop from flat CFG
  → expr.zig      Simulate stack machine → nested expressions
  → printer.zig   Render Move source with types, generics, abilities
```

| File | Lines | Role |
|------|------:|------|
| `binary.zig` | 692 | Bytecode deserializer — magic validation, 16 table types, 60+ opcodes |
| `expr.zig` | 517 | Expression reconstruction — stack simulation, calls, field access, vectors |
| `printer.zig` | 507 | Source renderer — modules, structs, enums, functions, type annotations |
| `cfg.zig` | 440 | CFG builder — basic blocks, dominator tree (Cooper-Harvey-Kennedy), back-edge loop detection |
| `structure.zig` | 427 | Control flow structuring — simplified "No More Gotos" algorithm |
| `types.zig` | 382 | Type definitions — `CompiledModule`, handles, signatures, bytecode variants |
| `lib.zig` | 117 | Orchestration + tests |
| `wasm.zig` | 45 | WASM entry points with fixed-buffer allocator |
| `ast.zig` | 35 | Structured AST node types |
| `main.zig` | 31 | CLI entry point |

## Comparison with Sui's Rust decompiler

The official Move decompiler lives at [`move/crates/move-decompiler`](https://github.com/MystenLabs/sui/tree/main/external-crates/move/crates/move-decompiler) in the Sui repo. Both implement the same core algorithm (CFG → dominators → structured AST → source), but with very different trade-offs:

| | **This (Zig)** | **Sui (Rust)** |
|---|---|---|
| **Lines of code** | 3,193 | ~4,700 |
| **Dependencies** | 0 | 21 (13 Move framework crates + 8 external) |
| **Bytecode parsing** | From scratch — reads raw binary directly | Delegates to `move-binary-format` crate |
| **IR strategy** | Stack-based (simulates Move VM stack directly) | Register-based (converts via `move-stackless-bytecode-2` to SSA form) |
| **Graph library** | Hand-rolled CFG + dominator tree | `petgraph` crate |
| **Refinement** | Single-pass structuring | 4-pass fixed-point refinement loop (flatten, while introduction, loop-to-seq, continue removal) |
| **WASM target** | Yes — 87KB, runs in browsers | No |
| **CLI binary** | 156KB | Depends on entire Move toolchain |
| **Enum support** | Parses v7 enums, structuring is partial (placeholder) | Full variant/match reconstruction |
| **Type inference** | Resolves from signature tables | Uses `move-model-2` semantic model |
| **Debug output** | None (lean) | 7 configurable debug flags |

### Key architectural differences

**Self-contained vs. ecosystem-embedded.** The Zig version parses Move bytecode from scratch — it reads the binary format, ULEB128 integers, signature tokens, and all 16 table types directly. The Rust version delegates parsing to `move-binary-format` and expression lifting to `move-stackless-bytecode-2`, which converts stack-based bytecode into register-based SSA form before the decompiler sees it.

**Stack simulation vs. SSA lifting.** The Zig decompiler simulates the Move VM's operand stack to reconstruct expressions — it pushes/pops values as it walks instructions, producing nested expression trees. The Rust decompiler works on an already-lifted SSA representation where temporaries have been assigned to registers, then reconstructs terms from that higher-level IR.

**Single-pass vs. multi-pass refinement.** The Zig version structures control flow in one pass during CFG traversal. The Rust version applies four separate refinement passes (`flatten_seq`, `introduce_while`, `loop_to_seq`, `remove_trailing_continue`) in a fixed-point loop until the AST stabilizes.

**Zero dependencies vs. 21.** The Zig version uses only the Zig standard library. The Rust version pulls in 13 Move framework crates (binary format, model, abstract interpreter, disassembler, VM runtime, etc.) plus 8 external crates (petgraph, anyhow, clap, bcs, etc.).

### Why both exist

The Rust decompiler is the right choice when you're already in the Move toolchain — it has full semantic awareness, handles edge cases through multiple refinement passes, and integrates with the Move model for type resolution.

The Zig decompiler exists for a different reason: **portability**. At 87KB of WASM with zero dependencies, it can run in a browser, an edge function, or any environment where pulling in the Move framework isn't practical. It's also a clean-room implementation useful for understanding the Move bytecode format without the abstraction layers of the Rust ecosystem.

## Supported bytecode

- **Magic:** `0xA11CEB0B` (standard) and `0xDEADC0DE` (unpublishable)
- **Versions:** 5, 6, 7 (Sui flavor)
- **Tables:** Module handles, datatype handles, function handles, struct/enum definitions, signatures, constants, identifiers, addresses, field handles, friend declarations, metadata
- **Instructions:** All arithmetic, logic, comparison, branching, local variable, function call, struct pack/unpack, field access, vector operations, type casting, reference operations, and enum operations (v7+)
- **Abilities:** copy, drop, store, key
- **Visibility:** private, public, friend, entry

## Testing

Tested against 1,000 packages from Sui mainnet (1,224 modules) with zero failures. Run the test suite yourself:

```bash
# Run unit tests
zig build test

# Test against mainnet packages (requires network)
bun scripts/fetch-packages.ts --limit 1000
```

## Known limitations

- **Enum pattern matching** — v7 enum definitions and variant operations are parsed, but `variant_switch` is not yet structured into proper `match` expressions (renders as a basic block)
- **Variable names** — uses positional names (`arg0`, `v1`) since original names are stripped from bytecode
- **Complex control flow** — deeply nested or irreducible control flow may fall back to raw bytecode comments
- **No package-level decompilation** — operates on individual `.mv` module files

## License

MIT
