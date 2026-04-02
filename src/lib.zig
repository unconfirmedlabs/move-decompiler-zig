pub const types = @import("types.zig");
pub const binary = @import("binary.zig");
pub const cfg = @import("cfg.zig");
pub const ast = @import("ast.zig");
pub const structure = @import("structure.zig");
pub const printer = @import("printer.zig");

pub const CompiledModule = types.CompiledModule;
pub const deserialize = binary.deserialize;

/// Decompile a .mv file to Move source code.
pub fn decompile(allocator: std.mem.Allocator, bytecode: []const u8) ![]u8 {
    const module = try binary.deserialize(allocator, bytecode);

    // Build CFGs and structure for each function with code
    var cfgs = std.ArrayList(cfg.Cfg){};
    var doms = std.ArrayList(cfg.DominatorTree){};
    var loop_infos = std.ArrayList(cfg.LoopInfo){};
    var structured = std.ArrayList(*const ast.Node){};

    for (module.function_defs) |fd| {
        const fh = module.function_handles[fd.function];
        if (fh.module != module.self_module_handle_idx) continue;

        if (fd.code) |code_unit| {
            const fn_cfg = try cfg.buildCfg(allocator, code_unit.code);
            const dom = try cfg.computeDominators(allocator, &fn_cfg);
            const loops = try cfg.detectLoops(allocator, &fn_cfg, &dom);
            const node = try structure.structure(allocator, &fn_cfg, &dom, &loops);

            try cfgs.append(allocator, fn_cfg);
            try doms.append(allocator, dom);
            try loop_infos.append(allocator, loops);
            try structured.append(allocator, node);
        }
    }

    return printer.printModuleStructured(
        allocator,
        &module,
        cfgs.items,
        doms.items,
        loop_infos.items,
        structured.items,
    );
}

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
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), loadTestFile("test_data/coin.mv"));

    try testing.expectEqualSlices(u8, "coin", module.selfModuleName());
    try testing.expect(module.function_defs.len > 30);
    try testing.expect(module.struct_defs.len >= 5);
}

test "parse balance.mv fully" {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), loadTestFile("test_data/balance.mv"));
    try testing.expectEqualSlices(u8, "balance", module.selfModuleName());
}

test "parse transfer.mv fully" {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const module = try deserialize(arena.allocator(), loadTestFile("test_data/transfer.mv"));
    try testing.expectEqualSlices(u8, "transfer", module.selfModuleName());
}

test "decompile coin.mv to source" {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const output = try decompile(arena.allocator(), loadTestFile("test_data/coin.mv"));
    try testing.expect(std.mem.indexOf(u8, output, "module 0x") != null);
    try testing.expect(std.mem.indexOf(u8, output, "struct Coin") != null);
    try testing.expect(std.mem.indexOf(u8, output, "fun total_supply") != null);
    // Structured output should contain control flow keywords
    try testing.expect(std.mem.indexOf(u8, output, "while") != null or
        std.mem.indexOf(u8, output, "loop") != null or
        std.mem.indexOf(u8, output, "if") != null);
}

test "decompile balance.mv to source" {
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();

    const output = try decompile(arena.allocator(), loadTestFile("test_data/balance.mv"));
    try testing.expect(std.mem.indexOf(u8, output, "struct Balance") != null);
    try testing.expect(std.mem.indexOf(u8, output, "struct Supply") != null);
}
