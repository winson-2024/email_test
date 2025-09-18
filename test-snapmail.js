// Snapmail API 测试脚本
const axios = require('axios');

const API_KEY = '73ec91c1-0f33-4503-ab80-0ae1fb9ad830';
const BASE_URL = 'https://www.snapmail.cc';

async function testSnapmailAPI() {
    console.log('=== Snapmail API 测试开始 ===');
    console.log(`API Key: ${API_KEY}`);
    console.log(`Base URL: ${BASE_URL}`);
    
    try {
        // 测试1: 检查API连接
        console.log('\n1. 测试API连接...');
        const testResponse = await axios.post(`${BASE_URL}/emailList/filter`, {
            key: API_KEY,
            emailAddress: 'test@snapmail.cc',
            isPrefix: true,
            page: 1,
            count: 1
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'TempEmailService/1.0'
            }
        });
        
        console.log('✅ API连接成功');
        console.log('响应状态:', testResponse.status);
        console.log('响应数据:', JSON.stringify(testResponse.data, null, 2));
        
        // 测试2: 测试kpay前缀邮箱
        console.log('\n2. 测试kpay前缀邮箱...');
        const kpayResponse = await axios.post(`${BASE_URL}/emailList/filter`, {
            key: API_KEY,
            emailAddress: 'kpay001@snapmail.cc',
            isPrefix: true,
            page: 1,
            count: 10
        }, {
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        console.log('✅ kpay邮箱测试成功');
        console.log('邮件数量:', kpayResponse.data.length);
        if (kpayResponse.data.length > 0) {
            console.log('最新邮件:', JSON.stringify(kpayResponse.data[0], null, 2));
        }
        
        // 测试3: 测试不同的前缀
        console.log('\n3. 测试不同前缀...');
        for (let i = 1; i <= 3; i++) {
            const prefix = `kpay${String(i).padStart(3, '0')}`;
            try {
                const prefixResponse = await axios.post(`${BASE_URL}/emailList/filter`, {
                    key: API_KEY,
                    emailAddress: `${prefix}@snapmail.cc`,
                    isPrefix: true,
                    page: 1,
                    count: 5
                }, {
                    timeout: 10000,
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                console.log(`${prefix}@snapmail.cc: ${prefixResponse.data.length} 封邮件`);
            } catch (error) {
                console.log(`${prefix}@snapmail.cc: 测试失败 - ${error.message}`);
            }
        }
        
        console.log('\n=== 测试完成 ===');
        
    } catch (error) {
        console.error('❌ API测试失败:', error.message);
        if (error.response) {
            console.error('响应状态:', error.response.status);
            console.error('响应数据:', error.response.data);
            console.error('响应头:', error.response.headers);
        }
        if (error.request) {
            console.error('请求配置:', error.config);
        }
    }
}

// 运行测试
testSnapmailAPI().then(() => {
    console.log('测试脚本执行完成');
    process.exit(0);
}).catch(error => {
    console.error('测试脚本执行失败:', error);
    process.exit(1);
});