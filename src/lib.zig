pub const types = @import("types.zig");
pub const binary = @import("binary.zig");

pub const CompiledModule = types.CompiledModule;
pub const deserialize = binary.deserialize;

// ── Tests ─────────────────────────────────────────────────────────────

const std = @import("std");
const testing = std.testing;

fn loadTestFile(comptime path: []const u8) []const u8 {
    return @embedFile(path);
}

test "parse coin.mv header" {
    const data = loadTestFile("test_data/coin.mv");
    try testing.expectEqualSlices(u8, &.{ 0xA1, 0x1C, 0xEB, 0x0B }, data[0..4]);
}

test "parse coin.mv fully" {
    const data = loadTestFile("test_data/coin.mv");
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), data);

    // Module name should be "coin"
    const name = module.selfModuleName();
    try testing.expectEqualSlices(u8, "coin", name);

    // Should have many functions
    try testing.expect(module.function_defs.len > 30);

    // Should have structs (Coin, CoinMetadata, TreasuryCap, etc.)
    try testing.expect(module.struct_defs.len >= 5);

    // Should have identifiers
    try testing.expect(module.identifiers.len > 50);

    // Check a known function exists
    var found_total_supply = false;
    for (module.function_defs) |fd| {
        const fh = module.function_handles[fd.function];
        const fn_name = module.identifiers[fh.name];
        if (std.mem.eql(u8, fn_name, "total_supply")) {
            found_total_supply = true;
            try testing.expectEqual(types.Visibility.public, fd.visibility);
            try testing.expect(fd.code != null);
        }
    }
    try testing.expect(found_total_supply);
}

test "parse balance.mv fully" {
    const data = loadTestFile("test_data/balance.mv");
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), data);
    try testing.expectEqualSlices(u8, "balance", module.selfModuleName());
    try testing.expect(module.function_defs.len > 5);
}

test "parse transfer.mv fully" {
    const data = loadTestFile("test_data/transfer.mv");
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), data);
    try testing.expectEqualSlices(u8, "transfer", module.selfModuleName());
}

test "coin.mv function bytecode is parseable" {
    const data = loadTestFile("test_data/coin.mv");
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), data);

    for (module.function_defs) |fd| {
        if (fd.code) |code| {
            // Every function should have at least one instruction
            try testing.expect(code.code.len > 0);
            // Last instruction of simple functions is usually Ret
            const last = code.code[code.code.len - 1];
            // Just verify it parsed (didn't error)
            _ = last.isBranch();
        }
    }
}

test "coin.mv signatures resolve correctly" {
    const data = loadTestFile("test_data/coin.mv");
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), data);

    // Every signature should have valid tokens
    for (module.signatures) |sig| {
        for (sig.tokens) |token| {
            // Just verify each token is a valid variant
            switch (token.*) {
                .bool, .u8, .u16, .u32, .u64, .u128, .u256, .address, .signer => {},
                .vector => |inner| _ = inner,
                .reference => |inner| _ = inner,
                .mutable_reference => |inner| _ = inner,
                .datatype => |idx| try testing.expect(idx < module.datatype_handles.len),
                .datatype_instantiation => |di| {
                    try testing.expect(di.handle < module.datatype_handles.len);
                },
                .type_parameter => {},
            }
        }
    }
}
