package main

import (
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
)

var (
	fullMode = flag.Bool("full", false, "Run full checks (not incremental)")
)

func main() {
	flag.Parse()

	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "dev":
		runDev()
	case "build":
		runBuild()
	case "clean":
		runClean()
	case "doctor":
		runDoctor()
	case "check":
		runCheck()
	case "test":
		runTest()
	case "setup", "bootstrap":
		runSetup()
	case "ci":
		runCI()
	default:
		fmt.Printf("Unknown command: %s\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("Usage: go run task.go <command> [--full]")
	fmt.Println("\nCommands:")
	fmt.Println("  setup    - Install dependencies (pnpm install)")
	fmt.Println("  dev      - Start the development server (Tauri/Vite)")
	fmt.Println("  build    - Build the application (Frontend + Backend)")
	fmt.Println("  clean    - Clean build artifacts (dist, target, node_modules)")
	fmt.Println("  doctor   - Check environment dependencies")
	fmt.Println("  check    - Run type checks and linters (incremental by default)")
	fmt.Println("  test     - Run tests (incremental by default)")
	fmt.Println("  ci       - Run full CI checks (check + test)")
	fmt.Println("\nOptions:")
	fmt.Println("  --full   - Run full checks instead of incremental")
}

func execute(cmd string, args ...string) error {
	fmt.Printf(">> Running: %s %s\n", cmd, strings.Join(args, " "))
	c := exec.Command(cmd, args...)
	c.Stdout = os.Stdout
	c.Stderr = os.Stderr
	c.Stdin = os.Stdin
	return c.Run()
}

func executeInDir(dir, cmd string, args ...string) error {
	fmt.Printf(">> [%s] Running: %s %s\n", dir, cmd, strings.Join(args, " "))
	c := exec.Command(cmd, args...)
	c.Dir = dir
	c.Stdout = os.Stdout
	c.Stderr = os.Stdin
	c.Stdin = os.Stdin
	return c.Run()
}

func runSetup() {
	fmt.Println("🛠️ Setting up project...")
	if err := runPnpm("install"); err != nil {
		fmt.Println("❌ Setup failed:", err)
		os.Exit(1)
	}
	fmt.Println("✅ Setup complete!")
}

func runDev() {
	fmt.Println("🚀 Starting Development Environment...")
	err := runPnpm("exec", "tauri", "dev")
	if err != nil {
		fmt.Println("❌ Dev server failed:", err)
		os.Exit(1)
	}
}

func runBuild() {
	fmt.Println("📦 Building Application...")
	fmt.Println(">> Building Frontend...")
	if err := runPnpm("exec", "vite", "build"); err != nil {
		fmt.Println("❌ Frontend build failed:", err)
		os.Exit(1)
	}
	fmt.Println(">> Building Backend (Release)...")
	if err := executeInDir("src-tauri", "cargo", "build", "--release"); err != nil {
		fmt.Println("❌ Backend build failed:", err)
		os.Exit(1)
	}
	fmt.Println("✅ Build successful!")
}

func runClean() {
	fmt.Println("🧹 Cleaning build artifacts...")

	dirsToClean := []string{
		"dist",
		"node_modules/.cache",
		"src-tauri/target",
	}

	for _, dir := range dirsToClean {
		if _, err := os.Stat(dir); !os.IsNotExist(err) {
			fmt.Printf("  🗑️  Removing %s\n", dir)
			os.RemoveAll(dir)
		}
	}

	files, _ := filepath.Glob("*.tsbuildinfo")
	for _, f := range files {
		fmt.Printf("  🗑️  Removing %s\n", f)
		os.Remove(f)
	}

	fmt.Println("✅ Clean complete!")
}

func runDoctor() {
	fmt.Println("🩺 Checking Environment...")

	checkCmd("node", "--version", "Node.js")
	checkPnpm()
	checkCmd("cargo", "--version", "Cargo")
	checkCmd("rustc", "--version", "Rustc")
	checkCmd("go", "version", "Go")
	checkPlatformDeps()

	fmt.Println("✅ Environment check complete!")
}

func runCheck() {
	if *fullMode {
		runFullCheck()
	} else {
		runIncrementalCheck()
	}
}

func runTest() {
	if *fullMode {
		runFullTest()
	} else {
		runIncrementalTest()
	}
}

func runCI() {
	if *fullMode {
		fmt.Println("🔄 Running Full CI (--full mode)...")
		runFullCheck()
		runFullTest()
	} else {
		fmt.Println("🔄 Running Incremental CI...")
		runIncrementalCheck()
		runIncrementalTest()
	}
	fmt.Println("✅ CI complete!")
}

func runIncrementalCheck() {
	fmt.Println("[incremental] Running check...")

	changedFiles := getChangedFiles()
	hasRustChanges := false
	for _, f := range changedFiles {
		if strings.HasPrefix(f, "src-tauri/") && strings.HasSuffix(f, ".rs") {
			hasRustChanges = true
			break
		}
	}

	fmt.Println(">> TypeScript check")
	if err := runPnpm("exec", "tsc", "--noEmit"); err != nil {
		fmt.Println("❌ TypeScript check failed")
		os.Exit(1)
	}

	if hasRustChanges {
		fmt.Println(">> Rust clippy (incremental)")
		if err := executeInDir("src-tauri", "cargo", "clippy", "--jobs", "4", "--", "-D", "warnings", "-A", "dead_code"); err != nil {
			fmt.Println("❌ Clippy failed")
			os.Exit(1)
		}
	} else {
		fmt.Println(">> Rust check (incremental)")
		if err := executeInDir("src-tauri", "cargo", "check", "--jobs", "4"); err != nil {
			fmt.Println("❌ Cargo check failed")
			os.Exit(1)
		}
	}

	fmt.Println("✅ Incremental check passed!")
}

func runFullCheck() {
	fmt.Println("[full] Running full check...")

	fmt.Println(">> TypeScript check")
	if err := runPnpm("exec", "tsc", "--noEmit"); err != nil {
		fmt.Println("❌ TypeScript check failed")
		os.Exit(1)
	}

	fmt.Println(">> Rust clippy")
	if err := executeInDir("src-tauri", "cargo", "clippy", "--jobs", "4", "--", "-D", "warnings", "-A", "dead_code"); err != nil {
		fmt.Println("❌ Clippy failed")
		os.Exit(1)
	}

	fmt.Println("✅ Full check passed!")
}

func runIncrementalTest() {
	fmt.Println("[incremental] Running test...")

	changedFiles := getChangedFiles()
	if len(changedFiles) == 0 {
		fmt.Println("[incremental] No source files changed, skipping tests")
		return
	}

	for _, f := range changedFiles {
		if f == "src/api.ts" {
			fmt.Println("[incremental] api.ts changed - full test required")
			os.Exit(100)
		}
	}

	testFiles := getTestFilesForChanges(changedFiles)
	if len(testFiles) == 0 {
		fmt.Println("[incremental] No test files found for changes")
		return
	}

	fmt.Printf("[incremental] Running %d test file(s)\n", len(testFiles))
	testArgs := append([]string{"vitest", "run"}, testFiles...)
	if err := runPnpm(testArgs...); err != nil {
		fmt.Println("❌ Tests failed")
		os.Exit(1)
	}

	fmt.Println("✅ Incremental test passed!")
}

func runFullTest() {
	fmt.Println("[full] Running full test...")

	fmt.Println(">> Frontend tests")
	if err := runPnpm("exec", "vitest", "run", "--reporter=default", "--reporter=junit", "--outputFile=test-results.xml"); err != nil {
		fmt.Println("❌ Frontend tests failed")
		os.Exit(1)
	}

	fmt.Println(">> Backend tests")
	if err := executeInDir("src-tauri", "cargo", "test", "--jobs", "4"); err != nil {
		fmt.Println("❌ Backend tests failed")
		os.Exit(1)
	}

	fmt.Println("✅ Full test passed!")
}

func getChangedFiles() []string {
	cmd := exec.Command("git", "diff", "--name-only", "HEAD")
	output, err := cmd.CombinedOutput()
	if err != nil {
		return []string{}
	}

	var files []string
	for _, line := range strings.Split(string(output), "\n") {
		line = strings.TrimSpace(line)
		if line != "" {
			files = append(files, line)
		}
	}
	return files
}

func getTestFilesForChanges(changedFiles []string) []string {
	var testFiles []string
	seen := make(map[string]bool)

	for _, file := range changedFiles {
		if !strings.HasPrefix(file, "src/") {
			continue
		}
		if strings.Contains(file, "__tests__") {
			continue
		}
		if !strings.HasSuffix(file, ".ts") && !strings.HasSuffix(file, ".tsx") {
			continue
		}

		testFile := strings.Replace(file, "src/", "src/__tests__/", 1)
		if strings.HasSuffix(testFile, ".ts") {
			testFile = strings.Replace(testFile, ".ts", ".test.ts", 1)
		} else if strings.HasSuffix(testFile, ".tsx") {
			testFile = strings.Replace(testFile, ".tsx", ".test.tsx", 1)
		}

		if _, err := os.Stat(testFile); err == nil && !seen[testFile] {
			testFiles = append(testFiles, testFile)
			seen[testFile] = true
		}
	}
	return testFiles
}

func checkCmd(cmd string, arg string, name string) {
	out, err := exec.Command(cmd, arg).CombinedOutput()
	if err != nil {
		fmt.Printf("❌ %s not found or failed: %v\n", name, err)
	} else {
		fmt.Printf("✅ %s is installed: %s", name, strings.TrimSpace(string(out)))
	}
}

func runPnpm(args ...string) error {
	if _, err := exec.LookPath("pnpm"); err == nil {
		return execute("pnpm", args...)
	}
	if _, err := exec.LookPath("corepack"); err == nil {
		cpArgs := append([]string{"pnpm"}, args...)
		return execute("corepack", cpArgs...)
	}
	return fmt.Errorf("pnpm/corepack not found")
}

func checkPnpm() {
	if _, err := exec.LookPath("pnpm"); err == nil {
		checkCmd("pnpm", "--version", "pnpm")
		return
	}
	if _, err := exec.LookPath("corepack"); err == nil {
		out, e := exec.Command("corepack", "pnpm", "--version").CombinedOutput()
		if e != nil {
			fmt.Printf("❌ pnpm(corepack) failed: %v\n", e)
			return
		}
		fmt.Printf("✅ pnpm (via corepack) is available: %s\n", strings.TrimSpace(string(out)))
		return
	}
	fmt.Println("❌ pnpm not found (and corepack missing)")
}

func checkPlatformDeps() {
	if _, err := exec.LookPath("apt-get"); err == nil {
		pkgs := []string{"libwebkit2gtk-4.1-dev", "libgtk-3-dev", "libayatana-appindicator3-dev", "librsvg2-dev", "patchelf"}
		fmt.Println("🔎 Linux apt dependencies:")
		for _, p := range pkgs {
			if err := exec.Command("dpkg", "-s", p).Run(); err == nil {
				fmt.Printf("✅ %s\n", p)
			} else {
				fmt.Printf("⚠️  %s (missing)\n", p)
			}
		}
	}
}