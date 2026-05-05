# 覆盖率与集成测试提升详细计划

## 一、问题分析

### 1.1 glob 兼容性问题（阻断覆盖率阈值强制）

**问题根源**：
```
@vitest/coverage-v8 3.2.1
└── test-exclude 7.0.2
    ├── glob 10.5.0
    │   └── minimatch 9.0.9
    │       └── brace-expansion 5.0.5  ← ESM 模块被 CJS 方式调用
    └── minimatch 10.2.4
        └── brace-expansion 5.0.5
```

**错误信息**：
```
TypeError: (0 , brace_expansion_1.default) is not a function
  at braceExpand node_modules/.pnpm/minimatch@9.0.9/node_modules/minimatch/dist/commonjs/index.js:160:42
  at TestExclude.glob node_modules/.pnpm/test-exclude@7.0.2/node_modules/test-exclude/index.js:128:28
  at V8CoverageProvider.getUntestedFiles
```

**影响**：
- 覆盖率收集在 `getUntestedFiles` 阶段失败
- 无法在 CI 中强制覆盖率阈值

### 1.2 集成测试覆盖不足

| 目录 | 文件数 | 有测试的 | 覆盖率 |
|-------|--------|---------|--------|
| `src/components/` | 20 | 2 | ~10% |
| `src/pages/` | 10 | 3 | ~30% |
| `src/domain/` | 17 | 16 | ~95% |
| `src/hooks/` | 5 | 3 | ~60% |

---

## 二、解决方案

### 2.1 覆盖率阈值强制方案

#### 方案 A：pnpm overrides 强制兼容版本（推荐）

在 `package.json` 中添加：

```json
{
  "pnpm": {
    "overrides": {
      "brace-expansion": ">=5.0.5",
      "glob": "11.0.0",
      "minimatch": "10.2.0"
    }
  }
}
```

#### 方案 B：使用 coverage.exclude 减少 glob 使用

```typescript
// vitest.config.ts
coverage: {
  exclude: [
    // ... 原有排除
    "src/components/**",  // 暂时排除，等待补充测试
  ]
}
```

#### 方案 C：CI 中分步执行覆盖率

1. 先运行测试（不收集覆盖率）
2. 测试通过后，单独运行覆盖率收集

```yaml
- name: Run tests
  run: pnpm exec vitest run

- name: Generate coverage report
  run: pnpm exec vitest run --coverage --coverage.exclude='["src/components/**"]'
```

---

### 2.2 集成测试覆盖提升方案

#### 目标覆盖率

| 目录 | 当前 | 目标 | 差距 |
|-------|------|------|------|
| `src/components/` | ~10% | 50% | +40% |
| `src/pages/` | ~30% | 60% | +30% |

#### 优先级排序

**高优先级**（业务核心）：
1. `ConsolePage.tsx` - 21 tests (需增强)
2. `CommandPalette.tsx` - 0 tests (新增)
3. `TargetWizard.tsx` - 0 tests (新增)

**中优先级**（常用组件）：
4. `Layout.tsx` - 0 tests (新增)
5. `RunHistoryList.tsx` - 0 tests (新增)
6. `Toast.tsx` - 0 tests (新增)

**低优先级**（辅助功能）：
7. `ErrorBoundary.tsx` - 0 tests (新增)
8. `WorkflowEditor.tsx` - 0 tests (新增)

---

## 三、实施步骤

### 阶段 1：解决 glob 兼容性问题（1-2 天）

#### Step 1.1：测试 pnpm overrides 方案

```bash
# 修改 package.json
pnpm.overrides: {
  "minimatch": "10.0.0"
}

# 重新安装
pnpm install

# 测试覆盖率
pnpm exec vitest run --coverage
```

#### Step 1.2：如果 overrides 方案失败，使用 CI 分步方案

```yaml
# .github/workflows/ci.yml
- name: Run tests without coverage
  run: pnpm test:ci

- name: Generate coverage report
  run: pnpm exec vitest run --coverage --coverage.exclude='["src/components/**","src/pages/**"]'
```

### 阶段 2：补充集成测试（3-5 天）

#### Step 2.1：ConsolePage 增强测试（1 天）

```typescript
// 目标：增加 15 个测试用例
// 覆盖：route decision, error handling, two-phase dispatch
describe("ConsolePage - Route Decision", () => {
  it("displays route decision when available", async () => { ... });
  it("shows loading state during routing", async () => { ... });
  it("handles routing error gracefully", async () => { ... });
});

describe("ConsolePage - Error Handling", () => {
  it("displays error message on dispatch failure", async () => { ... });
  it("allows retry after error", async () => { ... });
  it("clears error when user starts new input", async () => { ... });
});
```

#### Step 2.2：CommandPalette 测试（1 天）

