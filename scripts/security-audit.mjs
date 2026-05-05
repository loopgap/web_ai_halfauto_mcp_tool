/**
 * security-audit.mjs — 依赖安全审计脚本
 * 在 CI 中运行，检测高危依赖漏洞
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const auditIgnoreFile = path.join(root, '.auditignore');

/** 读取忽略规则 */
function getIgnorePatterns() {
  try {
    return fs.readFileSync(auditIgnoreFile, 'utf8')
      .split('\n')
      .filter(line => line.trim() && !line.startsWith('#'));
  } catch {
    return [];
  }
}

/** 检查是否应该忽略此漏洞 */
function shouldIgnore(advisory, patterns) {
  const id = advisory.id?.toString() || '';
  const module = advisory.module || '';
  const url = advisory.url || '';

  for (const pattern of patterns) {
    if (id.includes(pattern) || module.includes(pattern) || url.includes(pattern)) {
      return true;
    }
  }
  return false;
}

async function runAudit() {
  console.log('🔍 Running security audit...\n');

  try {
    // 运行 pnpm audit JSON 格式
    const output = execSync('pnpm audit --json', {
      encoding: 'utf8',
      maxBuffer: 50 * 1024 * 1024, // 50MB
    });

    const auditResult = JSON.parse(output);
    const ignorePatterns = getIgnorePatterns();

    // 分类统计
    const stats = {
      critical: [],
      high: [],
      medium: [],
      low: [],
      info: [],
    };

    // 处理 advisory 数据
    if (auditResult.advisories) {
      for (const [id, advisory] of Object.entries(auditResult.advisories)) {
        if (shouldIgnore(advisory, ignorePatterns)) {
          continue;
        }

        const severity = advisory.severity?.toLowerCase() || 'unknown';
        if (stats[severity]) {
          stats[severity].push({
            id,
            module: advisory.module,
            severity,
            title: advisory.title,
            url: advisory.url,
            found_by: advisory.found_by,
            vulnerable_versions: advisory.vulnerable_versions,
            patched_in: advisory.patched_in,
          });
        }
      }
    }

    // 输出报告
    let hasBlockingIssues = false;

    if (stats.critical.length > 0) {
      hasBlockingIssues = true;
      console.log(`❌ ${stats.critical.length} CRITICAL vulnerabilities:`);
      stats.critical.forEach(v => {
        console.log(`   [${v.id}] ${v.module}`);
        console.log(`      ${v.title}`);
        console.log(`      Fix: upgrade to ${v.patched_in || 'latest'}`);
      });
      console.log();
    }

    if (stats.high.length > 0) {
      hasBlockingIssues = true;
      console.log(`❌ ${stats.high.length} HIGH severity vulnerabilities:`);
      stats.high.forEach(v => {
        console.log(`   [${v.id}] ${v.module}`);
        console.log(`      ${v.title}`);
        console.log(`      Fix: upgrade to ${v.patched_in || 'latest'}`);
      });
      console.log();
    }

    if (stats.medium.length > 0) {
      console.log(`⚠️  ${stats.medium.length} MEDIUM severity vulnerabilities:`);
      stats.medium.slice(0, 5).forEach(v => {
        console.log(`   [${v.id}] ${v.module} - ${v.title}`);
      });
      if (stats.medium.length > 5) {
        console.log(`   ... and ${stats.medium.length - 5} more`);
      }
      console.log();
    }

    if (stats.low.length > 0) {
      console.log(`ℹ️  ${stats.low.length} LOW severity vulnerabilities (ignored by default)`);
    }

    // 总结
    console.log('---');
    console.log(`Total: ${Object.values(stats).flat().length} issues`);
    console.log(`Critical: ${stats.critical.length}, High: ${stats.high.length}, Medium: ${stats.medium.length}`);

    if (hasBlockingIssues) {
      console.log('\n❌ SECURITY AUDIT FAILED - Blocking vulnerabilities found!');
      process.exit(1);
    } else {
      console.log('\n✅ Security audit passed!');
      process.exit(0);
    }

  } catch (error) {
    if (error.status === 0) {
      // 无漏洞时 pnpm audit 也会抛错
      console.log('✅ No vulnerabilities found!');
      process.exit(0);
    }
    console.error('Audit failed:', error.message);
    process.exit(1);
  }
}

runAudit();