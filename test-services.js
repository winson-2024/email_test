// 邮件服务测试脚本
const axios = require('axios');

// 测试配置
const TEST_CONFIG = {
    serverUrl: 'http://localhost:3000',
    timeout: 15000
};

// 颜色输出
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

// 测试服务状态
async function testServiceStatus() {
    log('\n=== 测试服务状态检查 ===', 'cyan');
    
    try {
        const response = await axios.post(`${TEST_CONFIG.serverUrl}/api/check-services`, {}, {
            timeout: TEST_CONFIG.timeout
        });
        
        if (response.data.success) {
            log('✅ 服务状态检查成功', 'green');
            
            const results = response.data.results;
            for (const [key, service] of Object.entries(results)) {
                const status = service.isActive ? '🟢 活跃' : (service.status === 'error' ? '🔴 错误' : '🟡 不可用');
                log(`  ${service.name}: ${status} (${service.domains ? service.domains.length : 0} 个域名)`, 'blue');
            }
            
            return results;
        } else {
            throw new Error(response.data.message || '检查失败');
        }
    } catch (error) {
        log(`❌ 服务状态检查失败: ${error.message}`, 'red');
        return null;
    }
}

// 测试邮箱创建
async function testEmailCreation() {
    log('\n=== 测试邮箱创建 ===', 'cyan');
    
    try {
        const response = await axios.post(`${TEST_CONFIG.serverUrl}/api/create-email`, {}, {
            timeout: TEST_CONFIG.timeout
        });
        
        if (response.data.success) {
            log('✅ 邮箱创建成功', 'green');
            log(`  邮箱地址: ${response.data.email}`, 'blue');
            log(`  服务提供商: ${response.data.serviceName}`, 'blue');
            log(`  域名: ${response.data.domain}`, 'blue');
            
            return {
                email: response.data.email,
                token: response.data.token,
                service: response.data.service
            };
        } else {
            throw new Error(response.data.message || '创建失败');
        }
    } catch (error) {
        log(`❌ 邮箱创建失败: ${error.message}`, 'red');
        return null;
    }
}

// 测试邮件获取
async function testEmailRetrieval(emailData) {
    log('\n=== 测试邮件获取 ===', 'cyan');
    
    if (!emailData) {
        log('❌ 没有可用的邮箱数据', 'red');
        return false;
    }
    
    try {
        const response = await axios.get(`${TEST_CONFIG.serverUrl}/api/emails`, {
            params: {
                token: emailData.token,
                service: emailData.service
            },
            timeout: TEST_CONFIG.timeout
        });
        
        if (response.data.success) {
            log('✅ 邮件获取成功', 'green');
            log(`  邮件数量: ${response.data.emails.length}`, 'blue');
            log(`  服务提供商: ${response.data.service}`, 'blue');
            
            if (response.data.emails.length > 0) {
                log('  最新邮件:', 'yellow');
                const latestEmail = response.data.emails[0];
                log(`    发件人: ${latestEmail.from}`, 'blue');
                log(`    主题: ${latestEmail.subject}`, 'blue');
                log(`    时间: ${latestEmail.date}`, 'blue');
            }
            
            return true;
        } else {
            throw new Error(response.data.message || '获取失败');
        }
    } catch (error) {
        log(`❌ 邮件获取失败: ${error.message}`, 'red');
        return false;
    }
}

// 测试域名获取
async function testDomainRetrieval() {
    log('\n=== 测试域名获取 ===', 'cyan');
    
    try {
        const response = await axios.get(`${TEST_CONFIG.serverUrl}/api/domains`, {
            timeout: TEST_CONFIG.timeout
        });
        
        if (response.data.success) {
            log('✅ 域名获取成功', 'green');
            log(`  可用域名数量: ${response.data.domains.length}`, 'blue');
            
            if (response.data.domains.length > 0) {
                log('  可用域名列表:', 'yellow');
                response.data.domains.forEach(domain => {
                    log(`    ${domain.domain} (${domain.serviceName})`, 'blue');
                });
            }
            
            return true;
        } else {
            throw new Error(response.data.message || '获取失败');
        }
    } catch (error) {
        log(`❌ 域名获取失败: ${error.message}`, 'red');
        return false;
    }
}

// 测试服务器连接
async function testServerConnection() {
    log('\n=== 测试服务器连接 ===', 'cyan');
    
    try {
        const response = await axios.get(`${TEST_CONFIG.serverUrl}/api/service-status`, {
            timeout: 5000
        });
        
        if (response.data.success) {
            log('✅ 服务器连接成功', 'green');
            return true;
        } else {
            throw new Error('服务器响应异常');
        }
    } catch (error) {
        log(`❌ 服务器连接失败: ${error.message}`, 'red');
        log('请确保服务器正在运行: node server.js', 'yellow');
        return false;
    }
}

// 综合测试报告
function generateTestReport(results) {
    log('\n=== 测试报告 ===', 'magenta');
    
    const totalTests = Object.keys(results).length;
    const passedTests = Object.values(results).filter(result => result === true).length;
    const failedTests = totalTests - passedTests;
    
    log(`总测试数: ${totalTests}`, 'blue');
    log(`通过: ${passedTests}`, 'green');
    log(`失败: ${failedTests}`, 'red');
    log(`成功率: ${((passedTests / totalTests) * 100).toFixed(1)}%`, 'yellow');
    
    if (passedTests === totalTests) {
        log('\n🎉 所有测试通过！邮件服务对接成功！', 'green');
        log('系统已准备就绪，可以正常使用。', 'green');
    } else {
        log('\n⚠️  部分测试失败，请检查以下问题:', 'yellow');
        
        for (const [testName, result] of Object.entries(results)) {
            if (!result) {
                log(`  - ${testName}`, 'red');
            }
        }
        
        log('\n建议检查:', 'yellow');
        log('1. 网络连接是否正常', 'blue');
        log('2. 第三方邮件服务是否可用', 'blue');
        log('3. 服务器配置是否正确', 'blue');
    }
}

// 主测试函数
async function runTests() {
    log('🚀 开始邮件服务对接测试...', 'bright');
    log(`测试服务器: ${TEST_CONFIG.serverUrl}`, 'blue');
    
    const results = {};
    
    // 1. 测试服务器连接
    results['服务器连接'] = await testServerConnection();
    if (!results['服务器连接']) {
        generateTestReport(results);
        return;
    }
    
    // 2. 测试服务状态
    const serviceStatus = await testServiceStatus();
    results['服务状态检查'] = serviceStatus !== null;
    
    // 3. 测试域名获取
    results['域名获取'] = await testDomainRetrieval();
    
    // 4. 测试邮箱创建
    const emailData = await testEmailCreation();
    results['邮箱创建'] = emailData !== null;
    
    // 5. 测试邮件获取
    results['邮件获取'] = await testEmailRetrieval(emailData);
    
    // 等待一段时间后再次测试邮件获取（模拟实际使用场景）
    if (emailData) {
        log('\n⏳ 等待5秒后再次测试邮件获取...', 'yellow');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        log('\n=== 重新测试邮件获取 ===', 'cyan');
        const secondTest = await testEmailRetrieval(emailData);
        results['邮件获取(重试)'] = secondTest;
    }
    
    // 生成测试报告
    generateTestReport(results);
}

// 如果直接运行此脚本
if (require.main === module) {
    runTests().catch(error => {
        log(`\n💥 测试过程中发生错误: ${error.message}`, 'red');
        process.exit(1);
    });
}

module.exports = {
    runTests,
    testServiceStatus,
    testEmailCreation,
    testEmailRetrieval,
    testDomainRetrieval,
    testServerConnection
};