```typescript
// 目标：新增 10 个测试用例
describe("CommandPalette", () => {
  it("opens with keyboard shortcut", async () => { ... });
  it("filters commands by query", async () => { ... });
  it("executes command on Enter", async () => { ... });
  it("navigates with arrow keys", async () => { ... });
  it("closes on Escape", async () => { ... });
  it("displays command categories", async () => { ... });
  it("shows keyboard shortcuts", async () => { ... });
});
```

#### Step 2.3：Layout + RunHistoryList 测试（1 天）

```typescript
// 目标：新增 8 个测试用例
describe("Layout", () => {
  it("renders navigation sidebar", async () => { ... });
  it("highlights active route", async () => { ... });
  it("shows user menu", async () => { ... });
});

describe("RunHistoryList", () => {
  it("displays list of runs", async () => { ... });
  it("shows run status badges", async () => { ... });
  it("navigates to run detail on click", async () => { ... });
});
```

#### Step 2.4：TargetWizard + Toast 测试（1 天）

```typescript
// 目标：新增 12 个测试用例
describe("TargetWizard", () => {
  it("renders welcome step", async () => { ... });
  it("navigates through steps", async () => { ... });
  it("validates window selection", async () => { ... });
  it("saves target configuration", async () => { ... });
});

describe("Toast", () => {
  it("displays success message", async () => { ... });
  it("displays error message", async () => { ... });
  it("auto-dismisses after timeout", async () => { ... });
  it("allows manual dismiss", async () => { ... });
});
```

### 阶段 3：覆盖率阈值验证（1 天）

#### Step 3.1：配置覆盖率阈值

```typescript
// vitest.config.ts
coverage: {
  thresholds: {
    statements: 50,
    branches: 40,
    functions: 50,
    lines: 50,
  }
}
```

#### Step 3.2：在 CI 中启用阈值检查

```yaml
- name: Coverage threshold check
  run: pnpm exec vitest run --coverage --coverage.check
```

---

## 四、CI 配置最终方案

### 4.1 分步覆盖率收集

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 10.11.0

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      # Step 1: 运行测试（不收集覆盖率）
      - name: Run tests
        run: pnpm test:ci

      # Step 2: 单独生成覆盖率报告（排除有问题的目录）
      - name: Generate coverage report
        run: |
          pnpm exec vitest run \
            --coverage \
            --coverage.exclude='["src/components/**","src/pages/**"]' \
            --coverage.reporter=text \
            --coverage.reporter=lcov

      # Step 3: 上传覆盖率报告
      - name: Upload coverage
        uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/
```

### 4.2 测试覆盖率目标

| 目录 | 目标覆盖率 | 所需测试数 |
|-------|-----------|-----------|
| `src/domain/` | 95% | 保持现有 |
| `src/hooks/` | 70% | +5 tests |
| `src/pages/` | 50% | +20 tests |
| `src/components/` | 40% | +25 tests |

---

## 五、验收标准

### 5.1 覆盖率阈值强制

- [ ] `pnpm exec vitest run --coverage --coverage.check` 不报错
- [ ] CI 中安全审计通过后能继续执行覆盖率检查
- [ ] 覆盖率报告能正确生成并上传

### 5.2 集成测试覆盖

- [ ] `src/components/` 覆盖率从 10% 提升到 40%+
- [ ] `src/pages/` 覆盖率从 30% 提升到 50%+
- [ ] 新增测试用例 50+ 个
- [ ] 所有新增测试通过

### 5.3 CI 集成

- [ ] `pnpm test:ci` 在 CI 中正常运行
- [ ] 覆盖率报告正确上传到 GitHub Artifacts
- [ ] 覆盖率阈值检查在 PR 中显示

---

## 六、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| glob 兼容性问题无法解决 | 无法强制覆盖率阈值 | 使用 CI 分步方案作为 fallback |
| 组件测试 mock 复杂 | 测试编写困难 | 使用 Testing Library 的 mock utilities |
| 组件依赖 Tauri API | 无法在 jsdom 环境测试 | 使用 vi.mock() 模拟 Tauri 调用 |
| 测试维护成本增加 | 长期测试债务 | 遵循测试金字塔原则，侧重单元测试 |

---

## 七、时间估算

| 阶段 | 任务 | 时间 |
|------|------|------|
| 1 | glob 兼容性修复 | 1-2 天 |
| 2.1 | ConsolePage 增强测试 | 1 天 |
| 2.2 | CommandPalette 测试 | 1 天 |
| 2.3 | Layout + RunHistoryList 测试 | 1 天 |
| 2.4 | TargetWizard + Toast 测试 | 1 天 |
| 3 | 覆盖率阈值验证 | 1 天 |
| **总计** | | **6-7 天** |

---

## 八、后续建议

1. **持续监控**：每月检查覆盖率变化
2. **测试守卫**：PR 必须保持或提升覆盖率
3. **自动化**：添加 pre-commit hook 自动运行测试
4. **文档**：为组件测试编写 Style Guide