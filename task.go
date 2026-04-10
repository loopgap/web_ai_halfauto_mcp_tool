package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

func main() {
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
	fmt.Println("Usage: go run task.go <command>")
	fmt.Println("\nCommands:")
	fmt.Println("  setup    - Install dependencies (pnpm install)")
	fmt.Println("  dev      - Start the development server (Tauri/Vite)")
	fmt.Println("  build    - Build the application (Frontend + Backend)")
	fmt.Println("  clean    - Clean build artifacts (dist, target, node_modules)")
	fmt.Println("  doctor   - Check environment dependencies")
	fmt.Println("  check    - Run type checks and linters")
	fmt.Println("  test     - Run tests")
	fmt.Println("  ci       - Run full CI checks (check + test)")
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
	c.Stderr = os.Stderr
	c.Stdin = os.Stdin
	return c.Run()
}

func runSetup() {
	fmt.Println("🛠️ Setting up project...")
	if err := execute(getPnpmCmd(), "install"); err != nil {
		fmt.Println("❌ Setup failed:", err)
		os.Exit(1)
	}
	fmt.Println("✅ Setup complete!")
}

func runDev() {
	fmt.Println("🚀 Starting Development Environment...")
	err := execute(getPnpmCmd(), "exec", "tauri", "dev")
	if err != nil {
		fmt.Println("❌ Dev server failed:", err)
		os.Exit(1)
	}
}

func runBuild() {
	fmt.Println("📦 Building Application...")
	fmt.Println(">> Building Frontend...")
	if err := execute(getPnpmCmd(), "exec", "vite", "build"); err != nil {
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
	checkCmd(getPnpmCmd(), "--version", "pnpm")
	checkCmd("cargo", "--version", "Cargo")
	checkCmd("rustc", "--version", "Rustc")
	checkCmd("go", "version", "Go")
	
	fmt.Println("✅ Environment check complete!")
}

func runCheck() {
	fmt.Println("🔍 Running checks...")
	fmt.Println(">> TypeScript check")
	if err := execute(getPnpmCmd(), "exec", "tsc", "--noEmit"); err != nil {
		fmt.Println("❌ TypeScript check failed")
		os.Exit(1)
	}
	
	fmt.Println(">> Cargo clippy")
	if err := executeInDir("src-tauri", "cargo", "clippy", "--", "-D", "warnings", "-A", "dead_code"); err != nil {
		fmt.Println("❌ Cargo clippy failed")
		os.Exit(1)
	}
	
	fmt.Println("✅ All checks passed!")
}

func runTest() {
	fmt.Println("🧪 Running tests...")
	fmt.Println(">> Frontend tests")
	if err := execute(getPnpmCmd(), "exec", "vitest", "run"); err != nil {
		fmt.Println("❌ Frontend tests failed")
		os.Exit(1)
	}
	
	fmt.Println(">> Backend tests")
	if err := executeInDir("src-tauri", "cargo", "test"); err != nil {
		fmt.Println("❌ Backend tests failed")
		os.Exit(1)
	}
	
	fmt.Println("✅ All tests passed!")
}

func runCI() {
	fmt.Println("🔄 Running Continuous Integration tasks...")
	runCheck()
	runTest()
	fmt.Println("✅ CI complete!")
}

func checkCmd(cmd string, arg string, name string) {
	out, err := exec.Command(cmd, arg).CombinedOutput()
	if err != nil {
		fmt.Printf("❌ %s not found or failed: %v\n", name, err)
	} else {
		fmt.Printf("✅ %s is installed: %s", name, strings.TrimSpace(string(out)))
	}
}

func getPnpmCmd() string {
	if runtime.GOOS == "windows" {
		return "pnpm.cmd"
	}
	return "pnpm"
}