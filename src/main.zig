const std = @import("std");
const decompiler = @import("move-decompiler");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var args = std.process.args();
    _ = args.skip(); // program name
    const file_path = args.next() orelse {
        std.debug.print("Usage: move-decompile <file.mv>\n", .{});
        return;
    };

    const data = std.fs.cwd().readFileAlloc(allocator, file_path, 10 * 1024 * 1024) catch |err| {
        std.debug.print("Error reading file: {}\n", .{err});
        return;
    };
    defer allocator.free(data);

    const module = decompiler.deserialize(allocator, data) catch |err| {
        std.debug.print("Error parsing module: {}\n", .{err});
        return;
    };

    const name = module.selfModuleName();
    const addr = module.selfModuleAddress();
    std.debug.print("module 0x", .{});
    for (addr[0..4]) |b| std.debug.print("{x:0>2}", .{b});
    std.debug.print("...::{s}\n", .{name});
    std.debug.print("  version: {}\n", .{module.version});
    std.debug.print("  structs: {}\n", .{module.struct_defs.len});
    std.debug.print("  functions: {}\n", .{module.function_defs.len});
    std.debug.print("  enums: {}\n", .{module.enum_defs.len});
    std.debug.print("  identifiers: {}\n", .{module.identifiers.len});
    std.debug.print("  signatures: {}\n", .{module.signatures.len});
    std.debug.print("  constants: {}\n", .{module.constant_pool.len});

    std.debug.print("\nStructs:\n", .{});
    for (module.struct_defs) |sd| {
        const dh = module.datatype_handles[sd.struct_handle];
        const sname = module.identifiers[dh.name];
        const abilities = dh.abilities.format();
        std.debug.print("  {s} has {s}\n", .{ sname, abilities });
    }

    std.debug.print("\nFunctions:\n", .{});
    for (module.function_defs) |fd| {
        const fh = module.function_handles[fd.function];
        const fname = module.identifiers[fh.name];
        const vis: []const u8 = switch (fd.visibility) {
            .public => "public",
            .friend => "public(friend)",
            .private => "private",
            .deprecated_script => "script",
        };
        const entry_str: []const u8 = if (fd.is_entry) " entry" else "";
        const code_str = if (fd.code) |c| c.code.len else 0;
        std.debug.print("  {s}{s} {s} ({} instructions)\n", .{ vis, entry_str, fname, code_str });
    }
}
