#!/bin/bash
# ============================================================
# Incremental Check Script
# 根据变更文件智能选择需要检查/测试的文件
# ============================================================

set -e

INCREMENTAL_MODE="${1:-incremental}"

# 获取变更的源文件 (排除测试文件)
get_changed_src_files() {
    git diff --name-only HEAD 2>/dev/null | grep -E '^src/.*\.(ts|tsx)$' | grep -v '__tests__' || true
}

# 获取变更的 Rust 文件
get_changed_rust_files() {
    git diff --name-only HEAD 2>/dev/null | grep -E '^src-tauri/.*\.rs$' | grep -v 'target/' || true
}

# 检查是否需要全量测试 (api.ts 变更)
needs_full_test() {
    local changed_files=$(get_changed_src_files)
    echo "$changed_files" | grep -q '^src/api\.ts$'
}

# 检查是否需要全量检查 (Rust 核心文件变更)
needs_full_check() {
    local changed_files=$(get_changed_rust_files)
    echo "$changed_files" | grep -qE '^src-tauri/src/(lib|main|config)\.rs$' || \
    echo "$changed_files" | grep -qE '^src-tauri/crates/core/' || \
    echo "$changed_files" | grep -qE '^src-tauri/Cargo\.(toml|lock)$'
}

# 映射源文件到测试文件
map_src_to_test() {
    local src_file="$1"
    local test_file

    # src/domain/workflow-engine.ts -> src/__tests__/domain/workflow-engine.test.ts
    test_file=$(echo "$src_file" | sed 's|^src/|src/__tests__/|' | sed 's|\.ts$|.test.ts|' | sed 's|\.tsx$|.test.tsx|')

    if [ -f "$test_file" ]; then
        echo "$test_file"
    fi
}

# 主检查逻辑
run_incremental_check() {
    local changed_files=$(get_changed_src_files)
    local changed_rust=$(get_changed_rust_files)

    if [ -z "$changed_files" ] && [ -z "$changed_rust" ]; then
        echo "[incremental] 无源代码变更，跳过检查"
        return 0
    fi

    echo "[incremental] 变更检测:"
    [ -n "$changed_files" ] && echo "  TS/TSX: $(echo "$changed_files" | wc -l) 个文件"
    [ -n "$changed_rust" ] && echo "  Rust: $(echo "$changed_rust" | wc -l) 个文件"

    # TypeScript 检查 (全量 tsc，增量意义不大)
    echo ""
    echo ">> Running: pnpm exec tsc --noEmit"
    if ! pnpm exec tsc --noEmit; then
        echo "❌ TypeScript check failed"
        return 1
    fi
    echo "✓ TypeScript check passed"

    # Rust clippy 检查
    if [ -n "$changed_rust" ] || needs_full_check; then
        echo ""
        echo ">> Running: cargo clippy (full)"
        if ! cargo clippy --jobs 4 -- -D warnings -A dead_code 2>/dev/null; then
            echo "❌ Clippy failed"
            return 1
        fi
        echo "✓ Clippy passed"
    else
        echo ""
        echo ">> Running: cargo check (incremental)"
        if ! cargo check --jobs 4 2>/dev/null; then
            echo "❌ Cargo check failed"
            return 1
        fi
        echo "✓ Cargo check passed"
    fi

    echo ""
    echo "✅ Incremental check passed"
    return 0
}

# 主测试逻辑
run_incremental_test() {
    local changed_files=$(get_changed_src_files)
    local test_files=""

    if [ -z "$changed_files" ]; then
        echo "[incremental] 无源代码变更，跳过测试"
        return 0
    fi

    # 检查是否需要全量测试
    if needs_full_test; then
        echo "[incremental] 检测到 api.ts 变更，触发全量测试"
        return 1  # 返回1表示需要全量
    fi

    echo "[incremental] 变更检测:"
    echo "  TS/TSX: $(echo "$changed_files" | wc -l) 个文件"

    # 映射到测试文件
    echo ""
    echo "[incremental] 映射测试文件:"
    for file in $changed_files; do
        local test_file=$(map_src_to_test "$file")
        if [ -n "$test_file" ]; then
            test_files="$test_files $test_file"
            echo "  $file -> $test_file"
        else
            echo "  $file -> (无对应测试)"
        fi
    done

    if [ -z "$test_files" ]; then
        echo "[incremental] 无对应测试文件"
        return 0
    fi

    echo ""
    echo ">> Running: pnpm vitest run$test_files"
    if ! pnpm vitest run $test_files; then
        echo "❌ Tests failed"
        return 1
    fi

    echo ""
    echo "✅ Incremental test passed"
    return 0
}

# 全量检查
run_full_check() {
    echo "[full] 运行全量检查..."

    echo ">> TypeScript check"
    if ! pnpm exec tsc --noEmit; then
        echo "❌ TypeScript check failed"
        return 1
    fi
    echo "✓ TypeScript check passed"

    echo ""
    echo ">> Running: cargo clippy"
    if ! cargo clippy --jobs 4 -- -D warnings -A dead_code; then
        echo "❌ Clippy failed"
        return 1
    fi
    echo "✓ Clippy passed"

    echo ""
    echo "✅ Full check passed"
    return 0
}

# 全量测试
run_full_test() {
    echo "[full] 运行全量测试..."

    echo ">> Frontend tests"
    if ! pnpm vitest run --reporter=default --reporter=junit --outputFile=test-results.xml; then
        echo "❌ Frontend tests failed"
        return 1
    fi
    echo "✓ Frontend tests passed"

    echo ""
    echo ">> Backend tests"
    if ! cargo test --jobs 4; then
        echo "❌ Backend tests failed"
        return 1
    fi
    echo "✓ Backend tests passed"

    echo ""
    echo "✅ Full test passed"
    return 0
}

# 导出函数供 task.go 调用
export -f run_incremental_check run_incremental_test run_full_check run_full_test needs_full_test

# 执行
case "$INCREMENTAL_MODE" in
    incremental)
        run_incremental_check
        ;;
    incremental-test)
        run_incremental_test
        ;;
    full)
        run_full_check
        run_full_test
        ;;
    full-check)
        run_full_check
        ;;
    full-test)
        run_full_test
        ;;
    *)
        echo "Unknown mode: $INCREMENTAL_MODE"
        echo "Usage: $0 {incremental|incremental-test|full|full-check|full-test}"
        exit 1
        ;;
esac